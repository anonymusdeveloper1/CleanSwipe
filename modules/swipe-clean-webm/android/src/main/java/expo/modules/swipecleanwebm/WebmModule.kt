package expo.modules.swipecleanwebm

import android.content.Context
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

/**
 * Video → WebM (VP8) using only the Android platform: MediaCodec decode/encode via
 * an EGL surface bridge + MediaMuxer(MUXER_OUTPUT_WEBM). No FFmpeg, no native libs.
 * iOS WebM (libvpx) is a separate module that ships later — the JS probe hides the
 * WebM chip on platforms where this module is absent.
 */
class WebmModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("SwipeCleanWebm")

    AsyncFunction("toWebm") { inputUri: String, outputPath: String ->
      val outFile = File(outputPath)
      outFile.parentFile?.mkdirs()
      if (outFile.exists()) outFile.delete()
      VideoTranscoder.transcodeToWebm(context, inputUri, outputPath)
      "file://$outputPath"
    }
  }
}
