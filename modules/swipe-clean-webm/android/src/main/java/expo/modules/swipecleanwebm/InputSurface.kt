package expo.modules.swipecleanwebm

import android.opengl.EGL14
import android.opengl.EGLConfig
import android.opengl.EGLContext
import android.opengl.EGLDisplay
import android.opengl.EGLExt
import android.opengl.EGLSurface
import android.view.Surface

/**
 * Holds the EGL state for the video encoder's input Surface. The decoder's frames
 * are drawn onto this surface (via OutputSurface/TextureRender) and pushed to the
 * encoder by swapBuffers(). Standard EGL14 setup (Android CTS / Grafika pattern).
 */
class InputSurface(private val surface: Surface) {
  private var eglDisplay: EGLDisplay = EGL14.EGL_NO_DISPLAY
  private var eglContext: EGLContext = EGL14.EGL_NO_CONTEXT
  private var eglSurface: EGLSurface = EGL14.EGL_NO_SURFACE

  init {
    eglDisplay = EGL14.eglGetDisplay(EGL14.EGL_DEFAULT_DISPLAY)
    if (eglDisplay === EGL14.EGL_NO_DISPLAY) throw RuntimeException("unable to get EGL14 display")
    val version = IntArray(2)
    if (!EGL14.eglInitialize(eglDisplay, version, 0, version, 1)) {
      eglDisplay = EGL14.EGL_NO_DISPLAY
      throw RuntimeException("unable to initialize EGL14")
    }
    val configAttribs = intArrayOf(
      EGL14.EGL_RED_SIZE, 8,
      EGL14.EGL_GREEN_SIZE, 8,
      EGL14.EGL_BLUE_SIZE, 8,
      EGL14.EGL_RENDERABLE_TYPE, EGL14.EGL_OPENGL_ES2_BIT,
      EGLExt.EGL_RECORDABLE_ANDROID, 1,
      EGL14.EGL_NONE
    )
    val configs = arrayOfNulls<EGLConfig>(1)
    val numConfigs = IntArray(1)
    if (!EGL14.eglChooseConfig(eglDisplay, configAttribs, 0, configs, 0, configs.size, numConfigs, 0)) {
      throw RuntimeException("unable to find RGB888+recordable ES2 EGL config")
    }
    val ctxAttribs = intArrayOf(EGL14.EGL_CONTEXT_CLIENT_VERSION, 2, EGL14.EGL_NONE)
    eglContext = EGL14.eglCreateContext(eglDisplay, configs[0], EGL14.EGL_NO_CONTEXT, ctxAttribs, 0)
    checkEglError("eglCreateContext")
    val surfaceAttribs = intArrayOf(EGL14.EGL_NONE)
    eglSurface = EGL14.eglCreateWindowSurface(eglDisplay, configs[0], surface, surfaceAttribs, 0)
    checkEglError("eglCreateWindowSurface")
  }

  fun makeCurrent() {
    if (!EGL14.eglMakeCurrent(eglDisplay, eglSurface, eglSurface, eglContext)) {
      throw RuntimeException("eglMakeCurrent failed")
    }
  }

  fun swapBuffers(): Boolean = EGL14.eglSwapBuffers(eglDisplay, eglSurface)

  fun setPresentationTime(nsecs: Long) {
    EGLExt.eglPresentationTimeANDROID(eglDisplay, eglSurface, nsecs)
  }

  fun release() {
    if (eglDisplay !== EGL14.EGL_NO_DISPLAY) {
      EGL14.eglMakeCurrent(eglDisplay, EGL14.EGL_NO_SURFACE, EGL14.EGL_NO_SURFACE, EGL14.EGL_NO_CONTEXT)
      EGL14.eglDestroySurface(eglDisplay, eglSurface)
      EGL14.eglDestroyContext(eglDisplay, eglContext)
      EGL14.eglReleaseThread()
      EGL14.eglTerminate(eglDisplay)
    }
    surface.release()
    eglDisplay = EGL14.EGL_NO_DISPLAY
    eglContext = EGL14.EGL_NO_CONTEXT
    eglSurface = EGL14.EGL_NO_SURFACE
  }

  private fun checkEglError(msg: String) {
    val error = EGL14.eglGetError()
    if (error != EGL14.EGL_SUCCESS) throw RuntimeException("$msg: EGL error 0x${Integer.toHexString(error)}")
  }
}
