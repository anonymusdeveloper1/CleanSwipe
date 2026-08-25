package expo.modules.swipecleanaudioencode

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
import java.io.RandomAccessFile
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * Audio encode/extract from a video, three free on-device targets:
 *   - m4a: lossless remux of the existing AAC track (MediaExtractor → MediaMuxer).
 *   - wav: decode the track to PCM (MediaCodec) and wrap it in a RIFF/WAVE header.
 * Pure Android SDK (no FFmpeg) for m4a + wav.
 */
class AudioEncodeModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("SwipeCleanAudioEncode")

    AsyncFunction("encodeAudio") { inputUri: String, outputPath: String, format: String ->
      val outFile = File(outputPath)
      outFile.parentFile?.mkdirs()
      if (outFile.exists()) outFile.delete()
      when (format) {
        "m4a" -> remuxToM4a(inputUri, outputPath)
        "wav" -> decodeToWav(inputUri, outputPath)
        else -> throw Exception("unsupported-format")
      }
      "file://$outputPath"
    }
  }

  private fun openExtractor(inputUri: String): MediaExtractor {
    val extractor = MediaExtractor()
    if (inputUri.startsWith("content://")) {
      extractor.setDataSource(context, Uri.parse(inputUri), null)
    } else {
      extractor.setDataSource(inputUri.removePrefix("file://"))
    }
    return extractor
  }

  private fun selectAudioTrack(extractor: MediaExtractor): MediaFormat {
    for (i in 0 until extractor.trackCount) {
      val format = extractor.getTrackFormat(i)
      val mime = format.getString(MediaFormat.KEY_MIME) ?: continue
      if (mime.startsWith("audio/")) {
        extractor.selectTrack(i)
        return format
      }
    }
    throw Exception("no-audio-track")
  }

  private fun remuxToM4a(inputUri: String, outputPath: String) {
    val extractor = openExtractor(inputUri)
    var muxer: MediaMuxer? = null
    try {
      val format = selectAudioTrack(extractor)
      muxer = MediaMuxer(outputPath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
      val outTrack = muxer.addTrack(format)
      muxer.start()
      val maxInputSize = if (format.containsKey(MediaFormat.KEY_MAX_INPUT_SIZE)) format.getInteger(MediaFormat.KEY_MAX_INPUT_SIZE) else (1 shl 20)
      val buffer = ByteBuffer.allocate(maxInputSize)
      val info = MediaCodec.BufferInfo()
      while (true) {
        val sampleSize = extractor.readSampleData(buffer, 0)
        if (sampleSize < 0) break
        info.offset = 0
        info.size = sampleSize
        info.presentationTimeUs = extractor.sampleTime
        info.flags = if ((extractor.sampleFlags and MediaExtractor.SAMPLE_FLAG_SYNC) != 0) MediaCodec.BUFFER_FLAG_KEY_FRAME else 0
        muxer.writeSampleData(outTrack, buffer, info)
        extractor.advance()
      }
      muxer.stop()
    } finally {
      try { muxer?.release() } catch (_: Exception) {}
      extractor.release()
    }
  }

  /** Decodes the audio track to interleaved 16-bit PCM; returns (pcm, sampleRate, channels). */
  private fun decodeToPcm(inputUri: String): PcmAudio {
    val extractor = openExtractor(inputUri)
    val inputFormat = selectAudioTrack(extractor)
    val mime = inputFormat.getString(MediaFormat.KEY_MIME)!!
    val codec = MediaCodec.createDecoderByType(mime)
    val pcm = java.io.ByteArrayOutputStream()
    var sampleRate = if (inputFormat.containsKey(MediaFormat.KEY_SAMPLE_RATE)) inputFormat.getInteger(MediaFormat.KEY_SAMPLE_RATE) else 44100
    var channels = if (inputFormat.containsKey(MediaFormat.KEY_CHANNEL_COUNT)) inputFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT) else 2
    try {
      codec.configure(inputFormat, null, null, 0)
      codec.start()
      val info = MediaCodec.BufferInfo()
      var sawInputEos = false
      var sawOutputEos = false
      while (!sawOutputEos) {
        if (!sawInputEos) {
          val inIndex = codec.dequeueInputBuffer(10000)
          if (inIndex >= 0) {
            val inBuf = codec.getInputBuffer(inIndex)!!
            val sampleSize = extractor.readSampleData(inBuf, 0)
            if (sampleSize < 0) {
              codec.queueInputBuffer(inIndex, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
              sawInputEos = true
            } else {
              codec.queueInputBuffer(inIndex, 0, sampleSize, extractor.sampleTime, 0)
              extractor.advance()
            }
          }
        }
        val outIndex = codec.dequeueOutputBuffer(info, 10000)
        if (outIndex >= 0) {
          val outBuf = codec.getOutputBuffer(outIndex)!!
          val chunk = ByteArray(info.size)
          outBuf.position(info.offset)
          outBuf.get(chunk, 0, info.size)
          outBuf.clear()
          pcm.write(chunk)
          codec.releaseOutputBuffer(outIndex, false)
          if ((info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) sawOutputEos = true
        } else if (outIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
          val of = codec.outputFormat
          if (of.containsKey(MediaFormat.KEY_SAMPLE_RATE)) sampleRate = of.getInteger(MediaFormat.KEY_SAMPLE_RATE)
          if (of.containsKey(MediaFormat.KEY_CHANNEL_COUNT)) channels = of.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
        }
      }
    } finally {
      try { codec.stop() } catch (_: Exception) {}
      codec.release()
      extractor.release()
    }
    return PcmAudio(pcm.toByteArray(), sampleRate, channels)
  }

  private fun decodeToWav(inputUri: String, outputPath: String) {
    val audio = decodeToPcm(inputUri)
    writeWav(File(outputPath), audio)
  }

  private fun writeWav(file: File, audio: PcmAudio) {
    val byteRate = audio.sampleRate * audio.channels * 2
    val blockAlign = audio.channels * 2
    val dataLen = audio.pcm.size
    val raf = RandomAccessFile(file, "rw")
    try {
      val header = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN)
      header.put("RIFF".toByteArray(Charsets.US_ASCII))
      header.putInt(36 + dataLen)
      header.put("WAVE".toByteArray(Charsets.US_ASCII))
      header.put("fmt ".toByteArray(Charsets.US_ASCII))
      header.putInt(16)
      header.putShort(1) // PCM
      header.putShort(audio.channels.toShort())
      header.putInt(audio.sampleRate)
      header.putInt(byteRate)
      header.putShort(blockAlign.toShort())
      header.putShort(16) // bits per sample
      header.put("data".toByteArray(Charsets.US_ASCII))
      header.putInt(dataLen)
      raf.write(header.array())
      raf.write(audio.pcm)
    } finally {
      raf.close()
    }
  }
}

data class PcmAudio(val pcm: ByteArray, val sampleRate: Int, val channels: Int)
