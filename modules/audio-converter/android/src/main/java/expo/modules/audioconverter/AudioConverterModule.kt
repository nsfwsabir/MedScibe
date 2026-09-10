package expo.modules.audioconverter

import android.content.Context
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.net.Uri
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.util.UUID

class AudioConverterModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("AudioConverter")

    AsyncFunction("convertToWav") { inputUri: String, promise: Promise ->
      try {
        val out = convertM4aToWav(inputUri, context)
        promise.resolve(out)
      } catch (e: Exception) {
        promise.reject("CONVERT_FAILED", e.message ?: "Conversion failed", e)
      }
    }

    AsyncFunction("convertToWav") { inputUri: String ->
      convertM4aToWav(inputUri, context)
    }
  }

  private fun cleanPath(uri: String): String {
    var p = uri
    if (p.startsWith("file://")) p = p.removePrefix("file://")
    return p
  }

  private fun convertM4aToWav(inputUri: String, ctx: Context): String {
    val inputPath = cleanPath(inputUri)
    val inputFile = File(inputPath)
    val actualInputFile: File = if (inputUri.startsWith("content://")) {
      val temp = File(ctx.cacheDir, "Audio/conv-in-${UUID.randomUUID()}.m4a")
      temp.parentFile?.mkdirs()
      ctx.contentResolver.openInputStream(Uri.parse(inputUri))?.use { ins ->
        temp.outputStream().use { out -> ins.copyTo(out) }
      } ?: throw IllegalArgumentException("Cannot open content URI")
      temp
    } else {
      if (!inputFile.exists()) throw IllegalArgumentException("Input file not found: $inputUri")
      inputFile
    }

    val outputFile = File(ctx.cacheDir, "Audio/converted-${UUID.randomUUID()}.wav")
    outputFile.parentFile?.mkdirs()

    val extractor = MediaExtractor()
    try {
      extractor.setDataSource(actualInputFile.absolutePath)
      var audioTrackIndex = -1
      var format: MediaFormat? = null
      var mime: String? = null
      for (i in 0 until extractor.trackCount) {
        val f = extractor.getTrackFormat(i)
        val m = f.getString(MediaFormat.KEY_MIME) ?: ""
        if (m.startsWith("audio/")) {
          audioTrackIndex = i
          format = f
          mime = m
          break
        }
      }
      if (audioTrackIndex < 0 || format == null || mime == null) {
        throw IllegalArgumentException("No audio track found in $inputUri")
      }
      extractor.selectTrack(audioTrackIndex)

      val decoder = MediaCodec.createDecoderByType(mime)
      decoder.configure(format, null, null, 0)
      decoder.start()

      val pcmData = mutableListOf<ByteArray>()
      var sampleRate = 16000
      var channelCount = 1
      var pcmEncoding = 2
      if (format.containsKey(MediaFormat.KEY_SAMPLE_RATE)) {
        sampleRate = format.getInteger(MediaFormat.KEY_SAMPLE_RATE)
      }
      if (format.containsKey(MediaFormat.KEY_CHANNEL_COUNT)) {
        channelCount = format.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
      }
      if (format.containsKey(MediaFormat.KEY_PCM_ENCODING)) {
        try { pcmEncoding = format.getInteger(MediaFormat.KEY_PCM_ENCODING) } catch (_: Exception) {}
      }

      val bufferInfo = MediaCodec.BufferInfo()
      var sawInputEOS = false
      var sawOutputEOS = false
      val timeoutUs = 10000L

      while (!sawOutputEOS) {
        if (!sawInputEOS) {
          val inputIndex = decoder.dequeueInputBuffer(timeoutUs)
          if (inputIndex >= 0) {
            val inputBuffer = decoder.getInputBuffer(inputIndex)!!
            val sampleSize = extractor.readSampleData(inputBuffer, 0)
            if (sampleSize < 0) {
              decoder.queueInputBuffer(inputIndex, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
              sawInputEOS = true
            } else {
              val pts = extractor.sampleTime
              decoder.queueInputBuffer(inputIndex, 0, sampleSize, pts, 0)
              extractor.advance()
            }
          }
        }
        val outputIndex = decoder.dequeueOutputBuffer(bufferInfo, timeoutUs)
        when {
          outputIndex >= 0 -> {
            val outputBuffer = decoder.getOutputBuffer(outputIndex)!!
            if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
              sawOutputEOS = true
            }
            if (bufferInfo.size > 0) {
              val chunk = ByteArray(bufferInfo.size)
              outputBuffer.position(bufferInfo.offset)
              outputBuffer.limit(bufferInfo.offset + bufferInfo.size)
              outputBuffer.get(chunk)
              pcmData.add(chunk)
            }
            decoder.releaseOutputBuffer(outputIndex, false)
            if (sawOutputEOS) break
          }
          outputIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
            val newFormat = decoder.outputFormat
            if (newFormat.containsKey(MediaFormat.KEY_SAMPLE_RATE)) {
              sampleRate = newFormat.getInteger(MediaFormat.KEY_SAMPLE_RATE)
            }
            if (newFormat.containsKey(MediaFormat.KEY_CHANNEL_COUNT)) {
              channelCount = newFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
            }
            if (newFormat.containsKey(MediaFormat.KEY_PCM_ENCODING)) {
              try { pcmEncoding = newFormat.getInteger(MediaFormat.KEY_PCM_ENCODING) } catch (_: Exception) {}
            }
          }
          outputIndex == MediaCodec.INFO_TRY_AGAIN_LATER -> {}
        }
      }

      decoder.stop()
      decoder.release()

      val totalBytes = pcmData.sumOf { it.size }
      if (totalBytes == 0) throw IllegalStateException("Decoded PCM is empty")

      val bitsPerSample = when (pcmEncoding) {
        3 -> 8
        2 -> 16
        4 -> 32
        else -> 16
      }

      val finalPcm: ByteArray = if (bitsPerSample == 32 && pcmEncoding == 4) {
        val floatCount = totalBytes / 4
        val out = ByteArray(floatCount * 2)
        var outPos = 0
        for (chunk in pcmData) {
          val bb = ByteBuffer.wrap(chunk).order(java.nio.ByteOrder.nativeOrder())
          while (bb.remaining() >= 4) {
            val f = bb.float
            val s = (f.coerceIn(-1f, 1f) * 32767).toInt().coerceIn(-32768, 32767)
            out[outPos++] = (s and 0xFF).toByte()
            out[outPos++] = ((s shr 8) and 0xFF).toByte()
          }
        }
        out
      } else {
        val out = ByteArray(totalBytes)
        var pos = 0
        for (c in pcmData) {
          System.arraycopy(c, 0, out, pos, c.size)
          pos += c.size
        }
        out
      }

      val finalBits = if (bitsPerSample == 32) 16 else bitsPerSample
      writeWavFile(outputFile, finalPcm, sampleRate, channelCount, finalBits)
      return Uri.fromFile(outputFile).toString()
    } finally {
      extractor.release()
      if (actualInputFile != inputFile) {
        try { actualInputFile.delete() } catch (_: Exception) {}
      }
    }
  }

  private fun writeWavFile(file: File, pcm: ByteArray, sampleRate: Int, channels: Int, bitsPerSample: Int) {
    val byteRate = sampleRate * channels * bitsPerSample / 8
    val blockAlign = channels * bitsPerSample / 8
    val dataSize = pcm.size
    val chunkSize = 36 + dataSize
    FileOutputStream(file).use { out ->
      out.write("RIFF".toByteArray())
      writeIntLE(out, chunkSize)
      out.write("WAVE".toByteArray())
      out.write("fmt ".toByteArray())
      writeIntLE(out, 16)
      writeShortLE(out, 1)
      writeShortLE(out, channels)
      writeIntLE(out, sampleRate)
      writeIntLE(out, byteRate)
      writeShortLE(out, blockAlign)
      writeShortLE(out, bitsPerSample)
      out.write("data".toByteArray())
      writeIntLE(out, dataSize)
      out.write(pcm)
    }
  }

  private fun writeIntLE(out: FileOutputStream, v: Int) {
    out.write(v and 0xFF)
    out.write((v shr 8) and 0xFF)
    out.write((v shr 16) and 0xFF)
    out.write((v shr 24) and 0xFF)
  }

  private fun writeShortLE(out: FileOutputStream, v: Int) {
    out.write(v and 0xFF)
    out.write((v shr 8) and 0xFF)
  }
}
