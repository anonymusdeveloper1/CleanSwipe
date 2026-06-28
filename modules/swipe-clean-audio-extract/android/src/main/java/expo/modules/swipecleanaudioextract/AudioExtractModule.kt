package expo.modules.swipecleanaudioextract

import android.content.Context
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import android.net.Uri
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.nio.ByteBuffer

/**
 * Extracts a video's audio track into an M4A (MP4 audio) file. It REMUXES the
 * existing (typically AAC) audio track — no re-encode, so it's fast and lossless
 * — using only the platform MediaExtractor + MediaMuxer. No FFmpeg, no MP3.
 */
class AudioExtractModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("SwipeCleanAudioExtract")

    // Runs off the main thread (AsyncFunction); returns a file:// uri to the .m4a.
    AsyncFunction("extractAudio") { inputUri: String, outputPath: String ->
      remuxAudio(inputUri, outputPath)
      "file://$outputPath"
    }
  }

  private fun remuxAudio(inputUri: String, outputPath: String) {
    val extractor = MediaExtractor()
    var muxer: MediaMuxer? = null
    try {
      if (inputUri.startsWith("content://")) {
        extractor.setDataSource(context, Uri.parse(inputUri), null)
      } else {
        extractor.setDataSource(inputUri.removePrefix("file://"))
      }

      var audioTrackIndex = -1
      var audioFormat: MediaFormat? = null
      for (i in 0 until extractor.trackCount) {
        val format = extractor.getTrackFormat(i)
        val mime = format.getString(MediaFormat.KEY_MIME) ?: continue
        if (mime.startsWith("audio/")) {
          audioTrackIndex = i
          audioFormat = format
          break
        }
      }
      if (audioTrackIndex < 0 || audioFormat == null) {
        throw Exception("no-audio-track")
      }
      extractor.selectTrack(audioTrackIndex)

      val outFile = File(outputPath)
      outFile.parentFile?.mkdirs()
      if (outFile.exists()) outFile.delete()

      muxer = MediaMuxer(outputPath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
      val outTrack = muxer.addTrack(audioFormat)
      muxer.start()

      val maxInputSize =
        if (audioFormat.containsKey(MediaFormat.KEY_MAX_INPUT_SIZE)) {
          audioFormat.getInteger(MediaFormat.KEY_MAX_INPUT_SIZE)
        } else {
          1 shl 20
        }
      val buffer = ByteBuffer.allocate(maxInputSize)
      val bufferInfo = MediaCodec.BufferInfo()

      while (true) {
        val sampleSize = extractor.readSampleData(buffer, 0)
        if (sampleSize < 0) break
        bufferInfo.offset = 0
        bufferInfo.size = sampleSize
        bufferInfo.presentationTimeUs = extractor.sampleTime
        bufferInfo.flags =
          if ((extractor.sampleFlags and MediaExtractor.SAMPLE_FLAG_SYNC) != 0) {
            MediaCodec.BUFFER_FLAG_KEY_FRAME
          } else {
            0
          }
        muxer.writeSampleData(outTrack, buffer, bufferInfo)
        extractor.advance()
      }

      muxer.stop()
    } finally {
      try {
        muxer?.release()
      } catch (_: Exception) {
      }
      extractor.release()
    }
  }
}
