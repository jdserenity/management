use log::{error, info, warn};
use tauri::{
  image::Image,
  menu::{Menu, MenuItem, PredefinedMenuItem},
  path::BaseDirectory,
  tray::TrayIconBuilder,
  AppHandle, Emitter, Manager,
};

use crate::{lock_or_recover, release_camera, AppState};

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

fn show_main_window(app: &AppHandle) {
  if let Some(window) = app.get_webview_window("main") {
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
  }
}

pub fn focus_main_window(app: &AppHandle, dock_bounce: bool) {
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
    "show" => show_main_window(app),
    "start_focus_flow" => {
      let _ = app.emit("tray-start-focus-flow", ());
    }
    "start_monitoring" => {
      info!("'Start Monitoring' clicked");
      *lock_or_recover(&state.monitoring_active) = true;
      *lock_or_recover(&state.camera_yield_paused) = false;
      *lock_or_recover(&state.force_capture_now) = true;
      if let Some(tray) = lock_or_recover(&state.tray).as_ref() {
        if let Some(default_icon) = app.default_window_icon() {
          if let Err(e) = tray.set_icon(Some(default_icon.clone())) {
            error!("Failed to update tray icon: {}", e);
          }
        } else {
          warn!("Default window icon not found; skipping tray icon update.");
        }
      }
      let _ = app.emit("monitoring-state-changed", &serde_json::json!({ "active": true }));
    }
    "stop_monitoring" => {
      info!("'Stop Monitoring' clicked");
      *lock_or_recover(&state.monitoring_active) = false;
      *lock_or_recover(&state.force_capture_now) = false;
      *lock_or_recover(&state.camera_yield_paused) = false;
      release_camera(&state, "tray stop_monitoring action");
      if let Some(tray) = lock_or_recover(&state.tray).as_ref() {
        if let Ok(monitoring_off_icon_path) = app.path().resolve("icons/monitoring_off.png", BaseDirectory::Resource) {
          if let Ok(bytes) = std::fs::read(&monitoring_off_icon_path) {
            if let Ok(monitoring_off_icon) = Image::from_bytes(&bytes) {
              if let Err(e) = tray.set_icon(Some(monitoring_off_icon)) {
                error!("Failed to update tray icon: {}", e);
              }
            } else {
              error!("Failed to create icon image");
            }
          } else {
            error!("Failed to read icon file");
          }
        } else {
          error!("Failed to resolve icon path");
        }
      }
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
  let default_icon = app
    .default_window_icon()
    .cloned()
    .ok_or_else(|| "Default window icon not found".to_string())?;
  let menu = if timer_only { build_timer_tray_menu(app, flow_active)? } else { build_tray_menu(app, flow_active)? };
  let tray = TrayIconBuilder::with_id(TRAY_ICON_ID)
    .icon(default_icon)
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
  #[cfg(target_os = "macos")]
  {
    let policy = if menu_bar_only {
      tauri::ActivationPolicy::Accessory
    } else {
      tauri::ActivationPolicy::Regular
    };
    app.set_activation_policy(policy).map_err(|e| e.to_string())?;
  }
  sync_tray_installation(app, state)?;
  if !menu_bar_only && !session_tray_timer_from_state(state) {
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

pub fn session_tray_timer_from_state(state: &AppState) -> bool {
  *lock_or_recover(&state.session_tray_timer)
}

pub fn sync_tray_installation(app: &AppHandle, state: &AppState) -> Result<(), String> {
  let menu_bar_only = menu_bar_only_from_state(state);
  let session_tray_timer = session_tray_timer_from_state(state);
  remove_tray(app, state);
  if menu_bar_only {
    install_tray(app, state, false)?;
  } else if session_tray_timer {
    install_tray(app, state, true)?;
  }
  Ok(())
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
}
