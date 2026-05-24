#[cfg(target_os = "macos")]
pub use macos::{is_camera_in_use_elsewhere, start_camera_watch};

/// Returns true when the physical camera is active and this app is not the holder.
#[cfg(not(target_os = "macos"))]
pub fn is_camera_in_use_elsewhere(_we_hold_stream: bool, _capturing_frame: bool) -> bool {
    false
}

#[cfg(not(target_os = "macos"))]
pub fn start_camera_watch(_app: tauri::AppHandle, _state: crate::AppState) {}

pub(crate) const fn fourcc(bytes: &[u8; 4]) -> u32 {
    u32::from_be_bytes(*bytes)
}

#[cfg(test)]
mod tests {
    use super::fourcc;

    #[test]
    fn fourcc_matches_apple_cmio_constants() {
        assert_eq!(fourcc(b"dev#"), 0x64657623);
        assert_eq!(fourcc(b"run>"), 0x72756e3e);
        assert_eq!(fourcc(b"glob"), 0x676c6f62);
    }
}

#[cfg(target_os = "macos")]
mod macos {
    use super::fourcc;
    use crate::lock_or_recover;
    use crate::AppState;
    use log::info;
    use std::ffi::c_void;
    use std::sync::atomic::Ordering;
    use tauri::Emitter;

    type CMIOObjectID = u32;
    type OSStatus = i32;

    const NO_ERR: OSStatus = 0;
    const K_CMIO_OBJECT_SYSTEM_OBJECT: CMIOObjectID = 1;
    const PROP_DEVICES: u32 = fourcc(b"dev#");
    const PROP_RUNNING: u32 = fourcc(b"run>");
    const SCOPE_GLOBAL: u32 = fourcc(b"glob");
    const ELEMENT_MASTER: u32 = 0;

    #[repr(C)]
    struct CMIOObjectPropertyAddress {
        selector: u32,
        scope: u32,
        element: u32,
    }

    #[link(name = "CoreMediaIO", kind = "framework")]
    extern "C" {
        fn CMIOObjectGetPropertyDataSize(
            object_id: CMIOObjectID,
            address: *const CMIOObjectPropertyAddress,
            qualifier_data_size: u32,
            qualifier_data: *const c_void,
            data_size: *mut u32,
        ) -> OSStatus;

        fn CMIOObjectGetPropertyData(
            object_id: CMIOObjectID,
            address: *const CMIOObjectPropertyAddress,
            qualifier_data_size: u32,
            qualifier_data: *const c_void,
            data_size: u32,
            data_used: *mut u32,
            data: *mut c_void,
        ) -> OSStatus;
    }

    fn running_address() -> CMIOObjectPropertyAddress {
        CMIOObjectPropertyAddress {
            selector: PROP_RUNNING,
            scope: SCOPE_GLOBAL,
            element: ELEMENT_MASTER,
        }
    }

    fn devices_address() -> CMIOObjectPropertyAddress {
        CMIOObjectPropertyAddress {
            selector: PROP_DEVICES,
            scope: SCOPE_GLOBAL,
            element: ELEMENT_MASTER,
        }
    }

    fn list_video_device_ids() -> Vec<CMIOObjectID> {
        let address = devices_address();
        let mut data_size = 0u32;
        let status = unsafe {
            CMIOObjectGetPropertyDataSize(
                K_CMIO_OBJECT_SYSTEM_OBJECT,
                &address,
                0,
                std::ptr::null(),
                &mut data_size,
            )
        };
        if status != NO_ERR || data_size == 0 || data_size % std::mem::size_of::<CMIOObjectID>() as u32 != 0 {
            return Vec::new();
        }

        let count = data_size as usize / std::mem::size_of::<CMIOObjectID>();
        let mut devices = vec![0u32; count];
        let mut data_used = 0u32;
        let status = unsafe {
            CMIOObjectGetPropertyData(
                K_CMIO_OBJECT_SYSTEM_OBJECT,
                &address,
                0,
                std::ptr::null(),
                data_size,
                &mut data_used,
                devices.as_mut_ptr() as *mut c_void,
            )
        };
        if status != NO_ERR {
            return Vec::new();
        }
        devices
    }

    fn device_is_running(device_id: CMIOObjectID) -> bool {
        let address = running_address();
        let mut running: u32 = 0;
        let mut data_used = 0u32;
        let status = unsafe {
            CMIOObjectGetPropertyData(
                device_id,
                &address,
                0,
                std::ptr::null(),
                std::mem::size_of::<u32>() as u32,
                &mut data_used,
                &mut running as *mut u32 as *mut c_void,
            )
        };
        status == NO_ERR && running != 0
    }

    pub fn is_camera_in_use_elsewhere(we_hold_stream: bool, capturing_frame: bool) -> bool {
        if we_hold_stream || capturing_frame {
            return false;
        }
        list_video_device_ids().into_iter().any(device_is_running)
    }

    fn apply_yield_state(app: &tauri::AppHandle, state: &AppState) {
        let we_hold_stream = state.camera_stream_held.load(Ordering::Acquire);
        let capturing_frame = state.camera_capturing.load(Ordering::Acquire);
        let in_use_elsewhere = is_camera_in_use_elsewhere(we_hold_stream, capturing_frame);
        let was_paused = *lock_or_recover(&state.camera_yield_paused);

        if in_use_elsewhere && !was_paused {
            crate::camera_capture::stop_continuous_camera(
                &state.camera,
                &state.camera_stream_held,
                "yield: camera in use elsewhere",
            );
            *lock_or_recover(&state.camera_yield_paused) = true;
            *lock_or_recover(&state.force_capture_now) = false;
            let _ = app.emit(
                "camera-yield-changed",
                &serde_json::json!({ "paused": true, "reason": "in_use" }),
            );
            info!("Posture capture paused — camera in use elsewhere");
        } else if !in_use_elsewhere && was_paused {
            *lock_or_recover(&state.camera_yield_paused) = false;
            if *lock_or_recover(&state.monitoring_active) {
                *lock_or_recover(&state.force_capture_now) = true;
            }
            let _ = app.emit(
                "camera-yield-changed",
                &serde_json::json!({ "paused": false, "reason": "available" }),
            );
            info!("Posture capture resumed — camera available");
        }
    }

    pub fn start_camera_watch(app: tauri::AppHandle, state: AppState) {
        tauri::async_runtime::spawn(async move {
            loop {
                tokio::time::sleep(std::time::Duration::from_millis(500)).await;
                if !*lock_or_recover(&state.monitoring_active) {
                    if *lock_or_recover(&state.camera_yield_paused) {
                        *lock_or_recover(&state.camera_yield_paused) = false;
                    }
                    continue;
                }
                apply_yield_state(&app, &state);
            }
        });
        info!("macOS camera yield watcher started (CMIO polling)");
    }
}
