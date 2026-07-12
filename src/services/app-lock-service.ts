import { requireOptionalNativeModule } from "expo-modules-core";
import { sha256Hex } from "@/utils/sha256";

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
const ATTEMPTS_KEY = "swipeclean.app-lock.attempts";

// Rate-limiting: the first few misses are free (fat-finger tolerance), then an
// exponential lockout throttles brute force over the 10,000-PIN space.
const FREE_ATTEMPTS = 4;
const BASE_LOCK_MS = 30_000; // 30s after the 5th miss…
const MAX_LOCK_MS = 5 * 60_000; // …doubling, capped at 5 minutes.

type StoredPasscode = { v: 1; salt: string; hash: string };
type AttemptRecord = { fails: number; lockedUntil: number };

/**
 * Per-install salt. Math.random() is not a CSPRNG, but the salt's only job is to
 * defeat precomputed rainbow tables — and a 4-digit PIN is brute-forceable from
 * any salt regardless. SecureStore encryption is the real at-rest protection.
 */
function randomSalt(): string {
  let salt = "";
  for (let i = 0; i < 32; i++) salt += Math.floor(Math.random() * 16).toString(16);
  return salt;
}

function parsePasscode(stored: string | null): StoredPasscode | null {
  if (typeof stored !== "string" || stored.length === 0) return null;
  try {
    const parsed = JSON.parse(stored) as Partial<StoredPasscode>;
    if (parsed && parsed.v === 1 && typeof parsed.salt === "string" && typeof parsed.hash === "string") {
      return { v: 1, salt: parsed.salt, hash: parsed.hash };
    }
  } catch {
    // Not JSON → legacy plaintext value from a build before hashing landed.
  }
  return null;
}

/** True when `passcode` matches whatever is stored (hashed or legacy plaintext). */
function matchesStored(stored: string | null, passcode: string): boolean {
  if (typeof stored !== "string" || stored.length === 0) return false;
  const parsed = parsePasscode(stored);
  if (parsed) return sha256Hex(parsed.salt + passcode) === parsed.hash;
  return stored === passcode; // legacy plaintext (migrated to a hash on success)
}

type SecureStoreModule = typeof import("expo-secure-store");

async function writeHashedPasscode(SecureStore: SecureStoreModule, passcode: string): Promise<void> {
  const salt = randomSalt();
  const payload: StoredPasscode = { v: 1, salt, hash: sha256Hex(salt + passcode) };
  await SecureStore.setItemAsync(PASSCODE_KEY, JSON.stringify(payload));
}

async function readAttempts(SecureStore: SecureStoreModule): Promise<AttemptRecord> {
  try {
    const raw = await SecureStore.getItemAsync(ATTEMPTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AttemptRecord>;
      return { fails: Number(parsed.fails) || 0, lockedUntil: Number(parsed.lockedUntil) || 0 };
    }
  } catch {
    // Corrupt/absent record → start clean.
  }
  return { fails: 0, lockedUntil: 0 };
}

async function clearAttempts(SecureStore: SecureStoreModule): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(ATTEMPTS_KEY);
  } catch {
    // Best-effort.
  }
}

async function registerFailure(SecureStore: SecureStoreModule, current: AttemptRecord): Promise<void> {
  const fails = current.fails + 1;
  let lockedUntil = 0;
  if (fails > FREE_ATTEMPTS) {
    const lockMs = Math.min(BASE_LOCK_MS * 2 ** (fails - FREE_ATTEMPTS - 1), MAX_LOCK_MS);
    lockedUntil = Date.now() + lockMs;
  }
  try {
    await SecureStore.setItemAsync(ATTEMPTS_KEY, JSON.stringify({ fails, lockedUntil }));
  } catch {
    // Best-effort: a failed write just means no throttle this round.
  }
}

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

  /** Persist a new passcode (salted SHA-256, never plaintext). Returns false when secure storage is unavailable. */
  async setPasscode(passcode: string): Promise<boolean> {
    const SecureStore = await getSecureStore();
    if (!SecureStore) return false;
    try {
      await writeHashedPasscode(SecureStore, passcode);
      await clearAttempts(SecureStore); // a fresh/changed PIN clears any lockout
      passcodePresenceCache = true;
      return true;
    } catch {
      return false;
    }
  },

  /** Milliseconds remaining on the current lockout (0 when unlocked). */
  async getLockRemainingMs(): Promise<number> {
    const SecureStore = await getSecureStore();
    if (!SecureStore) return 0;
    const record = await readAttempts(SecureStore);
    return Math.max(0, record.lockedUntil - Date.now());
  },

  async verifyPasscode(passcode: string): Promise<boolean> {
    const SecureStore = await getSecureStore();
    if (!SecureStore) return false;
    try {
      // Rate limit: during a lockout, reject without even comparing so a brute
      // force can't keep guessing. A correct PIN entered while locked is also
      // rejected — the user must wait out the (short) backoff.
      const record = await readAttempts(SecureStore);
      if (record.lockedUntil > Date.now()) return false;

      const stored = await SecureStore.getItemAsync(PASSCODE_KEY);
      passcodePresenceCache = typeof stored === "string" && stored.length > 0;
      const ok = matchesStored(stored, passcode);

      if (ok) {
        // Lazy migration: an old plaintext passcode is re-persisted as a salted
        // hash on the first successful verify (also clears the attempt counter).
        if (stored && !parsePasscode(stored)) {
          await writeHashedPasscode(SecureStore, passcode);
        }
        await clearAttempts(SecureStore);
        return true;
      }

      await registerFailure(SecureStore, record);
      return false;
    } catch {
      return false;
    }
  },

  async clearPasscode(): Promise<void> {
    const SecureStore = await getSecureStore();
    if (!SecureStore) return;
    try {
      await SecureStore.deleteItemAsync(PASSCODE_KEY);
      await clearAttempts(SecureStore);
      passcodePresenceCache = false;
    } catch {
      // Best-effort: a failed clear leaves the old passcode, which still verifies.
    }
  }
};

export const PASSCODE_LENGTH = 4;
