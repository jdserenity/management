use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

/// First-launch logical size. Width is the Daily-tab floor (`minWidth` in tauri.conf.json).
pub const DEFAULT_WIDTH: u32 = 800;
pub const DEFAULT_HEIGHT: u32 = 800;
pub const MIN_WIDTH: u32 = 800;
pub const MIN_HEIGHT: u32 = 600;

const APP_DIR_NAME: &str = "com.diamari.management";
const WINDOW_SIZE_FILE: &str = "window-size.json";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct SavedWindowSize {
  pub width: u32,
  pub height: u32,
}

pub fn saved_size_path_in(config_dir: &Path) -> PathBuf {
  config_dir.join(APP_DIR_NAME).join(WINDOW_SIZE_FILE)
}

pub fn saved_size_path() -> Option<PathBuf> {
  dirs::config_dir().map(|dir| saved_size_path_in(&dir))
}

pub fn logical_from_physical(physical_width: u32, physical_height: u32, scale: f64) -> (u32, u32) {
  let scale = if scale > 0.0 { scale } else { 1.0 };
  let width = (physical_width as f64 / scale).round() as u32;
  let height = (physical_height as f64 / scale).round() as u32;
  (width, height)
}

pub fn clamp_size(width: u32, height: u32) -> SavedWindowSize {
  SavedWindowSize { width: width.max(MIN_WIDTH), height: height.max(MIN_HEIGHT) }
}

/// Ignore sizes until restore has finished, and skip empty/minimized reports.
pub fn size_to_save(ready: bool, logical_width: u32, logical_height: u32) -> Option<SavedWindowSize> {
  if !ready || logical_width == 0 || logical_height == 0 { return None; }
  Some(clamp_size(logical_width, logical_height))
}

pub fn parse_saved_size(json: &str) -> Option<SavedWindowSize> {
  let size: SavedWindowSize = serde_json::from_str(json).ok()?;
  if size.width == 0 || size.height == 0 { return None; }
  Some(clamp_size(size.width, size.height))
}

pub fn serialize_saved_size(size: SavedWindowSize) -> String {
  serde_json::to_string(&size).unwrap_or_else(|_| format!(r#"{{"width":{},"height":{}}}"#, DEFAULT_WIDTH, DEFAULT_HEIGHT))
}

pub fn load_saved_size(path: &Path) -> Option<SavedWindowSize> {
  let json = std::fs::read_to_string(path).ok()?;
  parse_saved_size(&json)
}

pub fn save_size(path: &Path, size: SavedWindowSize) -> std::io::Result<()> {
  if let Some(parent) = path.parent() { std::fs::create_dir_all(parent)?; }
  std::fs::write(path, serialize_saved_size(size))
}

pub fn restore_main_window(app: &tauri::AppHandle) {
  use tauri::Manager;
  let Some(window) = app.get_webview_window("main") else { return };
  let Some(path) = saved_size_path() else { return };
  let Some(size) = load_saved_size(&path) else { return };
  let _ = window.set_size(tauri::LogicalSize::new(size.width, size.height));
}

pub fn persist_physical_size(ready: bool, physical_width: u32, physical_height: u32, scale: f64) {
  if !ready { return; }
  let (width, height) = logical_from_physical(physical_width, physical_height, scale);
  let Some(size) = size_to_save(true, width, height) else { return };
  let Some(path) = saved_size_path() else { return };
  if let Err(e) = save_size(&path, size) {
    log::warn!("Failed to save window size: {e}");
  }
}

pub fn persist_from_window(window: &tauri::Window, ready: bool) {
  let Ok(physical) = window.inner_size() else { return };
  let Ok(scale) = window.scale_factor() else { return };
  persist_physical_size(ready, physical.width, physical.height, scale);
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::time::{SystemTime, UNIX_EPOCH};

  #[test]
  fn defaults_are_daily_tab_min_width_and_current_height() {
    assert_eq!(DEFAULT_WIDTH, 800);
    assert_eq!(DEFAULT_HEIGHT, 800);
    assert_eq!(MIN_WIDTH, 800);
    assert_eq!(MIN_HEIGHT, 600);
  }

  #[test]
  fn tauri_conf_default_size_matches_constants() {
    let conf = std::fs::read_to_string("tauri.conf.json").expect("tauri.conf.json");
    let v: serde_json::Value = serde_json::from_str(&conf).expect("json");
    let win = &v["app"]["windows"][0];
    assert_eq!(win["width"], DEFAULT_WIDTH);
    assert_eq!(win["height"], DEFAULT_HEIGHT);
    assert_eq!(win["minWidth"], MIN_WIDTH);
    assert_eq!(win["minHeight"], MIN_HEIGHT);
  }

  #[test]
  fn path_lives_next_to_local_db() {
    let path = saved_size_path_in(Path::new("/tmp/app-support"));
    assert_eq!(path, PathBuf::from("/tmp/app-support/com.diamari.management/window-size.json"));
  }

  #[test]
  fn retina_physical_converts_to_logical() {
    assert_eq!(logical_from_physical(1600, 1600, 2.0), (800, 800));
    assert_eq!(logical_from_physical(800, 800, 1.0), (800, 800));
    assert_eq!(logical_from_physical(800, 800, 0.0), (800, 800));
  }

  #[test]
  fn size_to_save_waits_until_restore_and_skips_empty() {
    assert_eq!(size_to_save(false, 1000, 800), None);
    assert_eq!(size_to_save(true, 0, 800), None);
    assert_eq!(size_to_save(true, 1000, 0), None);
    assert_eq!(size_to_save(true, 1000, 900), Some(SavedWindowSize { width: 1000, height: 900 }));
  }

  #[test]
  fn size_to_save_clamps_below_minimum() {
    assert_eq!(size_to_save(true, 400, 400), Some(SavedWindowSize { width: MIN_WIDTH, height: MIN_HEIGHT }));
  }

  #[test]
  fn parse_rejects_garbage_and_empty() {
    assert_eq!(parse_saved_size("not json"), None);
    assert_eq!(parse_saved_size(r#"{"width":0,"height":800}"#), None);
    assert_eq!(parse_saved_size(r#"{"width":960,"height":820}"#), Some(SavedWindowSize { width: 960, height: 820 }));
  }

  #[test]
  fn save_then_load_roundtrip() {
    let nanos = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
    let dir = std::env::temp_dir().join(format!("mgmt-window-size-{nanos}"));
    let path = saved_size_path_in(&dir);
    let size = SavedWindowSize { width: 960, height: 820 };
    save_size(&path, size).expect("write");
    assert_eq!(load_saved_size(&path), Some(size));
    assert_eq!(load_saved_size(&dir.join("missing.json")), None);
    let _ = std::fs::remove_dir_all(&dir);
  }
}
