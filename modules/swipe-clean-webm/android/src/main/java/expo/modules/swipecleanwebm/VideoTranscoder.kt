package expo.modules.swipecleanwebm

import android.content.Context
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMuxer
import android.net.Uri

/**
 * Transcodes a video's VIDEO track to VP8 in a WebM container (MediaMuxer
 * MUXER_OUTPUT_WEBM) via a surface decode→encode bridge. v1 is video-only — audio
 * (Opus) is a follow-up, since WebM can't carry the source's AAC track directly.
 */
object VideoTranscoder {
  private const val OUTPUT_VIDEO_MIME = "video/x-vnd.on2.vp8"
  private const val TIMEOUT_US = 10000L

  fun transcodeToWebm(context: Context, inputUri: String, outputPath: String) {
    val extractor = MediaExtractor()
    if (inputUri.startsWith("content://")) {
      extractor.setDataSource(context, Uri.parse(inputUri), null)
    } else {
      extractor.setDataSource(inputUri.removePrefix("file://"))
    }

    var videoTrack = -1
    var inputFormat: MediaFormat? = null
    for (i in 0 until extractor.trackCount) {
      val format = extractor.getTrackFormat(i)
      val mime = format.getString(MediaFormat.KEY_MIME) ?: continue
      if (mime.startsWith("video/")) {
        videoTrack = i
        inputFormat = format
        break
      }
    }
    if (videoTrack < 0 || inputFormat == null) {
      extractor.release()
      throw Exception("no-video-track")
    }
    extractor.selectTrack(videoTrack)

    val inputMime = inputFormat.getString(MediaFormat.KEY_MIME)!!
    val width = if (inputFormat.containsKey(MediaFormat.KEY_WIDTH)) inputFormat.getInteger(MediaFormat.KEY_WIDTH) else 1280
    val height = if (inputFormat.containsKey(MediaFormat.KEY_HEIGHT)) inputFormat.getInteger(MediaFormat.KEY_HEIGHT) else 720
    val frameRate = runCatching { inputFormat.getInteger(MediaFormat.KEY_FRAME_RATE) }.getOrDefault(30).coerceIn(1, 60)
    val bitRate = runCatching { inputFormat.getInteger(MediaFormat.KEY_BIT_RATE) }.getOrNull()
      ?: (width.toLong() * height.toLong() * 3).toInt().coerceIn(1_000_000, 20_000_000)

    val outputFormat = MediaFormat.createVideoFormat(OUTPUT_VIDEO_MIME, width, height).apply {
      setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface)
      setInteger(MediaFormat.KEY_BIT_RATE, bitRate)
      setInteger(MediaFormat.KEY_FRAME_RATE, frameRate)
      setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1)
    }

    var encoder: MediaCodec? = null
    var decoder: MediaCodec? = null
    var inputSurface: InputSurface? = null
    var outputSurface: OutputSurface? = null
    var muxer: MediaMuxer? = null
    var muxerStarted = false
    try {
      encoder = MediaCodec.createEncoderByType(OUTPUT_VIDEO_MIME)
      encoder.configure(outputFormat, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
      inputSurface = InputSurface(encoder.createInputSurface())
      inputSurface.makeCurrent()
      encoder.start()

      outputSurface = OutputSurface()
      decoder = MediaCodec.createDecoderByType(inputMime)
      decoder.configure(inputFormat, outputSurface.surface, null, 0)
      decoder.start()

      muxer = MediaMuxer(outputPath, MediaMuxer.OutputFormat.MUXER_OUTPUT_WEBM)
      var outputVideoTrack = -1

      val bufferInfo = MediaCodec.BufferInfo()
      var inputDone = false
      var decoderDone = false
      var outputDone = false

      while (!outputDone) {
        if (!inputDone) {
          val inIndex = decoder.dequeueInputBuffer(TIMEOUT_US)
          if (inIndex >= 0) {
            val inBuf = decoder.getInputBuffer(inIndex)!!
            val sampleSize = extractor.readSampleData(inBuf, 0)
            if (sampleSize < 0) {
              decoder.queueInputBuffer(inIndex, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
              inputDone = true
            } else {
              decoder.queueInputBuffer(inIndex, 0, sampleSize, extractor.sampleTime, 0)
              extractor.advance()
            }
          }
        }

        if (!decoderDone) {
          val outIndex = decoder.dequeueOutputBuffer(bufferInfo, TIMEOUT_US)
          if (outIndex >= 0) {
            val render = bufferInfo.size != 0
            decoder.releaseOutputBuffer(outIndex, render)
            if (render) {
              outputSurface.awaitNewImage()
              outputSurface.drawImage()
              inputSurface.setPresentationTime(bufferInfo.presentationTimeUs * 1000)
              inputSurface.swapBuffers()
            }
            if ((bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) {
              decoderDone = true
              encoder.signalEndOfInputStream()
            }
          }
        }

        while (true) {
          val encIndex = encoder.dequeueOutputBuffer(bufferInfo, TIMEOUT_US)
          if (encIndex == MediaCodec.INFO_TRY_AGAIN_LATER) break
          if (encIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
            if (!muxerStarted) {
              outputVideoTrack = muxer.addTrack(encoder.outputFormat)
              muxer.start()
              muxerStarted = true
            }
            continue
          }
          if (encIndex < 0) continue
          val encData = encoder.getOutputBuffer(encIndex)!!
          if ((bufferInfo.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG) != 0) bufferInfo.size = 0
          if (bufferInfo.size > 0 && muxerStarted) {
            encData.position(bufferInfo.offset)
            encData.limit(bufferInfo.offset + bufferInfo.size)
            muxer.writeSampleData(outputVideoTrack, encData, bufferInfo)
          }
          val eos = (bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0
          encoder.releaseOutputBuffer(encIndex, false)
          if (eos) {
            outputDone = true
            break
          }
        }
      }

      muxer.stop()
    } finally {
      try { decoder?.stop() } catch (_: Exception) {}
      try { decoder?.release() } catch (_: Exception) {}
      try { encoder?.stop() } catch (_: Exception) {}
      try { encoder?.release() } catch (_: Exception) {}
      try { if (muxerStarted) muxer?.release() } catch (_: Exception) {}
      outputSurface?.release()
      inputSurface?.release()
      extractor.release()
    }
  }
}
