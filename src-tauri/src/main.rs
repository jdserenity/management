#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use base64::{engine::general_purpose::STANDARD, Engine as _};
use log::{error, info, warn, LevelFilter};
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{
  path::{BaseDirectory, PathResolver},
  tray::TrayIcon,
  AppHandle,
  Emitter,
  Manager,
  Runtime,
  State,
};
use tauri_plugin_notification::NotificationExt;
use tokio::time::sleep;

use image::{codecs::jpeg::JpegEncoder, ImageBuffer, Rgb};
use nokhwa::{
    utils::{ApiBackend, CameraInfo},
    Camera,
};

use sqlx;
use tauri_plugin_log::{Target, TargetKind};
use tauri_plugin_sql::{DbInstances, Migration, MigrationKind};

mod app_presence;
mod camera_capture;
mod camera_watch;
mod flow_lid_pause;
mod posture_bridge;
mod sync_http;
use posture_bridge::{posture_recommendations, PostureDebouncer, PostureIngestPayload};

pub struct Translations {
    data: HashMap<String, HashMap<String, String>>,
}

impl Translations {
    pub fn new<R: Runtime>(path_resolver: &PathResolver<R>) -> Self {
        let mut data = HashMap::new();
        let locales = vec!["en"];

        for lang in locales {
            if let Ok(resource_path) =
                path_resolver.resolve(format!("../locales/{}.json", lang), BaseDirectory::Resource)
            {
                if let Ok(file_content) = fs::read_to_string(&resource_path) {
                    if let Ok(map) = serde_json::from_str::<HashMap<String, String>>(&file_content)
                    {
                        data.insert(lang.to_string(), map);

                        info!("Loaded translation file for '{}'.", lang);
                    } else {
                        error!("Failed to parse translation file for '{}': {:?}", lang, resource_path);
                    }
                } else {
                    error!("Failed to read translation file for '{}': {:?}", lang, resource_path);
                }
            } else {
                error!("Translation resource path not found for '{}'.", lang);
            }
        }
        Self { data }
    }

    pub fn get(&self, lang: &str, key: &str) -> String {
        self.data
            .get(lang)
            .and_then(|translations| translations.get(key))
            .cloned()
            .unwrap_or_else(|| {
                self.data
                    .get("en")
                    .and_then(|translations| translations.get(key))
                    .cloned()
                    .unwrap_or_else(|| key.to_string())
            })
    }
}

fn normalize_language_code(_lang: &str) -> String {
    "en".to_string()
}

// --- App State ---
#[derive(serde::Serialize, Clone)]
struct CameraDetail {
    index: u32,
    name: String,
}

#[derive(Clone)]
pub(crate) struct AppState {
    posture_debouncer: Arc<Mutex<PostureDebouncer>>,
    monitoring_active: Arc<Mutex<bool>>,
    force_capture_now: Arc<Mutex<bool>>,
    camera_yield_paused: Arc<Mutex<bool>>,
    camera_capturing: Arc<AtomicBool>,
    camera_stream_held: Arc<AtomicBool>,
    camera: Arc<Mutex<Option<Camera>>>,
    last_alert_time: Arc<Mutex<Instant>>,
    alert_messages: Arc<Mutex<Vec<String>>>,
    selected_camera_index: Arc<Mutex<u32>>,
    monitoring_interval_secs: Arc<Mutex<u64>>,
    translations: Arc<Translations>,
    current_language: Arc<Mutex<String>>,
    battery_saving_mode: Arc<Mutex<bool>>,
    menu_bar_only: Arc<Mutex<bool>>,
    hide_to_menu_bar_on_close: Arc<Mutex<bool>>,
    hidden_to_menu_bar: Arc<Mutex<bool>>,
    flow_active: Arc<Mutex<bool>>,
    tray: Arc<Mutex<Option<TrayIcon>>>,
}

pub(crate) fn lock_or_recover<'a, T>(mutex: &'a Mutex<T>) -> MutexGuard<'a, T> {
    match mutex.lock() {
        Ok(guard) => guard,
        Err(poisoned) => {
            error!("Mutex poisoned - recovering guarded state");
            poisoned.into_inner()
        }
    }
}

fn we_hold_camera_stream(state: &AppState) -> bool {
    state.camera_stream_held.load(Ordering::Acquire)
}

fn release_camera(state: &AppState, reason: &str) {
    camera_capture::stop_continuous_camera(&state.camera, &state.camera_stream_held, reason);
}

fn set_camera_yield_paused(app: &AppHandle, state: &AppState, paused: bool, reason: &str) {
    let was_paused = *lock_or_recover(&state.camera_yield_paused);
    if was_paused == paused {
        return;
    }
    if paused {
        release_camera(state, reason);
        *lock_or_recover(&state.force_capture_now) = false;
    } else if *lock_or_recover(&state.monitoring_active) {
        *lock_or_recover(&state.force_capture_now) = true;
    }
    *lock_or_recover(&state.camera_yield_paused) = paused;
    let _ = app.emit(
        "camera-yield-changed",
        &serde_json::json!({ "paused": paused, "reason": reason }),
    );
}

// --- Tauri Commands ---
#[tauri::command]
fn initialize_pose_model() -> Result<(), String> {
    info!("Pose model lives in the webview (MediaPipe); Rust init is a no-op.");
    Ok(())
}

#[tauri::command]
fn clear_posture_debouncer(state: State<'_, AppState>) -> Result<(), String> {
    lock_or_recover(&state.posture_debouncer).clear();
    Ok(())
}

#[tauri::command]
async fn submit_posture_analysis(
    app: AppHandle,
    state: State<'_, AppState>,
    payload: PostureIngestPayload,
) -> Result<(), String> {
    let (final_turtle, final_shoulder) = {
        let mut d = lock_or_recover(&state.posture_debouncer);
        d.push(payload.turtle_neck, payload.shoulder_misalignment)
    };
    let recommendations = posture_recommendations(final_turtle, final_shoulder);
    let score_u8 = payload.posture_score.round().clamp(0.0, 100.0) as u8;
    let metrics_value: Value = payload
        .metrics_json
        .as_ref()
        .and_then(|raw| serde_json::from_str::<Value>(raw).ok())
        .unwrap_or(Value::Null);
    let result_json = serde_json::json!({
        "turtle_neck": final_turtle,
        "shoulder_misalignment": final_shoulder,
        "posture_score": score_u8,
        "recommendations": recommendations,
        "confidence": payload.confidence,
        "metrics": metrics_value,
        "status": "mediapipe_analysis_success"
    });
    let _ = app.emit("analysis-update", &result_json);

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or_else(|error| {
            warn!("Failed to convert system time (before UNIX_EPOCH): {}", error);
            0
        });

    let instances = app.state::<DbInstances>();
    let db_map = instances.0.read().await;

    if let Some(tauri_plugin_sql::DbPool::Sqlite(sqlite_pool)) = db_map.get("sqlite:mgmt.db") {
        let query =
            "INSERT INTO posture_log (score, is_turtle_neck, is_shoulder_misaligned, timestamp, metrics_json) VALUES (?, ?, ?, ?, ?)";
        if let Err(e) = sqlx::query(query)
            .bind(score_u8 as i64)
            .bind(final_turtle)
            .bind(final_shoulder)
            .bind(timestamp)
            .bind(payload.metrics_json.clone())
            .execute(sqlite_pool)
            .await
        {
            error!("Database write failed: {}", e);
        }
    }

    if final_turtle || final_shoulder {
        let mut last_alert = lock_or_recover(&state.last_alert_time);
        if last_alert.elapsed() >= Duration::from_secs(10) {
            let lang = lock_or_recover(&state.current_language).clone();
            let translations = &state.translations;

            let message_key = if final_turtle && final_shoulder {
                "alert_both"
            } else if final_turtle {
                "alert_turtle"
            } else {
                "alert_shoulder"
            };

            info!("Resolving translation: lang='{}', key='{}'", lang, message_key);
            let message = translations.get(&lang, message_key);
            info!("Resolved translation: '{}'", message);

            lock_or_recover(&state.alert_messages).push(message);
            *last_alert = Instant::now();
            lock_or_recover(&state.posture_debouncer).clear();
        }
    }

    Ok(())
}

#[tauri::command]
async fn start_monitoring(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    *lock_or_recover(&state.monitoring_active) = true;
    *lock_or_recover(&state.camera_yield_paused) = false;
    *lock_or_recover(&state.force_capture_now) = true;

    app_presence::set_tray_icon_active(&app, &state);
    let _ = app.emit("monitoring-state-changed", &serde_json::json!({ "active": true }));
    info!("Real-time monitoring started");
    Ok(())
}

fn encode_preview_frame_data_url(image: &ImageBuffer<Rgb<u8>, Vec<u8>>) -> Result<String, String> {
    let mut jpeg_bytes: Vec<u8> = Vec::new();
    let mut encoder = JpegEncoder::new_with_quality(&mut jpeg_bytes, 70);

    encoder
        .encode(
            image.as_raw(),
            image.width(),
            image.height(),
            image::ColorType::Rgb8.into(),
        )
        .map_err(|e| format!("프리뷰 프레임 JPEG 인코딩 실패: {}", e))?;

    Ok(format!("data:image/jpeg;base64,{}", STANDARD.encode(jpeg_bytes)))
}

#[tauri::command]
async fn stop_monitoring(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    *lock_or_recover(&state.monitoring_active) = false;
    *lock_or_recover(&state.force_capture_now) = false;
    *lock_or_recover(&state.camera_yield_paused) = false;
    release_camera(&state, "stop_monitoring command");

    app_presence::set_tray_icon_monitoring_off(&app, &state);
    let _ = app.emit("monitoring-state-changed", &serde_json::json!({ "active": false }));
    info!("Real-time monitoring stopped");
    Ok(())
}

#[tauri::command]
fn get_alert_messages(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let mut alert_messages = lock_or_recover(&state.alert_messages);
    let messages = alert_messages.clone();
    alert_messages.clear();
    Ok(messages)
}

#[tauri::command]
fn get_monitoring_status(state: State<'_, AppState>) -> Result<serde_json::Value, String> {
    let monitoring_active = *lock_or_recover(&state.monitoring_active);
    let camera_yield_paused = *lock_or_recover(&state.camera_yield_paused);
    Ok(serde_json::json!({
        "active": monitoring_active,
        "camera_yield_paused": camera_yield_paused,
    }))
}

#[tauri::command]
fn request_preview_frame(state: State<'_, AppState>) -> Result<(), String> {
    if *lock_or_recover(&state.monitoring_active) {
        *lock_or_recover(&state.force_capture_now) = true;
        info!("Received immediate preview frame request");
    }
    Ok(())
}

#[tauri::command]
fn test_model_status() -> Result<String, String> {
    Ok(r#"{"status": "mediapipe_frontend", "test": "success"}"#.to_string())
}

#[tauri::command]
async fn save_calibrated_image(
    handle: tauri::AppHandle,
    image_data: String,
) -> Result<String, String> {
    let base64_str = image_data
        .split(',')
        .nth(1)
        .ok_or_else(|| "잘못된 Base64 데이터 형식입니다.".to_string())?;
    let decoded_image = STANDARD
        .decode(base64_str)
        .map_err(|e| format!("Base64 디코딩 실패: {}", e))?;
    let app_data_path = handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("앱 데이터 디렉토리를 찾을 수 없습니다: {}", e))?;
    let image_dir = app_data_path.join("calibration_images");
    fs::create_dir_all(&image_dir).map_err(|e| format!("이미지 저장 디렉토리 생성 실패: {}", e))?;
    let file_path = image_dir.join("calibrated_pose.jpeg");
    let mut file = fs::File::create(&file_path).map_err(|e| format!("파일 생성 실패: {:?}", e))?;
    file.write_all(&decoded_image)
        .map_err(|e| format!("파일 쓰기 실패: {:?}", e))?;
    info!("Calibration image overwritten: {:?}", file_path);
    Ok(file_path.to_string_lossy().into_owned())
}

#[tauri::command]
fn delete_calibrated_image(file_path: String) -> Result<(), String> {
    let path = std::path::Path::new(&file_path);
    if path.exists() {
        fs::remove_file(path).map_err(|e| format!("Failed to delete calibration image: {}", e))?;
        info!("Deleted calibration image: {:?}", path);
    }
    Ok(())
}

#[tauri::command]
async fn get_available_cameras() -> Result<Vec<CameraDetail>, String> {
    match nokhwa::query(ApiBackend::Auto) {
        Ok(cameras) => {
            info!("Detected {} available cameras", cameras.len());
            let camera_details = cameras
                .into_iter()
                .map(|cam: CameraInfo| CameraDetail {
                    index: cam.index().as_index().unwrap_or(0) as u32,
                    name: cam.human_name(),
                })
                .collect();
            Ok(camera_details)
        }
        Err(e) => {
            error!("Failed to query camera list: {}", e);
            #[cfg(target_os = "linux")]
            {
                return Err(format!(
                    "카메라 목록 조회 실패: {}. Linux에서는 다른 앱의 카메라 점유 또는 런타임 포털/샌드박스 권한 문제일 수 있습니다.",
                    e
                ));
            }

            #[cfg(not(target_os = "linux"))]
            {
                Err(e.to_string())
            }
        }
    }
}

#[tauri::command]
async fn set_selected_camera(state: State<'_, AppState>, index: u32) -> Result<(), String> {
    info!("Selected camera changed: index {}", index);

    let monitoring_active = *lock_or_recover(&state.monitoring_active);

    if monitoring_active {
        release_camera(&state, "set_selected_camera request");
    }

    *lock_or_recover(&state.selected_camera_index) = index;

    if monitoring_active {
        *lock_or_recover(&state.force_capture_now) = true;
        info!("Camera change applied; next capture will use index {}", index);
    }

    Ok(())
}

#[tauri::command]
async fn set_detection_settings(
    state: State<'_, AppState>,
    frequency: u8,
    _turtle_sensitivity: u8,
    _shoulder_sensitivity: u8,
) -> Result<(), String> {
    lock_or_recover(&state.posture_debouncer).set_frequency_level(frequency);
    Ok(())
}

#[tauri::command]
async fn set_monitoring_interval(
    state: State<'_, AppState>,
    interval_secs: Option<u64>,
    interval_mins: Option<u64>,
) -> Result<(), String> {
    let interval_secs_final = if let Some(secs) = interval_secs {
        secs
    } else if let Some(mins) = interval_mins {
        mins * 60
    } else {
        3
    };
    info!("Monitoring interval updated: {} seconds", interval_secs_final);
    *lock_or_recover(&state.monitoring_interval_secs) = interval_secs_final;
    Ok(())
}

#[tauri::command]
async fn set_battery_saving_mode(state: State<'_, AppState>, mode: bool) -> Result<(), String> {
    *lock_or_recover(&state.battery_saving_mode) = mode;
    *lock_or_recover(&state.force_capture_now) = true;
    info!("Battery-saving mode updated: {}", mode);

    if mode {
        release_camera(&state, "battery-saving mode enabled");
    }

    if *lock_or_recover(&state.monitoring_active) {
        info!("Battery-saving mode {}; interval applies on next capture cycle.", mode);
    }
    Ok(())
}

#[tauri::command]
async fn set_current_language(state: State<'_, AppState>, lang: String) -> Result<(), String> {
    let normalized = normalize_language_code(&lang);
    info!("Current language changed: {} -> {}", lang, normalized);
    *lock_or_recover(&state.current_language) = normalized;
    Ok(())
}

#[tauri::command]
fn set_app_presence_mode(app: AppHandle, state: State<'_, AppState>, mode: String) -> Result<(), String> {
    app_presence::apply_app_presence_mode(&app, &state, &mode)
}

#[tauri::command]
fn get_app_presence_mode(state: State<'_, AppState>) -> Result<String, String> {
    Ok(if app_presence::menu_bar_only_from_state(&state) {
        app_presence::MODE_MENU_BAR.to_string()
    } else {
        app_presence::MODE_DOCK.to_string()
    })
}

#[tauri::command]
fn focus_main_window(app: AppHandle, state: State<'_, AppState>, dock_bounce: bool) -> Result<(), String> {
    app_presence::focus_main_window(&app, &state, dock_bounce);
    Ok(())
}

#[tauri::command]
fn set_hide_to_menu_bar_on_close(app: AppHandle, state: State<'_, AppState>, enabled: bool) -> Result<(), String> {
    app_presence::apply_hide_to_menu_bar_on_close(&app, &state, enabled)
}

#[tauri::command]
fn set_tray_session_label(app: AppHandle, state: State<'_, AppState>, label: String) -> Result<(), String> {
    app_presence::set_tray_session_label(&app, &state, Some(label.as_str()));
    Ok(())
}

#[tauri::command]
fn set_session_tray_timer_enabled(_enabled: bool) -> Result<(), String> {
    Ok(())
}

#[tauri::command]
fn set_tray_flow_active(app: AppHandle, state: State<'_, AppState>, active: bool) -> Result<(), String> {
    app_presence::apply_tray_flow_active(&app, &state, active)
}

#[tauri::command]
fn notify_session_phase(app: AppHandle, title: String, body: String) -> Result<(), String> {
    if title.is_empty() && body.is_empty() {
        return Ok(());
    }
    let result = app
        .notification()
        .builder()
        .title(if title.is_empty() { "Management" } else { &title })
        .body(&body)
        .icon("icons/icon.png".to_string())
        .show();
    if let Err(e) = result {
        error!("Failed to send session notification: {}", e);
        return Err(e.to_string());
    }
    Ok(())
}

#[tauri::command]
async fn restart_app(app: tauri::AppHandle) -> Result<(), String> {
    info!("Application restart requested");
    if let Ok(exe_path) = std::env::current_exe() {
        let exe_dir = exe_path.parent().unwrap_or(&exe_path);
        let _ = std::process::Command::new(&exe_path)
            .current_dir(exe_dir)
            .spawn();

        app.exit(0);
    } else {
        return Err("실행 파일 경로를 찾을 수 없습니다.".to_string());
    }
    Ok(())
}

// --- Background Tasks ---

async fn background_alert_task(app_handle: AppHandle, state: AppState) {
    let mut interval = tokio::time::interval(Duration::from_secs(3));
    loop {
        interval.tick().await;
        let messages_to_send = {
            let mut alert_messages = lock_or_recover(&state.alert_messages);
            if !alert_messages.is_empty() {
                let message = alert_messages.drain(..).collect::<Vec<_>>().join("\n");
                Some(message)
            } else {
                None
            }
        };

        if let Some(message) = messages_to_send {
            if message.is_empty() {
                continue;
            }

            info!("System notification triggered: {}", &message);

            let builder = app_handle.notification().builder();
            let result = builder
                .title("Management")
                .body(&message)
                .icon("icons/icon.png".to_string())
                .show();

            if let Err(e) = result {
                error!("Failed to send system notification: {}", e);
            }
        }
    }
}

async fn background_monitoring_task(app_handle: AppHandle, state: AppState) {
    let mut last_analysis_time = Instant::now() - Duration::from_secs(3);

    loop {
        sleep(Duration::from_secs(1)).await;

        if !*lock_or_recover(&state.monitoring_active) {
            if we_hold_camera_stream(&state) {
                release_camera(&state, "monitoring inactive");
            }
            continue;
        }

        let interval_duration = {
            let secs = *lock_or_recover(&state.monitoring_interval_secs);
            Duration::from_secs(secs.max(1))
        };

        let force_capture = {
            let mut force_capture_now = lock_or_recover(&state.force_capture_now);
            let should_capture = *force_capture_now;
            if should_capture {
                *force_capture_now = false;
            }
            should_capture
        };

        if !force_capture && last_analysis_time.elapsed() < interval_duration {
            continue;
        }

        if force_capture {
            info!("Executing forced immediate capture");
        }

        let yield_paused = *lock_or_recover(&state.camera_yield_paused);
        let battery_saving = *lock_or_recover(&state.battery_saving_mode);

        if camera_capture::should_defer_capture(true, yield_paused) {
            release_camera(&state, "yield paused");
            continue;
        }

        if camera_watch::is_camera_in_use_elsewhere(we_hold_camera_stream(&state), false) {
            set_camera_yield_paused(&app_handle, &state, true, "in_use");
            continue;
        }

        last_analysis_time = Instant::now();

        let selected_index = *lock_or_recover(&state.selected_camera_index);
        let strategy = camera_capture::capture_strategy(true, yield_paused, battery_saving);

        let buffer_option = match strategy {
            camera_capture::CaptureStrategy::Skip => None,
            camera_capture::CaptureStrategy::Ephemeral => {
                release_camera(&state, "battery-saving capture cycle");
                state.camera_capturing.store(true, Ordering::Release);
                let buffer = camera_capture::capture_ephemeral_frame(selected_index).await;
                state.camera_capturing.store(false, Ordering::Release);
                buffer
            }
            camera_capture::CaptureStrategy::Continuous => {
                if !camera_capture::ensure_continuous_stream(
                    &state.camera,
                    &state.camera_stream_held,
                    selected_index,
                ) {
                    release_camera(&state, "continuous stream open failed");
                    if camera_watch::is_camera_in_use_elsewhere(false, false) {
                        set_camera_yield_paused(&app_handle, &state, true, "open_failed_in_use");
                    }
                    continue;
                }
                state.camera_capturing.store(true, Ordering::Release);
                let buffer = camera_capture::capture_continuous_frame(&state.camera);
                state.camera_capturing.store(false, Ordering::Release);
                if buffer.is_none() {
                    release_camera(&state, "continuous frame failed");
                    if camera_watch::is_camera_in_use_elsewhere(false, false) {
                        set_camera_yield_paused(&app_handle, &state, true, "frame_failed_in_use");
                        continue;
                    }
                }
                buffer
            }
        };

        if let Some(buffer) = buffer_option {
            use nokhwa::pixel_format::RgbFormat;
            if let Ok(decoded_image) = buffer.decode_image::<RgbFormat>() {
                if let Some(rgb_image) = ImageBuffer::<Rgb<u8>, _>::from_raw(
                    decoded_image.width(),
                    decoded_image.height(),
                    decoded_image.into_raw(),
                ) {
                    match encode_preview_frame_data_url(&rgb_image) {
                        Ok(preview_frame_data_url) => {
                            if let Err(e) = app_handle.emit("camera-preview-frame", &preview_frame_data_url) {
                                error!("Failed to emit preview frame event: {}", e);
                            }
                        }
                        Err(e) => {
                            error!("Failed to generate preview frame: {}", e);
                        }
                    }
                }
            }
        }
    }
}

// --- Main Application Setup ---

/// Rename mgmt.db → local.db in the app config dir if the old file exists and the new one
/// doesn't. Runs synchronously before the Tauri builder so the SQL plugin opens the right file.
fn migrate_db_name_if_needed() {
    let Some(config_dir) = dirs::config_dir() else { return };
    let app_dir = config_dir.join("com.diamari.management");
    let old_path = app_dir.join("mgmt.db");
    let new_path = app_dir.join("local.db");
    if old_path.exists() && !new_path.exists() {
        match fs::rename(&old_path, &new_path) {
            Ok(_) => info!("Migrated mgmt.db → local.db"),
            Err(e) => error!("Failed to rename mgmt.db → local.db: {}", e),
        }
    }
}

fn main() {
    #[cfg(target_os = "linux")]
    {
        if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
            info!("Set WEBKIT_DISABLE_DMABUF_RENDERER=1 for Linux runtime compatibility");
        }
    }

    run();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    migrate_db_name_if_needed();
    let run_result = tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_log::Builder::new().targets([Target::new(TargetKind::Stdout), Target::new(TargetKind::Webview)]).level(LevelFilter::Info).build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_sql::Builder::new()
            .add_migrations(
                "sqlite:local.db",
                vec![
                    Migration {
                    version: 1,
                    description: "create posture log table",
                    sql: "CREATE TABLE IF NOT EXISTS posture_log (id INTEGER PRIMARY KEY AUTOINCREMENT, score INTEGER NOT NULL, is_turtle_neck BOOLEAN NOT NULL, is_shoulder_misaligned BOOLEAN NOT NULL, timestamp INTEGER NOT NULL);",
                    kind: MigrationKind::Up,
                },
                    Migration {
                        version: 2,
                        description: "posture_log_metrics_json",
                        sql: "ALTER TABLE posture_log ADD COLUMN metrics_json TEXT;",
                        kind: MigrationKind::Up,
                    },
                    Migration {
                        version: 3,
                        description: "session_focus_workout_logs_and_app_kv",
                        sql: "CREATE TABLE IF NOT EXISTS focus_log (id TEXT PRIMARY KEY NOT NULL, session_type TEXT NOT NULL, completed_at INTEGER NOT NULL, duration_minutes INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS workout_log (id TEXT PRIMARY KEY NOT NULL, workout_id TEXT NOT NULL, workout_name TEXT NOT NULL, completed_at INTEGER NOT NULL, exercises_json TEXT NOT NULL, total_reps INTEGER NOT NULL, total_timed_seconds INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS app_kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL, updated_at INTEGER NOT NULL); CREATE INDEX IF NOT EXISTS idx_focus_log_completed_at ON focus_log (completed_at DESC); CREATE INDEX IF NOT EXISTS idx_workout_log_completed_at ON workout_log (completed_at DESC);",
                        kind: MigrationKind::Up,
                    },
                    Migration {
                        version: 4,
                        description: "partial_session_completion_columns",
                        sql: "ALTER TABLE focus_log ADD COLUMN planned_duration_minutes INTEGER; ALTER TABLE focus_log ADD COLUMN completion_ratio REAL; ALTER TABLE workout_log ADD COLUMN completion_ratio REAL; UPDATE focus_log SET planned_duration_minutes = duration_minutes, completion_ratio = 1.0 WHERE planned_duration_minutes IS NULL; UPDATE workout_log SET completion_ratio = 1.0 WHERE completion_ratio IS NULL;",
                        kind: MigrationKind::Up,
                    },
                    Migration {
                        version: 5,
                        description: "nutrition_tdee_tables",
                        sql: "CREATE TABLE IF NOT EXISTS nutrition_config (id INTEGER PRIMARY KEY CHECK (id = 1), tdee INTEGER NOT NULL DEFAULT 0, protein INTEGER NOT NULL DEFAULT 0, log_day TEXT NOT NULL DEFAULT ''); CREATE TABLE IF NOT EXISTS nutrition_staples (id TEXT PRIMARY KEY, name TEXT NOT NULL, calories INTEGER NOT NULL, protein INTEGER NOT NULL DEFAULT 0, ingredients_json TEXT, sort_order INTEGER NOT NULL DEFAULT 0); CREATE TABLE IF NOT EXISTS nutrition_regulars (id TEXT PRIMARY KEY, name TEXT NOT NULL, calories INTEGER NOT NULL, protein INTEGER NOT NULL DEFAULT 0, ingredients_json TEXT, sort_order INTEGER NOT NULL DEFAULT 0); CREATE TABLE IF NOT EXISTS nutrition_entries (id TEXT NOT NULL, log_day TEXT NOT NULL, kind TEXT NOT NULL, ref_id TEXT, label TEXT NOT NULL, calories INTEGER NOT NULL, protein INTEGER NOT NULL DEFAULT 0, count INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (id, log_day));",
                        kind: MigrationKind::Up,
                    },
                    Migration {
                        version: 6,
                        description: "streak_tracker_tables",
                        sql: "CREATE TABLE IF NOT EXISTS streak_activities (id TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT '', description TEXT, frequency TEXT NOT NULL DEFAULT 'daily', weekly_target INTEGER, scheduled_days_json TEXT, can_fail INTEGER NOT NULL DEFAULT 0, archived_at TEXT, sort_order INTEGER NOT NULL DEFAULT 0); CREATE TABLE IF NOT EXISTS streak_log_cells (log_date TEXT NOT NULL, activity_id TEXT NOT NULL, state TEXT NOT NULL, updated_at TEXT NOT NULL, PRIMARY KEY (log_date, activity_id)); CREATE TABLE IF NOT EXISTS streak_activity_meta (activity_id TEXT PRIMARY KEY, start_date TEXT, pause_since TEXT, unpaused_at TEXT, reset_count INTEGER NOT NULL DEFAULT 0);",
                        kind: MigrationKind::Up,
                    },
                    Migration {
                        version: 7,
                        description: "nutrition_protein_real",
                        sql: "CREATE TABLE nutrition_config_new (id INTEGER PRIMARY KEY CHECK (id = 1), tdee INTEGER NOT NULL DEFAULT 0, protein REAL NOT NULL DEFAULT 0, log_day TEXT NOT NULL DEFAULT ''); INSERT INTO nutrition_config_new SELECT id, tdee, CAST(protein AS REAL), log_day FROM nutrition_config; DROP TABLE nutrition_config; ALTER TABLE nutrition_config_new RENAME TO nutrition_config; CREATE TABLE nutrition_staples_new (id TEXT PRIMARY KEY, name TEXT NOT NULL, calories INTEGER NOT NULL, protein REAL NOT NULL DEFAULT 0, ingredients_json TEXT, sort_order INTEGER NOT NULL DEFAULT 0); INSERT INTO nutrition_staples_new SELECT id, name, calories, CAST(protein AS REAL), ingredients_json, sort_order FROM nutrition_staples; DROP TABLE nutrition_staples; ALTER TABLE nutrition_staples_new RENAME TO nutrition_staples; CREATE TABLE nutrition_regulars_new (id TEXT PRIMARY KEY, name TEXT NOT NULL, calories INTEGER NOT NULL, protein REAL NOT NULL DEFAULT 0, ingredients_json TEXT, sort_order INTEGER NOT NULL DEFAULT 0); INSERT INTO nutrition_regulars_new SELECT id, name, calories, CAST(protein AS REAL), ingredients_json, sort_order FROM nutrition_regulars; DROP TABLE nutrition_regulars; ALTER TABLE nutrition_regulars_new RENAME TO nutrition_regulars; CREATE TABLE nutrition_entries_new (id TEXT NOT NULL, log_day TEXT NOT NULL, kind TEXT NOT NULL, ref_id TEXT, label TEXT NOT NULL, calories INTEGER NOT NULL, protein REAL NOT NULL DEFAULT 0, count INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (id, log_day)); INSERT INTO nutrition_entries_new SELECT id, log_day, kind, ref_id, label, calories, CAST(protein AS REAL), count, updated_at, deleted FROM nutrition_entries; DROP TABLE nutrition_entries; ALTER TABLE nutrition_entries_new RENAME TO nutrition_entries;",
                        kind: MigrationKind::Up,
                    },
                    Migration {
                        version: 8,
                        description: "water_tracker_tables",
                        sql: "CREATE TABLE IF NOT EXISTS water_config (id INTEGER PRIMARY KEY CHECK (id = 1), target_ml INTEGER NOT NULL DEFAULT 2500, log_day TEXT NOT NULL DEFAULT ''); CREATE TABLE IF NOT EXISTS water_entries (id TEXT NOT NULL, log_day TEXT NOT NULL, label TEXT NOT NULL, ml INTEGER NOT NULL, count INTEGER NOT NULL DEFAULT 1, updated_at TEXT NOT NULL, deleted INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (id, log_day));",
                        kind: MigrationKind::Up,
                    },
                    Migration {
                        version: 9,
                        description: "streak_activity_cross_log_columns",
                        sql: "ALTER TABLE streak_activities ADD COLUMN extra_calories INTEGER; ALTER TABLE streak_activities ADD COLUMN extra_protein REAL; ALTER TABLE streak_activities ADD COLUMN extra_water_ml INTEGER;",
                        kind: MigrationKind::Up,
                    },
                ],
            ).build())
        .setup(|app| {
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Regular);
            #[cfg(desktop)]
            {
                use tauri_plugin_autostart::ManagerExt;

                let autostart_manager = app.autolaunch();
                let _ = autostart_manager.enable();
                info!("registered for autostart? {}", autostart_manager.is_enabled().unwrap_or(false));
            }

            let translations = Arc::new(Translations::new(&app.path()));

            let app_state = AppState {
                posture_debouncer: Arc::new(Mutex::new(PostureDebouncer::new())),
                monitoring_active: Arc::new(Mutex::new(false)),
                force_capture_now: Arc::new(Mutex::new(false)),
                camera_yield_paused: Arc::new(Mutex::new(false)),
                camera_capturing: Arc::new(AtomicBool::new(false)),
                camera_stream_held: Arc::new(AtomicBool::new(false)),
                camera: Arc::new(Mutex::new(None)),
                last_alert_time: Arc::new(Mutex::new(Instant::now() - Duration::from_secs(60))),
                alert_messages: Arc::new(Mutex::new(Vec::new())),
                selected_camera_index: Arc::new(Mutex::new(0)),
                monitoring_interval_secs: Arc::new(Mutex::new(3)),
                translations: translations,
                current_language: Arc::new(Mutex::new("en".to_string())),
                battery_saving_mode: Arc::new(Mutex::new(false)),
                menu_bar_only: Arc::new(Mutex::new(false)),
                hide_to_menu_bar_on_close: Arc::new(Mutex::new(false)),
                hidden_to_menu_bar: Arc::new(Mutex::new(false)),
                flow_active: Arc::new(Mutex::new(false)),
                tray: Arc::new(Mutex::new(None)),
            };
            app.manage(app_state.clone());

            if let Err(e) = app_presence::install_tray(app.handle(), &app_state) {
                error!("Failed to install menu bar tray on startup: {e}");
            }

            camera_watch::start_camera_watch(app.handle().clone(), app_state.clone());
            flow_lid_pause::start_flow_lid_pause_watch(app.handle().clone());

            let alert_app_handle = app.handle().clone();
            let alert_state = app_state.clone();
            tauri::async_runtime::spawn(async move {
                background_alert_task(alert_app_handle, alert_state).await;
            });

            let monitor_app_handle = app.handle().clone();
            let monitor_state = app_state.clone();
            tauri::async_runtime::spawn(async move {
                background_monitoring_task(monitor_app_handle, monitor_state).await;
            });

            info!("Posture analysis runs in the webview; Rust captures preview frames only.");
            info!("Management application initialized");
            Ok(())
        })
        .on_window_event(|window, event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                let state = window.state::<AppState>();
                if app_presence::handle_window_close_requested(window.app_handle(), &state) {
                    api.prevent_close();
                }
            }
            tauri::WindowEvent::Destroyed => {
                let state = window.state::<AppState>();
                release_camera(&state, "window destroyed");
            }
            _ => {}
        })
        .invoke_handler(tauri::generate_handler![
            initialize_pose_model,
            start_monitoring,
            stop_monitoring,
            submit_posture_analysis,
            clear_posture_debouncer,
            get_alert_messages,
            get_monitoring_status,
            request_preview_frame,
            test_model_status,
            save_calibrated_image,
            delete_calibrated_image,
            set_detection_settings,
            get_available_cameras,
            set_selected_camera,
            set_monitoring_interval,
            set_current_language,
            set_battery_saving_mode,
            set_app_presence_mode,
            get_app_presence_mode,
            set_hide_to_menu_bar_on_close,
            focus_main_window,
            set_tray_session_label,
            set_session_tray_timer_enabled,
            set_tray_flow_active,
            notify_session_phase,
            restart_app,
            sync_http::sync_http_fetch
        ])
        .run(tauri::generate_context!());

    if let Err(error) = run_result {
        error!("Failed to run Tauri application: {}", error);
    }
}
