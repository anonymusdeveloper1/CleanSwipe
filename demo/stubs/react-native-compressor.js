/**
 * Expo Go demo stub for `react-native-compressor`.
 *
 * The real library is a third-party NATIVE module that is NOT part of the Expo Go
 * runtime, so importing it there crashes the app. Metro aliases this stub in its
 * place ONLY when EXPO_PUBLIC_EXPO_GO_DEMO=1 (see metro.config.js). Compression is
 * intentionally disabled in the demo:
 *   - Image/Video.compress reject with a clear message → jobs fail gracefully
 *     (the compression store maps failures to a friendly message).
 *   - getFileSize resolves undefined → callers fall back to size estimates.
 *   - createVideoThumbnail resolves to the source uri so video list cells don't
 *     throw (they just won't show a real frame).
 *
 * NO native build sets the demo flag, so device/EAS builds always use the real
 * module. This file is plain JS and is never type-checked or bundled otherwise.
 */
const unavailable = (what) =>
  Promise.reject(new Error(`${what} is not available in the Expo Go demo build.`));

const Image = {
  compress: () => unavailable("Image compression")
};

const Video = {
  compress: () => unavailable("Video compression"),
  cancelCompression: () => undefined
};

const createVideoThumbnail = (uri) => Promise.resolve({ path: uri });

const getFileSize = async () => undefined;

module.exports = { Image, Video, createVideoThumbnail, getFileSize };
