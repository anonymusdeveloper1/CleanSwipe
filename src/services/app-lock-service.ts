import { requireOptionalNativeModule } from "expo-modules-core";

/**
 * App-lock secure storage + biometric authentication.
 *
 * CRITICAL (same lesson as src/features/smart-clean/native-capabilities.ts): the
 * native sides of `expo-secure-store` and `expo-local-authentication` only exist
 * after a gradle rebuild of the dev client. We must NEVER top-level-import their
 * wrappers to probe — evaluating a wrapper runs its top-level
 * `requireNativeModule(...)`, which throws "Cannot find native module" and Metro
 * surfaces that as an uncaught error (a dev red box / a release crash) even when
 * the dynamic import is caught. So we probe by native-module NAME via
 * `requireOptionalNativeModule` (returns null, never throws) and only
 * `import("expo-secure-store")` / `import("expo-local-authentication")` AFTER the
 * matching probe returns true.
 *
 * Everything FAILS OPEN: when a module is unavailable (current APK, or any error)
 * `hasPasscode()` resolves false and `verifyPasscode()` resolves false in a way
 * the gate treats as "cannot lock", so a missing module never strands the user
 * behind a lock screen they can't clear. Setup is blocked up-front when secure
 * storage is unavailable, so app-lock can never be enabled without a working
 * store to verify against.
 */

const PASSCODE_KEY = "swipeclean.app-lock.passcode";

export type BiometricKind = "face" | "fingerprint" | "iris" | "generic";

export type BiometricCapability = {
  available: boolean; // hardware present AND at least one credential enrolled
  enrolled: boolean;
  kind: BiometricKind;
};

export type BiometricResult = {
  success: boolean;
  cancelled: boolean;
  error?: string;
};

let secureStoreAvailable: boolean | undefined;
let biometricModuleAvailable: boolean | undefined;
let passcodePresenceCache: boolean | undefined;

function probe(names: string[]): boolean {
  try {
    return names.some((name) => requireOptionalNativeModule(name) != null);
  } catch {
    return false;
  }
}

/** Whether the encrypted passcode store (expo-secure-store) is usable on this build. */
export function isSecureStoreAvailable(): boolean {
  if (secureStoreAvailable === undefined) {
    secureStoreAvailable = probe(["ExpoSecureStore"]);
  }
  return secureStoreAvailable;
}

/** Whether the biometric module (expo-local-authentication) is present on this build. */
export function isBiometricModuleAvailable(): boolean {
  if (biometricModuleAvailable === undefined) {
    biometricModuleAvailable = probe(["ExpoLocalAuthentication"]);
  }
  return biometricModuleAvailable;
}

async function getSecureStore() {
  if (!isSecureStoreAvailable()) return undefined;
  try {
    return await import("expo-secure-store");
  } catch {
    secureStoreAvailable = false;
    return undefined;
  }
}

async function getLocalAuth() {
  if (!isBiometricModuleAvailable()) return undefined;
  try {
    return await import("expo-local-authentication");
  } catch {
    biometricModuleAvailable = false;
    return undefined;
  }
}

export const AppLockService = {
  isSecureStoreAvailable,
  isBiometricModuleAvailable,

  /** Reports hardware + enrollment so Settings can show the right biometric label/state. */
  async getBiometricCapability(): Promise<BiometricCapability> {
    const LocalAuthentication = await getLocalAuth();
    if (!LocalAuthentication) return { available: false, enrolled: false, kind: "generic" };
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      let kind: BiometricKind = "generic";
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) kind = "face";
      else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) kind = "fingerprint";
      else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) kind = "iris";
      return { available: hasHardware && enrolled, enrolled, kind };
    } catch {
      return { available: false, enrolled: false, kind: "generic" };
    }
  },

  /** Prompt the system biometric sheet. `cancelled` is true when the user dismissed it. */
  async authenticateBiometric(promptMessage: string, cancelLabel: string): Promise<BiometricResult> {
    const LocalAuthentication = await getLocalAuth();
    if (!LocalAuthentication) return { success: false, cancelled: true, error: "unavailable" };
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage,
        cancelLabel,
        // Fall back to OUR passcode pad, not the device PIN, so the flow stays in-app.
        disableDeviceFallback: true,
        requireConfirmation: false
      });
      if (result.success) return { success: true, cancelled: false };
      const error = "error" in result ? result.error : undefined;
      const cancelled = error === "user_cancel" || error === "system_cancel" || error === "app_cancel" || error === "user_fallback";
      return { success: false, cancelled, error };
    } catch (error) {
      return { success: false, cancelled: true, error: error instanceof Error ? error.message : "biometric_error" };
    }
  },

  async hasPasscode(): Promise<boolean> {
    if (passcodePresenceCache !== undefined) return passcodePresenceCache;
    const SecureStore = await getSecureStore();
    if (!SecureStore) {
      passcodePresenceCache = false;
      return false;
    }
    try {
      const stored = await SecureStore.getItemAsync(PASSCODE_KEY);
      passcodePresenceCache = typeof stored === "string" && stored.length > 0;
      return passcodePresenceCache;
    } catch {
      return false;
    }
  },

  /** Persist a new passcode. Returns false when secure storage is unavailable. */
  async setPasscode(passcode: string): Promise<boolean> {
    const SecureStore = await getSecureStore();
    if (!SecureStore) return false;
    try {
      await SecureStore.setItemAsync(PASSCODE_KEY, passcode);
      passcodePresenceCache = true;
      return true;
    } catch {
      return false;
    }
  },

  async verifyPasscode(passcode: string): Promise<boolean> {
    const SecureStore = await getSecureStore();
    if (!SecureStore) return false;
    try {
      const stored = await SecureStore.getItemAsync(PASSCODE_KEY);
      const hasStoredPasscode = typeof stored === "string" && stored.length > 0;
      passcodePresenceCache = hasStoredPasscode;
      return hasStoredPasscode && stored === passcode;
    } catch {
      return false;
    }
  },

  async clearPasscode(): Promise<void> {
    const SecureStore = await getSecureStore();
    if (!SecureStore) return;
    try {
      await SecureStore.deleteItemAsync(PASSCODE_KEY);
      passcodePresenceCache = false;
    } catch {
      // Best-effort: a failed clear leaves the old passcode, which still verifies.
    }
  }
};

export const PASSCODE_LENGTH = 4;
