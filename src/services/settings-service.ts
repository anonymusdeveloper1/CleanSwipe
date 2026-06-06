import { AppSettings } from "@/models/photo";

export const defaultSettings: AppSettings = {
  biometricAuthEnabled: true,
  appLockEnabled: false,
  darkModeEnabled: false,
  accentColor: "blue",
  language: "en",
  notificationsEnabled: true,
  cleanupRemindersEnabled: true,
  analyticsCollectionEnabled: false,
  usageDataCollectionEnabled: false,
  errorReportingEnabled: true
};
