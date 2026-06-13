import { AppSettings } from "@/models/photo";

export const defaultSettings: AppSettings = {
  // Biometric/app-lock default OFF — they require an explicit passcode setup
  // before they can guard anything (a true default would lock nothing).
  biometricAuthEnabled: false,
  appLockEnabled: false,
  darkModeEnabled: false,
  accentColor: "blue",
  language: "system",
  notificationsEnabled: true,
  cleanupRemindersEnabled: true,
  compressionRemindersEnabled: true,
  proNotificationsEnabled: true,
  afterCompressionOriginalPolicy: "ask_every_time"
};
