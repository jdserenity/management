use nokhwa::{
    pixel_format::RgbFormat,
    utils::{CameraIndex, RequestedFormat, RequestedFormatType},
    Buffer, Camera,
};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Mutex, MutexGuard};
use std::time::Duration;

/// Returns true when monitoring is on but capture should wait (another app has the camera).
pub fn should_defer_capture(monitoring_active: bool, camera_yield_paused: bool) -> bool {
    monitoring_active && camera_yield_paused
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CaptureStrategy {
    Skip,
    Ephemeral,
    Continuous,
}

pub fn capture_strategy(
    monitoring_active: bool,
    camera_yield_paused: bool,
    battery_saving_mode: bool,
) -> CaptureStrategy {
    if !monitoring_active || camera_yield_paused {
        CaptureStrategy::Skip
    } else if battery_saving_mode {
        CaptureStrategy::Ephemeral
    } else {
        CaptureStrategy::Continuous
    }
}

fn lock_camera_slot<'a>(mutex: &'a Mutex<Option<Camera>>) -> MutexGuard<'a, Option<Camera>> {
    match mutex.lock() {
        Ok(guard) => guard,
        Err(poisoned) => poisoned.into_inner(),
    }
}

/// Stops any open continuous stream so another app (e.g. FaceTime) can use the camera.
pub fn stop_continuous_camera(
    camera_slot: &Mutex<Option<Camera>>,
    stream_held: &AtomicBool,
    reason: &str,
) {
    stream_held.store(false, Ordering::Release);
    let camera_to_stop = {
        let mut cam_lock = lock_camera_slot(camera_slot);
        cam_lock.take()
    };

    if let Some(mut cam) = camera_to_stop {
        if cam.is_stream_open() {
            if let Err(e) = cam.stop_stream() {
                log::warn!("{}: failed to stop camera stream: {}", reason, e);
            } else {
                log::info!("{}: camera stream stopped", reason);
            }
        }
    }
}

/// Keeps a single open stream for normal (non–battery-saving) monitoring.
pub fn ensure_continuous_stream(
    camera_slot: &Mutex<Option<Camera>>,
    stream_held: &AtomicBool,
    selected_index: u32,
) -> bool {
    {
        let mut cam_lock = lock_camera_slot(camera_slot);
        if let Some(cam) = cam_lock.as_mut() {
            if cam.is_stream_open() {
                stream_held.store(true, Ordering::Release);
                return true;
            }
            if cam.open_stream().is_ok() {
                stream_held.store(true, Ordering::Release);
                log::info!("Restarted continuous camera stream (index={})", selected_index);
                return true;
            }
            log::warn!(
                "Failed to restart continuous stream (index={}); will recreate",
                selected_index
            );
            *cam_lock = None;
        }
    }

    stream_held.store(false, Ordering::Release);
    let requested = RequestedFormat::new::<RgbFormat>(RequestedFormatType::AbsoluteHighestFrameRate);

    match Camera::new(CameraIndex::Index(selected_index), requested) {
        Ok(mut cam) => match cam.open_stream() {
            Ok(_) => {
                log::info!("Started continuous camera stream (index={})", selected_index);
                stream_held.store(true, Ordering::Release);
                *lock_camera_slot(camera_slot) = Some(cam);
                true
            }
            Err(e) => {
                log::error!(
                    "Failed to start continuous camera stream (index={}): {}",
                    selected_index,
                    e
                );
                false
            }
        },
        Err(e) => {
            log::error!(
                "Failed to initialize continuous camera (index={}): {}",
                selected_index,
                e
            );
            false
        }
    }
}

pub fn capture_continuous_frame(camera_slot: &Mutex<Option<Camera>>) -> Option<Buffer> {
    let mut cam_lock = lock_camera_slot(camera_slot);
    let cam = cam_lock.as_mut()?;
    if cam.is_stream_open() {
        cam.frame().ok()
    } else {
        None
    }
}

/// Battery-saving mode: open, one frame, close each cycle.
pub async fn capture_ephemeral_frame(selected_index: u32) -> Option<Buffer> {
    let requested_types = [
        RequestedFormatType::HighestFrameRate(15),
        RequestedFormatType::HighestFrameRate(10),
        RequestedFormatType::AbsoluteHighestFrameRate,
        RequestedFormatType::None,
    ];

    for requested_type in requested_types {
        let requested = RequestedFormat::new::<RgbFormat>(requested_type);

        let mut cam = match Camera::new(CameraIndex::Index(selected_index), requested) {
            Ok(cam) => cam,
            Err(_) => continue,
        };

        if cam.open_stream().is_err() {
            continue;
        }

        tokio::time::sleep(Duration::from_millis(700)).await;

        let mut frame_captured = None;
        for attempt in 1..=3 {
            match cam.frame() {
                Ok(buffer) => {
                    if attempt > 1 {
                        log::info!("Ephemeral capture succeeded after {} retries", attempt - 1);
                    }
                    frame_captured = Some(buffer);
                    break;
                }
                Err(e) => {
                    log::warn!(
                        "Ephemeral frame capture failed ({:?}, attempt={}): {}",
                        requested_type,
                        attempt,
                        e
                    );
                    tokio::time::sleep(Duration::from_millis(250)).await;
                }
            }
        }

        if let Err(e) = cam.stop_stream() {
            log::warn!("Ephemeral capture: failed to close stream ({:?}): {}", requested_type, e);
        }

        if frame_captured.is_some() {
            return frame_captured;
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::{capture_strategy, should_defer_capture, CaptureStrategy};

    #[test]
    fn defers_only_when_monitoring_and_yield_paused() {
        assert!(!should_defer_capture(false, false));
        assert!(!should_defer_capture(false, true));
        assert!(!should_defer_capture(true, false));
        assert!(should_defer_capture(true, true));
    }

    #[test]
    fn continuous_only_when_monitoring_and_not_yielding_or_battery_saving() {
        assert_eq!(
            capture_strategy(false, false, false),
            CaptureStrategy::Skip
        );
        assert_eq!(capture_strategy(true, true, false), CaptureStrategy::Skip);
        assert_eq!(
            capture_strategy(true, false, true),
            CaptureStrategy::Ephemeral
        );
        assert_eq!(
            capture_strategy(true, false, false),
            CaptureStrategy::Continuous
        );
    }
}
