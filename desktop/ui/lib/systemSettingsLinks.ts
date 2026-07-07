import { Command, open } from '@tauri-apps/plugin-shell';
import { platform } from '@tauri-apps/plugin-os';

export type SystemSettingsTarget = 'camera' | 'notifications';

const cameraLinuxMessage =
  'Linux may not provide a direct camera permission window for this app. Close other apps using the webcam, restart Management, and re-select the camera. If you use Flatpak or Snap, also verify portal/sandbox camera permissions.';

const manualMessages: Record<SystemSettingsTarget, string> = {
  camera: 'Unable to open settings. Go to System Settings > Privacy & Security > Camera and allow Management.',
  notifications: 'Unable to open settings. Go to System Settings > Notifications and allow Management.'
};

const directMessages: Record<SystemSettingsTarget, string> = {
  camera: 'Allow camera access in System Settings > Privacy & Security > Camera.',
  notifications: 'Allow notifications in System Settings > Notifications.'
};

export const openSystemSettings = async (target: SystemSettingsTarget): Promise<void> => {
  try {
    const osPlatform = await platform();
    if (target === 'camera') {
      if (osPlatform === 'macos') {
        await Command.create('open-settings', ['x-apple.systempreferences:com.apple.preference.security?Privacy_Camera']).execute();
        return;
      }
      if (osPlatform === 'windows') {
        await open('ms-settings:privacy-webcam');
        return;
      }
      if (osPlatform === 'linux') {
        alert(cameraLinuxMessage);
        return;
      }
      alert(directMessages.camera);
      return;
    }
    if (osPlatform === 'macos') {
      await Command.create('open-settings', ['x-apple.systempreferences:com.apple.preference.notifications']).execute();
      return;
    }
    if (osPlatform === 'windows') {
      await open('ms-settings:notifications');
      return;
    }
    alert(directMessages.notifications);
  } catch (error) {
    console.error(`Failed to open ${target} settings:`, error);
    alert(manualMessages[target]);
  }
};
