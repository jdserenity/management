/** Central keys for browser localStorage. */

export const MGMT_LS = {
  batterySavingMode: 'mgmt_battery_saving_mode',
  cameraIndex: 'mgmt_camera_index',
  cameraName: 'mgmt_camera_name',
  cameraDeviceLegacy: 'mgmt_camera_device',
  notificationFrequency: 'mgmt_notification_frequency',
  turtleNeckSensitivity: 'mgmt_turtle_neck_sensitivity',
  shoulderSensitivity: 'mgmt_shoulder_sensitivity',
  monitoringInterval: 'mgmt_monitoring_interval',
  poorPostureThreshold: 'mgmt_poor_posture_threshold',
  postureMonitoringEnabled: 'mgmt_posture_monitoring_enabled',
} as const;
