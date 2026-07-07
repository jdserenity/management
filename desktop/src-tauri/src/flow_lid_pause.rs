use tauri::AppHandle;

#[cfg(target_os = "macos")]
pub fn start_flow_lid_pause_watch(app: AppHandle) {
  macos::start(app);
}

#[cfg(not(target_os = "macos"))]
pub fn start_flow_lid_pause_watch(_app: AppHandle) {}

#[cfg(target_os = "macos")]
mod macos {
  use std::ptr::NonNull;

  use block2::RcBlock;
  use objc2_app_kit::{
    NSWorkspace, NSWorkspaceScreensDidSleepNotification, NSWorkspaceScreensDidWakeNotification,
  };
  use objc2_foundation::{NSNotification, NSNotificationName};
  use tauri::{AppHandle, Emitter};

  fn observe_screen_notification(app: AppHandle, name: &'static NSNotificationName, event: &'static str) {
    let workspace = NSWorkspace::sharedWorkspace();
    let center = workspace.notificationCenter();
    let app2 = app.clone();
    let event = event.to_string();
    let block = RcBlock::new(move |_notification: NonNull<NSNotification>| {
      let _ = app2.emit(&event, ());
    });
    unsafe {
      let observer = center.addObserverForName_object_queue_usingBlock(Some(name), None, None, &block);
      std::mem::forget(observer);
      std::mem::forget(block);
    }
  }

  pub fn start(app: AppHandle) {
    unsafe {
      observe_screen_notification(app.clone(), NSWorkspaceScreensDidSleepNotification, "flow-lid-pause");
      observe_screen_notification(app, NSWorkspaceScreensDidWakeNotification, "flow-lid-resume");
    }
  }
}
