import AVFoundation
import ExpoModulesCore

// Extracts a video's audio track into an M4A file via AVAssetExportSession
// (AppleM4A preset) — OS frameworks only, no FFmpeg, no MP3.
public class AudioExtractModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SwipeCleanAudioExtract")

    AsyncFunction("extractAudio") { (inputUri: String, outputPath: String, promise: Promise) in
      let inputURL = URL(string: inputUri) ?? URL(fileURLWithPath: inputUri.replacingOccurrences(of: "file://", with: ""))
      let outputURL = URL(fileURLWithPath: outputPath.replacingOccurrences(of: "file://", with: ""))
      try? FileManager.default.removeItem(at: outputURL)

      let asset = AVURLAsset(url: inputURL)
      guard let export = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetAppleM4A) else {
        promise.reject("E_EXPORT", "Could not create the audio export session")
        return
      }
      export.outputURL = outputURL
      export.outputFileType = .m4a
      export.exportAsynchronously {
        switch export.status {
        case .completed:
          promise.resolve(outputURL.absoluteString)
        case .failed, .cancelled:
          promise.reject("E_EXPORT", export.error?.localizedDescription ?? "Audio export failed")
        default:
          promise.reject("E_EXPORT", "Unexpected export status")
        }
      }
    }
  }
}
