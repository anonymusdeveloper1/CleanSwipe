/**
 * Single source of truth for the app's outward-facing contact + legal endpoints.
 *
 * These were previously duplicated across screens (`SUPPORT_EMAIL` in the
 * settings screen and the since-removed licenses screen, `TERMS_OF_USE_URL` in
 * both the premium screen and the upgrade sheet) with `PRIVACY_POLICY_URL`
 * exported from a SCREEN that two other modules imported. Changing the support
 * address then meant editing several files and hoping none were missed.
 *
 * Change the address or a URL HERE and every surface follows.
 */

/**
 * Where "Leave feedback", "Report a bug" and the LGPL source request are sent.
 *
 * Used to build a `mailto:` URI, so it must be a bare address — no display name,
 * no angle brackets. NOTE: the recipient's mail app may render this as a saved
 * CONTACT NAME rather than the raw address; that is the mail client's display
 * behaviour, not a wrong recipient.
 */
export const SUPPORT_EMAIL = "info.cognitix@gmail.com";

/** Published privacy policy. Linked from Settings, the paywall and the upgrade sheet. */
export const PRIVACY_POLICY_URL = "https://effervescent-douhua-6f5c1d.netlify.app";

/**
 * Terms of Use. Apple's standard EULA — required by App Store review when a
 * paywall is shown, and reused on Android for consistency.
 */
export const TERMS_OF_USE_URL = "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/";
