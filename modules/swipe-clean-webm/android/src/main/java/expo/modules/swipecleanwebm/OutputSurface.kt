package expo.modules.swipecleanwebm

import android.graphics.SurfaceTexture
import android.os.Handler
import android.os.HandlerThread
import android.view.Surface

/**
 * Receives decoded frames into a SurfaceTexture (external-OES) and copies each to
 * the current EGL surface via TextureRender. The frame-available callback is
 * delivered on a dedicated HandlerThread so it works regardless of whether the
 * transcode runs on a thread with a Looper.
 */
class OutputSurface : SurfaceTexture.OnFrameAvailableListener {
  private val textureRender = TextureRender()
  private var surfaceTexture: SurfaceTexture
  var surface: Surface
    private set
  private val frameSyncObject = Object()
  private var frameAvailable = false
  private val callbackThread = HandlerThread("webm-frame-callback").apply { start() }

  init {
    textureRender.surfaceCreated()
    surfaceTexture = SurfaceTexture(textureRender.texture)
    surfaceTexture.setOnFrameAvailableListener(this, Handler(callbackThread.looper))
    surface = Surface(surfaceTexture)
  }

  fun release() {
    callbackThread.quitSafely()
    surface.release()
    surfaceTexture.release()
  }

  fun awaitNewImage() {
    val timeoutMs = 5000L
    synchronized(frameSyncObject) {
      while (!frameAvailable) {
        frameSyncObject.wait(timeoutMs)
        if (!frameAvailable) throw RuntimeException("frame wait timed out")
      }
      frameAvailable = false
    }
    surfaceTexture.updateTexImage()
  }

  fun drawImage() {
    textureRender.drawFrame(surfaceTexture)
  }

  override fun onFrameAvailable(st: SurfaceTexture?) {
    synchronized(frameSyncObject) {
      frameAvailable = true
      frameSyncObject.notifyAll()
    }
  }
}
