#include <jni.h>
#include <stdlib.h>
#include <stdio.h>
#include <string.h>
#include "lame.h"

// JNI bridge to LAME. Takes interleaved 16-bit PCM (as produced by the module's
// MediaCodec decode step) and CBR-encodes it to an MP3 file. Returns 0 on success
// or a negative error code.
//
// Matches Kotlin: object LameBridge { external fun nativeEncode(...) : Int }

#define PCM_CHUNK 8192 /* samples per channel per encode call */

JNIEXPORT jint JNICALL
Java_expo_modules_swipecleanaudioencode_LameBridge_nativeEncode(
    JNIEnv *env, jobject thiz,
    jbyteArray pcmArray, jint sampleRate, jint channels, jint bitrate, jstring outputPath) {

  if (channels < 1 || channels > 2 || sampleRate <= 0) return -1;

  const char *outPath = (*env)->GetStringUTFChars(env, outputPath, NULL);
  if (!outPath) return -2;

  jsize pcmLen = (*env)->GetArrayLength(env, pcmArray);
  jbyte *pcmBytes = (*env)->GetByteArrayElements(env, pcmArray, NULL);
  if (!pcmBytes) {
    (*env)->ReleaseStringUTFChars(env, outputPath, outPath);
    return -3;
  }

  int rc = 0;
  lame_t lame = NULL;
  FILE *out = NULL;
  unsigned char *mp3buf = NULL;

  do {
    lame = lame_init();
    if (!lame) { rc = -4; break; }
    lame_set_num_channels(lame, channels);
    lame_set_in_samplerate(lame, sampleRate);
    lame_set_brate(lame, bitrate > 0 ? bitrate : 192);
    lame_set_mode(lame, channels == 1 ? MONO : JOINT_STEREO);
    lame_set_quality(lame, 3); /* 0=best/slow .. 9=worst/fast */
    if (lame_init_params(lame) < 0) { rc = -5; break; }

    out = fopen(outPath, "wb");
    if (!out) { rc = -6; break; }

    const short *pcm = (const short *) pcmBytes;
    long totalShorts = (long) pcmLen / 2;
    long samplesPerChannel = totalShorts / channels;

    int mp3BufSize = (int) (1.25 * PCM_CHUNK + 7200);
    mp3buf = (unsigned char *) malloc(mp3BufSize);
    if (!mp3buf) { rc = -7; break; }

    long offset = 0; /* in samples-per-channel */
    while (offset < samplesPerChannel) {
      int n = (int) (samplesPerChannel - offset);
      if (n > PCM_CHUNK) n = PCM_CHUNK;
      int written;
      if (channels == 2) {
        written = lame_encode_buffer_interleaved(lame, (short *) (pcm + offset * 2), n, mp3buf, mp3BufSize);
      } else {
        written = lame_encode_buffer(lame, pcm + offset, pcm + offset, n, mp3buf, mp3BufSize);
      }
      if (written < 0) { rc = -8; break; }
      if (written > 0) fwrite(mp3buf, 1, (size_t) written, out);
      offset += n;
    }
    if (rc != 0) break;

    int flushed = lame_encode_flush(lame, mp3buf, mp3BufSize);
    if (flushed > 0) fwrite(mp3buf, 1, (size_t) flushed, out);
  } while (0);

  if (mp3buf) free(mp3buf);
  if (out) fclose(out);
  if (lame) lame_close(lame);
  (*env)->ReleaseByteArrayElements(env, pcmArray, pcmBytes, JNI_ABORT);
  (*env)->ReleaseStringUTFChars(env, outputPath, outPath);
  return rc;
}
