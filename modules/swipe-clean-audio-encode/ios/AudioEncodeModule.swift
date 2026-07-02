import AVFoundation
import ExpoModulesCore

// Encode/extract a video's audio track to M4A, WAV, or MP3 — free, on-device.
//   - m4a: AVAssetExportSession (AppleM4A preset).
//   - wav: AVAssetReader → 16-bit PCM → RIFF/WAVE header.
//   - mp3: bundled LAME 3.100 (LGPL) — the C sources are vendored at ./lame and
//     compiled directly into this pod; SCLameEncoder bridges AVAssetReader PCM
//     into lame_encode_buffer_interleaved.
public class AudioEncodeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SwipeCleanAudioEncode")

    Function("supportsMp3") { LameBridge.available }

    AsyncFunction("encodeAudio") { (inputUri: String, outputPath: String, format: String, promise: Promise) in
      let inputURL = URL(string: inputUri) ?? URL(fileURLWithPath: inputUri.replacingOccurrences(of: "file://", with: ""))
      let outputURL = URL(fileURLWithPath: outputPath.replacingOccurrences(of: "file://", with: ""))
      try? FileManager.default.removeItem(at: outputURL)

      switch format {
      case "m4a":
        self.exportM4a(inputURL: inputURL, outputURL: outputURL, promise: promise)
      case "wav":
        do {
          try self.exportWav(inputURL: inputURL, outputURL: outputURL)
          promise.resolve(outputURL.absoluteString)
        } catch {
          promise.reject("E_WAV", error.localizedDescription)
        }
      case "mp3":
        do {
          try SCLameEncoder.encodeVideo(atPath: inputURL.path, toMp3Path: outputURL.path, bitrate: 192)
          promise.resolve(outputURL.absoluteString)
        } catch {
          promise.reject("E_MP3", error.localizedDescription)
        }
      default:
        promise.reject("E_FORMAT", "unsupported-format")
      }
    }
  }

  private func exportM4a(inputURL: URL, outputURL: URL, promise: Promise) {
    let asset = AVURLAsset(url: inputURL)
    guard let export = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetAppleM4A) else {
      promise.reject("E_EXPORT", "Could not create the audio export session")
      return
    }
    export.outputURL = outputURL
    export.outputFileType = .m4a
    export.exportAsynchronously {
      switch export.status {
      case .completed: promise.resolve(outputURL.absoluteString)
      case .failed, .cancelled: promise.reject("E_EXPORT", export.error?.localizedDescription ?? "Audio export failed")
      default: promise.reject("E_EXPORT", "Unexpected export status")
      }
    }
  }

  private func exportWav(inputURL: URL, outputURL: URL) throws {
    let asset = AVURLAsset(url: inputURL)
    guard let track = asset.tracks(withMediaType: .audio).first else { throw NSError(domain: "wav", code: 1, userInfo: [NSLocalizedDescriptionKey: "no-audio-track"]) }

    let reader = try AVAssetReader(asset: asset)
    let sampleRate = 44100.0
    let channels = 2
    let settings: [String: Any] = [
      AVFormatIDKey: kAudioFormatLinearPCM,
      AVSampleRateKey: sampleRate,
      AVNumberOfChannelsKey: channels,
      AVLinearPCMBitDepthKey: 16,
      AVLinearPCMIsBigEndianKey: false,
      AVLinearPCMIsFloatKey: false,
      AVLinearPCMIsNonInterleaved: false
    ]
    let output = AVAssetReaderTrackOutput(track: track, outputSettings: settings)
    reader.add(output)
    reader.startReading()

    var pcm = Data()
    while reader.status == .reading {
      guard let buffer = output.copyNextSampleBuffer(), let block = CMSampleBufferGetDataBuffer(buffer) else { break }
      var length = 0
      var dataPointer: UnsafeMutablePointer<Int8>?
      CMBlockBufferGetDataPointer(block, atOffset: 0, lengthAtOffsetOut: nil, totalLengthOut: &length, dataPointerOut: &dataPointer)
      if let dataPointer = dataPointer { pcm.append(Data(bytes: dataPointer, count: length)) }
      CMSampleBufferInvalidate(buffer)
    }
    if reader.status == .failed { throw reader.error ?? NSError(domain: "wav", code: 2) }

    let wav = AudioEncodeModule.wavData(pcm: pcm, sampleRate: Int(sampleRate), channels: channels)
    try wav.write(to: outputURL)
  }

  private static func wavData(pcm: Data, sampleRate: Int, channels: Int) -> Data {
    let byteRate = sampleRate * channels * 2
    let blockAlign = channels * 2
    var header = Data()
    func append32(_ v: Int) { var le = UInt32(v).littleEndian; header.append(Data(bytes: &le, count: 4)) }
    func append16(_ v: Int) { var le = UInt16(v).littleEndian; header.append(Data(bytes: &le, count: 2)) }
    header.append("RIFF".data(using: .ascii)!)
    append32(36 + pcm.count)
    header.append("WAVE".data(using: .ascii)!)
    header.append("fmt ".data(using: .ascii)!)
    append32(16)
    append16(1) // PCM
    append16(channels)
    append32(sampleRate)
    append32(byteRate)
    append16(blockAlign)
    append16(16) // bits per sample
    header.append("data".data(using: .ascii)!)
    append32(pcm.count)
    return header + pcm
  }
}

/// LAME 3.100 (LGPL) is compiled into the pod, so MP3 is always available on iOS.
/// The JS capability probe reads this via `supportsMp3()`.
enum LameBridge {
  static let available = true
}
