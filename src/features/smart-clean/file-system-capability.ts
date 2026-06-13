import { probeCapability } from "@/features/smart-clean/native-capabilities";

/**
 * Lazy, capability-gated MD5 of a readable local file URI. Returns undefined
 * when expo-file-system's native side is absent (current APK) or on any error,
 * so the duplicate detector degrades to "not_available" instead of crashing.
 *
 * No top-level import of expo-file-system — only a lazy dynamic import here.
 */
export async function computeMd5(localUri: string): Promise<string | undefined> {
  if (!(await probeCapability("fileHashing"))) return undefined;
  try {
    const FS: any = await import("expo-file-system/legacy");
    const info = await FS.getInfoAsync(localUri, { md5: true });
    return typeof info?.md5 === "string" ? info.md5 : undefined;
  } catch {
    return undefined;
  }
}
