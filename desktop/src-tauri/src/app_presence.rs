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
        // Keep solid white pixels; template mode recolors and washes the icon out.
        #[cfg(target_os = "macos")]
        {
          let _ = tray.set_icon_as_template(false);
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
    #[cfg(target_os = "macos")]
    let title = trimmed.or(Some(""));
    #[cfg(not(target_os = "macos"))]
    let title = trimmed;
    if let Err(e) = tray.set_title(title) {
      error!("Failed to set tray title: {}", e);
    }
  }
}

fn build_tray_menu(app: &AppHandle, state: &AppState) -> Result<Menu<tauri::Wry>, String> {
  let quit = MenuItem::with_id(app, "quit", "Quit Management", true, None::<&str>).map_err(|e| e.to_string())?;
  let show = MenuItem::with_id(app, "show", "Show App", true, None::<&str>).map_err(|e| e.to_string())?;
  let start_flow = MenuItem::with_id(app, "start_focus_flow", "Start focus flow", true, None::<&str>).map_err(|e| e.to_string())?;
  let start_monitoring_item = MenuItem::with_id(app, "start_monitoring", "Start Monitoring", true, None::<&str>).map_err(|e| e.to_string())?;
  let stop_monitoring_item = MenuItem::with_id(app, "stop_monitoring", "Stop Monitoring", true, None::<&str>).map_err(|e| e.to_string())?;
  let sep = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
  let sep2 = PredefinedMenuItem::separator(app).map_err(|e| e.to_string())?;
  let work_enabled = work_enabled_from_state(state);
  let posture_enabled = posture_enabled_from_state(state);
  let flow_active = flow_active_from_state(state);
  match (work_enabled, posture_enabled, flow_active) {
    (false, false, _) | (true, false, true) => {
      Menu::with_items(app, &[&show, &quit]).map_err(|e| e.to_string())
    }
    (true, false, false) => {
      Menu::with_items(app, &[&start_flow, &sep, &show, &quit]).map_err(|e| e.to_string())
    }
    (false, true, _) | (true, true, true) => {
      Menu::with_items(app, &[&start_monitoring_item, &stop_monitoring_item, &sep, &show, &quit]).map_err(|e| e.to_string())
    }
    (true, true, false) => {
      Menu::with_items(app, &[&start_flow, &sep, &start_monitoring_item, &stop_monitoring_item, &sep2, &show, &quit]).map_err(|e| e.to_string())
    }
  }
}

/// Item ids (no separators) for the current feature + flow state.
pub(crate) fn tray_menu_ids(flow_active: bool, work_enabled: bool, posture_enabled: bool) -> Vec<&'static str> {
  let mut ids = Vec::new();
  if work_enabled && !flow_active {
    ids.push("start_focus_flow");
  }
  if posture_enabled {
    ids.push("start_monitoring");
    ids.push("stop_monitoring");
  }
  ids.push("show");
  ids.push("quit");
  ids
}

/// Only the tray “Quit Management” item should fully terminate the process.
pub fn request_full_exit(app: &AppHandle, state: &AppState) {
  *lock_or_recover(&state.allow_full_exit) = true;
  remove_tray(app, state);
  app.exit(0);
}

pub fn allow_full_exit_from_state(state: &AppState) -> bool {
  *lock_or_recover(&state.allow_full_exit)
}

fn handle_tray_menu_event(app: &AppHandle, event_id: &str) {
  let state = app.state::<AppState>();
  match event_id {
    "quit" => request_full_exit(app, state.inner()),
    "show" => show_main_window(app, state.inner()),
    "start_focus_flow" => {
      if !work_enabled_from_state(state.inner()) {
        return;
      }
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
      if !posture_enabled_from_state(state.inner()) {
        return;
      }
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

pub fn work_enabled_from_state(state: &AppState) -> bool {
  *lock_or_recover(&state.work_enabled)
}

pub fn posture_enabled_from_state(state: &AppState) -> bool {
  *lock_or_recover(&state.posture_enabled)
}

pub fn apply_ui_features(app: &AppHandle, state: &AppState, work: bool, posture: bool) -> Result<(), String> {
  *lock_or_recover(&state.work_enabled) = work;
  *lock_or_recover(&state.posture_enabled) = posture;
  refresh_tray_menu(app, state)
}

/// Update flow state and refresh tray menu items in place (no remove/rebuild).
pub fn apply_tray_flow_active(app: &AppHandle, state: &AppState, active: bool) -> Result<(), String> {
  *lock_or_recover(&state.flow_active) = active;
  refresh_tray_menu(app, state)
}

/// Install tray once. Safe to call if already installed — no-ops without tearing down.
pub fn install_tray(app: &AppHandle, state: &AppState) -> Result<(), String> {
  if lock_or_recover(&state.tray).is_some() {
    return Ok(());
  }
  // Clean up any orphan system tray with our id (e.g. crash recovery), then create once.
  if let Some(orphan) = app.remove_tray_by_id(TRAY_ICON_ID) {
    drop(orphan);
  }
  let tray_icon = load_resource_icon(app, "tray.png")?;
  let menu = build_tray_menu(app, state)?;
  let mut builder = TrayIconBuilder::with_id(TRAY_ICON_ID)
    .icon(tray_icon)
    .tooltip("Management")
    .menu(&menu)
    .on_menu_event(|app, event| handle_tray_menu_event(app, event.id.as_ref()));
  #[cfg(target_os = "macos")]
  {
    builder = builder.icon_as_template(false);
  }
  let tray = builder.build(app).map_err(|e| e.to_string())?;
  *lock_or_recover(&state.tray) = Some(tray);
  info!("Tray icon installed ({})", TRAY_ICON_ID);
  Ok(())
}

/// Swap tray menu without destroying the icon (avoids menu-bar flicker).
pub fn refresh_tray_menu(app: &AppHandle, state: &AppState) -> Result<(), String> {
  if lock_or_recover(&state.tray).is_none() {
    return install_tray(app, state);
  }
  let menu = build_tray_menu(app, state)?;
  if let Some(tray) = lock_or_recover(&state.tray).as_ref() {
    tray.set_menu(Some(menu)).map_err(|e| e.to_string())?;
  }
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
    let policy = if menu_bar_only {
      tauri::ActivationPolicy::Accessory
    } else {
      tauri::ActivationPolicy::Regular
    };
    app.set_activation_policy(policy).map_err(|e| e.to_string())?;
  }
  // Tray is always present; only create if missing, never rebuild for mode changes.
  install_tray(app, state)?;
  if !menu_bar_only {
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

pub fn exit_hidden_to_menu_bar_if_needed(_app: &AppHandle, state: &AppState) -> Result<(), String> {
  // Flag only — we no longer flip ActivationPolicy on hide/show (that recreated the Dock icon).
  *lock_or_recover(&state.hidden_to_menu_bar) = false;
  Ok(())
}

pub fn apply_hide_to_menu_bar_on_close(_app: &AppHandle, state: &AppState, enabled: bool) -> Result<(), String> {
  *lock_or_recover(&state.hide_to_menu_bar_on_close) = enabled;
  let _ = hide_to_menu_bar_on_close_from_state(state);
  Ok(())
}

/// Window close (red X): hide the window only. Tray is never touched.
pub fn handle_window_close_requested(app: &AppHandle, state: &AppState) -> bool {
  hide_main_window(app);
  *lock_or_recover(&state.hidden_to_menu_bar) = true;
  true
}

/// Cmd+Q / Dock Quit: hide the window and stay alive unless tray Quit set allow_full_exit.
/// Does not rebuild the tray.
pub fn handle_exit_requested(app: &AppHandle, state: &AppState) -> bool {
  if allow_full_exit_from_state(state) {
    return false;
  }
  hide_main_window(app);
  *lock_or_recover(&state.hidden_to_menu_bar) = true;
  true
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
  fn tray_menu_parked_is_show_and_quit_only() {
    assert_eq!(tray_menu_ids(false, false, false), vec!["show", "quit"]);
    assert_eq!(tray_menu_ids(true, false, false), vec!["show", "quit"]);
  }

  #[test]
  fn tray_menu_includes_work_and_posture_when_enabled() {
    assert_eq!(
      tray_menu_ids(false, true, true),
      vec!["start_focus_flow", "start_monitoring", "stop_monitoring", "show", "quit"]
    );
    assert_eq!(
      tray_menu_ids(true, true, true),
      vec!["start_monitoring", "stop_monitoring", "show", "quit"]
    );
  }

  #[test]
  fn tray_menu_work_only_omits_start_flow_while_active() {
    assert_eq!(tray_menu_ids(false, true, false), vec!["start_focus_flow", "show", "quit"]);
    assert_eq!(tray_menu_ids(true, true, false), vec!["show", "quit"]);
  }
}
