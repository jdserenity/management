use log::{error, info};
use tauri::{
  image::Image,
  menu::{Menu, MenuItem, PredefinedMenuItem},
  path::BaseDirectory,
  tray::TrayIconBuilder,
  AppHandle, Emitter, Manager,
};

use crate::{lock_or_recover, release_camera, AppState};

fn load_resource_icon(app: &AppHandle, filename: &str) -> Result<Image<'static>, String> {
  let icon_path = app.path().resolve(format!("icons/{filename}"), BaseDirectory::Resource).map_err(|e| e.to_string())?;
  let bytes = std::fs::read(&icon_path).map_err(|e| format!("Failed to read icon file: {e}"))?;
  Image::from_bytes(&bytes).map_err(|e| format!("Failed to create icon image: {e}"))
}

fn set_tray_icon(app: &AppHandle, state: &AppState, filename: &str) {
  if let Some(tray) = lock_or_recover(&state.tray).as_ref() {
    match load_resource_icon(app, filename) {
      Ok(icon) => {
        if let Err(e) = tray.set_icon(Some(icon)) {
          error!("Failed to update tray icon: {}", e);
        }
      }
      Err(e) => error!("Failed to load tray icon {filename}: {e}"),
    }
  }
}

pub fn set_tray_icon_active(app: &AppHandle, state: &AppState) {
  set_tray_icon(app, state, "tray.png");
}

pub fn set_tray_icon_monitoring_off(app: &AppHandle, state: &AppState) {
  set_tray_icon(app, state, "monitoring_off.png");
}

pub const MODE_DOCK: &str = "dock";
pub const MODE_MENU_BAR: &str = "menu_bar";
/// Single tray id so toggling menu-bar timer off removes the same icon from the system.
pub const TRAY_ICON_ID: &str = "management-tray";

pub fn normalize_app_presence_mode(mode: &str) -> &'static str {
  match mode.trim().to_ascii_lowercase().as_str() {
    "menu_bar" | "menubar" | "menu-bar" => MODE_MENU_BAR,
    _ => MODE_DOCK,
  }
}

pub fn is_menu_bar_only_mode(mode: &str) -> bool {
  normalize_app_presence_mode(mode) == MODE_MENU_BAR
}

fn show_main_window(app: &AppHandle, state: &AppState) {
  let _ = exit_hidden_to_menu_bar_if_needed(app, state);
  if let Some(window) = app.get_webview_window("main") {
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
  }
}

pub fn hide_main_window(app: &AppHandle) {
  if let Some(window) = app.get_webview_window("main") {
    let _ = window.hide();
  }
}

pub fn focus_main_window(app: &AppHandle, state: &AppState, dock_bounce: bool) {
  let _ = exit_hidden_to_menu_bar_if_needed(app, state);
  if let Some(window) = app.get_webview_window("main") {
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
    #[cfg(target_os = "macos")]
    if dock_bounce {
      let _ = window.request_user_attention(Some(tauri::UserAttentionType::Critical));
    }
  }
}

pub fn set_tray_session_label(_app: &AppHandle, state: &AppState, label: Option<&str>) {
  if let Some(tray) = lock_or_recover(&state.tray).as_ref() {
    let trimmed = label.map(str::trim).filter(|s| !s.is_empty());
    // macOS keeps the last title when set_title(None); empty string clears it.
    #[cfg(target_os = "macos")]
    let title = trimmed.or(Some(""));
    #[cfg(not(target_os = "macos"))]
    let title = trimmed;
    if let Err(e) = tray.set_title(title) {
      error!("Failed to set tray title: {}", e);
    }
  }
}

fn build_tray_menu(app: &AppHandle, flow_active: bool) -> Result<Menu<tauri::Wry>, String> {
  let quit = PredefinedMenuItem::quit(app, Some("Quit Management")).map_err(|e| e.to_string())?;
  let show = MenuItem::with_id(app, "show", "Show App", true, None::<&str>).map_err(|e| e.to_string())?;
  let start_flow = MenuItem::with_id(app, "start_focus_flow", "Start focus flow", true, None::<&str>).map_err(|e| e.to_string())?;
  let start_monitoring_item = MenuItem::with_id(app, "start_monitoring", "Start Monitoring", true, None::<&str>).map_err(|e| e.to_string())?;
  let stop_monitoring_item = MenuItem::with_id(app, "stop_monitoring", "Stop Monitoring", true, None::<&str>).map_err(|e| e.to_string())?;
  let sep = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
  if flow_active {
    return Menu::with_items(app, &[&start_monitoring_item, &stop_monitoring_item, &sep, &show, &quit]).map_err(|e| e.to_string());
  }
  Menu::with_items(app, &[&start_flow, &sep, &start_monitoring_item, &stop_monitoring_item, &sep, &show, &quit]).map_err(|e| e.to_string())
}

fn build_timer_tray_menu(app: &AppHandle, flow_active: bool) -> Result<Menu<tauri::Wry>, String> {
  let quit = PredefinedMenuItem::quit(app, Some("Quit Management")).map_err(|e| e.to_string())?;
  let show = MenuItem::with_id(app, "show", "Show App", true, None::<&str>).map_err(|e| e.to_string())?;
  let start_flow = MenuItem::with_id(app, "start_focus_flow", "Start focus flow", true, None::<&str>).map_err(|e| e.to_string())?;
  let sep = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
  if flow_active {
    return Menu::with_items(app, &[&show, &sep, &quit]).map_err(|e| e.to_string());
  }
  Menu::with_items(app, &[&start_flow, &sep, &show, &sep, &quit]).map_err(|e| e.to_string())
}

fn handle_tray_menu_event(app: &AppHandle, event_id: &str) {
  let state = app.state::<AppState>();
  match event_id {
    "quit" => app.exit(0),
    "show" => show_main_window(app, state.inner()),
    "start_focus_flow" => {
      let _ = app.emit("tray-start-focus-flow", ());
      let app = app.clone();
      let flow_state = state.inner().clone();
      tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(150)).await;
        if menu_bar_only_from_state(&flow_state) || hidden_to_menu_bar_from_state(&flow_state) {
          hide_main_window(&app);
        }
      });
    }
    "start_monitoring" => {
      info!("'Start Monitoring' clicked");
      *lock_or_recover(&state.monitoring_active) = true;
      *lock_or_recover(&state.camera_yield_paused) = false;
      *lock_or_recover(&state.force_capture_now) = true;
      set_tray_icon_active(app, state.inner());
      let _ = app.emit("monitoring-state-changed", &serde_json::json!({ "active": true }));
    }
    "stop_monitoring" => {
      info!("'Stop Monitoring' clicked");
      *lock_or_recover(&state.monitoring_active) = false;
      *lock_or_recover(&state.force_capture_now) = false;
      *lock_or_recover(&state.camera_yield_paused) = false;
      release_camera(&state, "tray stop_monitoring action");
      set_tray_icon_monitoring_off(app, state.inner());
      let _ = app.emit("monitoring-state-changed", &serde_json::json!({ "active": false }));
    }
    _ => {}
  }
}

pub fn flow_active_from_state(state: &AppState) -> bool {
  *lock_or_recover(&state.flow_active)
}

pub fn apply_tray_flow_active(app: &AppHandle, state: &AppState, active: bool) -> Result<(), String> {
  *lock_or_recover(&state.flow_active) = active;
  sync_tray_installation(app, state)
}

pub fn install_tray(app: &AppHandle, state: &AppState, timer_only: bool) -> Result<(), String> {
  remove_tray(app, state);
  let flow_active = flow_active_from_state(state);
  let tray_icon = load_resource_icon(app, "tray.png")?;
  let menu = if timer_only { build_timer_tray_menu(app, flow_active)? } else { build_tray_menu(app, flow_active)? };
  let tray = TrayIconBuilder::with_id(TRAY_ICON_ID)
    .icon(tray_icon)
    .tooltip("Management")
    .menu(&menu)
    .on_menu_event(|app, event| handle_tray_menu_event(app, event.id.as_ref()))
    .build(app)
    .map_err(|e| e.to_string())?;
  *lock_or_recover(&state.tray) = Some(tray);
  Ok(())
}

pub fn remove_tray(app: &AppHandle, state: &AppState) {
  *lock_or_recover(&state.tray) = None;
  if let Some(tray) = app.remove_tray_by_id(TRAY_ICON_ID) {
    drop(tray);
    info!("Tray icon removed ({})", TRAY_ICON_ID);
  }
}

pub fn apply_app_presence_mode(app: &AppHandle, state: &AppState, mode: &str) -> Result<(), String> {
  let menu_bar_only = is_menu_bar_only_mode(mode);
  *lock_or_recover(&state.menu_bar_only) = menu_bar_only;
  if menu_bar_only {
    *lock_or_recover(&state.hidden_to_menu_bar) = false;
  }
  #[cfg(target_os = "macos")]
  {
    let policy = if menu_bar_only || hidden_to_menu_bar_from_state(state) {
      tauri::ActivationPolicy::Accessory
    } else {
      tauri::ActivationPolicy::Regular
    };
    app.set_activation_policy(policy).map_err(|e| e.to_string())?;
  }
  sync_tray_installation(app, state)?;
  if !menu_bar_only && !hidden_to_menu_bar_from_state(state) && !session_tray_timer_from_state(state) {
    if let Some(window) = app.get_webview_window("main") {
      let _ = window.unminimize();
      let _ = window.show();
    }
  }
  info!("App presence mode applied: {}", normalize_app_presence_mode(mode));
  Ok(())
}

pub fn menu_bar_only_from_state(state: &AppState) -> bool {
  *lock_or_recover(&state.menu_bar_only)
}

pub fn hide_to_menu_bar_on_close_from_state(state: &AppState) -> bool {
  *lock_or_recover(&state.hide_to_menu_bar_on_close)
}

pub fn hidden_to_menu_bar_from_state(state: &AppState) -> bool {
  *lock_or_recover(&state.hidden_to_menu_bar)
}

pub fn session_tray_timer_from_state(state: &AppState) -> bool {
  *lock_or_recover(&state.session_tray_timer)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TrayInstallPlan {
  None,
  Full,
  TimerOnly,
}

pub fn tray_install_plan(menu_bar_only: bool, hidden_to_menu_bar: bool, session_tray_timer: bool) -> TrayInstallPlan {
  if menu_bar_only || hidden_to_menu_bar {
    TrayInstallPlan::Full
  } else if session_tray_timer {
    TrayInstallPlan::TimerOnly
  } else {
    TrayInstallPlan::None
  }
}

pub fn sync_tray_installation(app: &AppHandle, state: &AppState) -> Result<(), String> {
  let plan = tray_install_plan(
    menu_bar_only_from_state(state),
    hidden_to_menu_bar_from_state(state),
    session_tray_timer_from_state(state),
  );
  remove_tray(app, state);
  match plan {
    TrayInstallPlan::Full => install_tray(app, state, false)?,
    TrayInstallPlan::TimerOnly => install_tray(app, state, true)?,
    TrayInstallPlan::None => {}
  }
  Ok(())
}

pub fn enter_hidden_to_menu_bar(app: &AppHandle, state: &AppState) -> Result<(), String> {
  *lock_or_recover(&state.hidden_to_menu_bar) = true;
  #[cfg(target_os = "macos")]
  app.set_activation_policy(tauri::ActivationPolicy::Accessory).map_err(|e| e.to_string())?;
  sync_tray_installation(app, state)
}

pub fn exit_hidden_to_menu_bar_if_needed(app: &AppHandle, state: &AppState) -> Result<(), String> {
  if !hidden_to_menu_bar_from_state(state) || menu_bar_only_from_state(state) {
    return Ok(());
  }
  *lock_or_recover(&state.hidden_to_menu_bar) = false;
  #[cfg(target_os = "macos")]
  app.set_activation_policy(tauri::ActivationPolicy::Regular).map_err(|e| e.to_string())?;
  sync_tray_installation(app, state)
}

pub fn apply_hide_to_menu_bar_on_close(app: &AppHandle, state: &AppState, enabled: bool) -> Result<(), String> {
  *lock_or_recover(&state.hide_to_menu_bar_on_close) = enabled;
  if !enabled {
    exit_hidden_to_menu_bar_if_needed(app, state)?;
  }
  Ok(())
}

/// Returns true when the close event was handled (window hidden, app kept running).
pub fn handle_window_close_requested(app: &AppHandle, state: &AppState) -> bool {
  if menu_bar_only_from_state(state) {
    hide_main_window(app);
    return true;
  }
  if hide_to_menu_bar_on_close_from_state(state) {
    hide_main_window(app);
    if let Err(e) = enter_hidden_to_menu_bar(app, state) {
      error!("Failed to enter hidden-to-menu-bar mode: {e}");
    }
    return true;
  }
  false
}

pub fn apply_session_tray_timer(app: &AppHandle, state: &AppState, enabled: bool) -> Result<(), String> {
  *lock_or_recover(&state.session_tray_timer) = enabled;
  sync_tray_installation(app, state)
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn normalize_defaults_unknown_to_dock() {
    assert_eq!(normalize_app_presence_mode(""), MODE_DOCK);
    assert_eq!(normalize_app_presence_mode("regular"), MODE_DOCK);
  }

  #[test]
  fn normalize_accepts_menu_bar_aliases() {
    assert_eq!(normalize_app_presence_mode("menu_bar"), MODE_MENU_BAR);
    assert_eq!(normalize_app_presence_mode("Menu-Bar"), MODE_MENU_BAR);
    assert_eq!(normalize_app_presence_mode(" menubar "), MODE_MENU_BAR);
  }

  #[test]
  fn tray_install_plan_prefers_full_tray_for_menu_bar_or_hidden() {
    assert_eq!(tray_install_plan(true, false, false), TrayInstallPlan::Full);
    assert_eq!(tray_install_plan(false, true, false), TrayInstallPlan::Full);
    assert_eq!(tray_install_plan(false, false, true), TrayInstallPlan::TimerOnly);
    assert_eq!(tray_install_plan(false, false, false), TrayInstallPlan::None);
  }

  #[test]
  fn tray_install_plan_hidden_beats_timer_only() {
    assert_eq!(tray_install_plan(false, true, true), TrayInstallPlan::Full);
  }
}
