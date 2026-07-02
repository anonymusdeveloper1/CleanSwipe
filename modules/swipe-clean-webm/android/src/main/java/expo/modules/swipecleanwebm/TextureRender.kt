package expo.modules.swipecleanwebm

import android.graphics.SurfaceTexture
import android.opengl.GLES11Ext
import android.opengl.GLES20
import android.opengl.Matrix
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer

/**
 * Draws an external-OES texture (the decoder's SurfaceTexture) onto the current
 * EGL surface — i.e. copies a decoded frame straight to the encoder input surface.
 * Standard Android CTS/Grafika full-frame passthrough shader.
 */
class TextureRender {
  private val triangleVerticesData = floatArrayOf(
    -1.0f, -1.0f, 0f, 0f, 0f,
    1.0f, -1.0f, 0f, 1f, 0f,
    -1.0f, 1.0f, 0f, 0f, 1f,
    1.0f, 1.0f, 0f, 1f, 1f
  )
  private val triangleVertices: FloatBuffer = ByteBuffer
    .allocateDirect(triangleVerticesData.size * FLOAT_SIZE_BYTES)
    .order(ByteOrder.nativeOrder())
    .asFloatBuffer()
    .apply { put(triangleVerticesData).position(0) }

  private val mvpMatrix = FloatArray(16)
  private val stMatrix = FloatArray(16)
  private var program = 0
  private var textureID = -12345
  private var uMVPMatrixHandle = 0
  private var uSTMatrixHandle = 0
  private var aPositionHandle = 0
  private var aTextureHandle = 0

  init {
    Matrix.setIdentityM(stMatrix, 0)
  }

  val texture: Int get() = textureID

  fun drawFrame(st: SurfaceTexture) {
    st.getTransformMatrix(stMatrix)
    GLES20.glClearColor(0f, 0f, 0f, 1f)
    GLES20.glClear(GLES20.GL_DEPTH_BUFFER_BIT or GLES20.GL_COLOR_BUFFER_BIT)
    GLES20.glUseProgram(program)
    GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
    GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, textureID)
    triangleVertices.position(TRIANGLE_VERTICES_DATA_POS_OFFSET)
    GLES20.glVertexAttribPointer(aPositionHandle, 3, GLES20.GL_FLOAT, false, TRIANGLE_VERTICES_DATA_STRIDE_BYTES, triangleVertices)
    GLES20.glEnableVertexAttribArray(aPositionHandle)
    triangleVertices.position(TRIANGLE_VERTICES_DATA_UV_OFFSET)
    GLES20.glVertexAttribPointer(aTextureHandle, 2, GLES20.GL_FLOAT, false, TRIANGLE_VERTICES_DATA_STRIDE_BYTES, triangleVertices)
    GLES20.glEnableVertexAttribArray(aTextureHandle)
    Matrix.setIdentityM(mvpMatrix, 0)
    GLES20.glUniformMatrix4fv(uMVPMatrixHandle, 1, false, mvpMatrix, 0)
    GLES20.glUniformMatrix4fv(uSTMatrixHandle, 1, false, stMatrix, 0)
    GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4)
    GLES20.glFinish()
  }

  fun surfaceCreated() {
    program = createProgram(VERTEX_SHADER, FRAGMENT_SHADER)
    if (program == 0) throw RuntimeException("failed creating GL program")
    aPositionHandle = GLES20.glGetAttribLocation(program, "aPosition")
    aTextureHandle = GLES20.glGetAttribLocation(program, "aTextureCoord")
    uMVPMatrixHandle = GLES20.glGetUniformLocation(program, "uMVPMatrix")
    uSTMatrixHandle = GLES20.glGetUniformLocation(program, "uSTMatrix")
    val textures = IntArray(1)
    GLES20.glGenTextures(1, textures, 0)
    textureID = textures[0]
    GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, textureID)
    GLES20.glTexParameterf(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_NEAREST.toFloat())
    GLES20.glTexParameterf(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR.toFloat())
    GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE)
    GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE)
  }

  private fun createProgram(vertexSource: String, fragmentSource: String): Int {
    val vertexShader = loadShader(GLES20.GL_VERTEX_SHADER, vertexSource)
    val pixelShader = loadShader(GLES20.GL_FRAGMENT_SHADER, fragmentSource)
    val prog = GLES20.glCreateProgram()
    GLES20.glAttachShader(prog, vertexShader)
    GLES20.glAttachShader(prog, pixelShader)
    GLES20.glLinkProgram(prog)
    val linkStatus = IntArray(1)
    GLES20.glGetProgramiv(prog, GLES20.GL_LINK_STATUS, linkStatus, 0)
    if (linkStatus[0] != GLES20.GL_TRUE) {
      GLES20.glDeleteProgram(prog)
      return 0
    }
    return prog
  }

  private fun loadShader(type: Int, source: String): Int {
    val shader = GLES20.glCreateShader(type)
    GLES20.glShaderSource(shader, source)
    GLES20.glCompileShader(shader)
    val compiled = IntArray(1)
    GLES20.glGetShaderiv(shader, GLES20.GL_COMPILE_STATUS, compiled, 0)
    if (compiled[0] == 0) {
      GLES20.glDeleteShader(shader)
      throw RuntimeException("shader compile failed: ${GLES20.glGetShaderInfoLog(shader)}")
    }
    return shader
  }

  companion object {
    private const val FLOAT_SIZE_BYTES = 4
    private const val TRIANGLE_VERTICES_DATA_STRIDE_BYTES = 5 * FLOAT_SIZE_BYTES
    private const val TRIANGLE_VERTICES_DATA_POS_OFFSET = 0
    private const val TRIANGLE_VERTICES_DATA_UV_OFFSET = 3
    private const val VERTEX_SHADER =
      "uniform mat4 uMVPMatrix;\nuniform mat4 uSTMatrix;\nattribute vec4 aPosition;\nattribute vec4 aTextureCoord;\nvarying vec2 vTextureCoord;\nvoid main() {\n  gl_Position = uMVPMatrix * aPosition;\n  vTextureCoord = (uSTMatrix * aTextureCoord).xy;\n}\n"
    private const val FRAGMENT_SHADER =
      "#extension GL_OES_EGL_image_external : require\nprecision mediump float;\nvarying vec2 vTextureCoord;\nuniform samplerExternalOES sTexture;\nvoid main() {\n  gl_FragColor = texture2D(sTexture, vTextureCoord);\n}\n"
  }
}
