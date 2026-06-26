use tauri::AppHandle;

#[cfg(target_os = "macos")]
pub fn start_flow_suspend_watch(app: AppHandle) {
  macos::start(app);
}

#[cfg(not(target_os = "macos"))]
pub fn start_flow_suspend_watch(_app: AppHandle) {}

#[cfg(target_os = "macos")]
mod macos {
  use std::ptr::NonNull;

  use block2::RcBlock;
  use objc2::rc::Retained;
  use objc2::{define_class, msg_send, sel, DefinedClass, MainThreadMarker, MainThreadOnly};
  use objc2_app_kit::{
    NSWorkspace, NSWorkspaceScreensDidSleepNotification, NSWorkspaceWillSleepNotification,
  };
  use objc2_foundation::{
    NSDistributedNotificationCenter, NSNotification, NSObject, NSObjectProtocol, NSNotificationName,
    NSString,
  };
  use tauri::{AppHandle, Emitter};

  fn emit_flow_suspend(app: &AppHandle) {
    let _ = app.emit("flow-suspend", ());
  }

  fn observe_workspace_notification(app: AppHandle, name: &'static NSNotificationName) {
    let workspace = NSWorkspace::sharedWorkspace();
    let center = workspace.notificationCenter();
    let app2 = app.clone();
    let block = RcBlock::new(move |_notification: NonNull<NSNotification>| {
      emit_flow_suspend(&app2);
    });
    unsafe {
      let observer = center.addObserverForName_object_queue_usingBlock(Some(name), None, None, &block);
      std::mem::forget(observer);
      std::mem::forget(block);
    }
  }

  #[derive(Debug)]
  struct ScreenLockObserverIvars {
    app: AppHandle,
  }

  define_class!(
    #[unsafe(super(NSObject))]
    #[thread_kind = MainThreadOnly]
    #[ivars = ScreenLockObserverIvars]
    struct ScreenLockObserver;

    unsafe impl NSObjectProtocol for ScreenLockObserver {}

    impl ScreenLockObserver {
      #[unsafe(method(screenLocked:))]
      fn screen_locked(&self, _notification: &NSNotification) {
        emit_flow_suspend(&self.ivars().app);
      }
    }
  );

  impl ScreenLockObserver {
    fn new(mtm: MainThreadMarker, app: AppHandle) -> Retained<Self> {
      let this = Self::alloc(mtm);
      let this = this.set_ivars(ScreenLockObserverIvars { app });
      unsafe { msg_send![super(this), init] }
    }
  }

  pub fn start(app: AppHandle) {
    let _mtm = MainThreadMarker::new().expect("flow suspend watch must run on the main thread");
    unsafe {
      observe_workspace_notification(app.clone(), NSWorkspaceWillSleepNotification);
      observe_workspace_notification(app.clone(), NSWorkspaceScreensDidSleepNotification);
    }
    let screen_lock = ScreenLockObserver::new(_mtm, app);
    let center = NSDistributedNotificationCenter::defaultCenter();
    let name = NSString::from_str("com.apple.screenIsLocked");
    unsafe {
      center.addObserver_selector_name_object(screen_lock.as_ref(), sel!(screenLocked:), Some(&name), None);
    }
    std::mem::forget(screen_lock);
  }
}
