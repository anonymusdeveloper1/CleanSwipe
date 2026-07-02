import AVFoundation
import ExpoModulesCore
import ImageIO
import UniformTypeIdentifiers

// Video → animated GIF, OS frameworks only: sample frames with
// AVAssetImageGenerator, encode an animated GIF via ImageIO
// (CGImageDestination + UTType.gif). No third-party libraries.
public class GifModule: Module {
  public func definition() -> ModuleDefinition {
    Name("SwipeCleanGif")

    AsyncFunction("videoToGif") { (inputUri: String, outputPath: String, promise: Promise) in
      DispatchQueue.global(qos: .userInitiated).async {
        do {
          try self.makeGif(inputUri: inputUri, outputPath: outputPath)
          promise.resolve("file://" + outputPath)
        } catch {
          promise.reject("E_GIF", error.localizedDescription)
        }
      }
    }
  }

  private func makeGif(inputUri: String, outputPath: String) throws {
    let inputURL = URL(string: inputUri) ?? URL(fileURLWithPath: inputUri.replacingOccurrences(of: "file://", with: ""))
    let outputURL = URL(fileURLWithPath: outputPath.replacingOccurrences(of: "file://", with: ""))
    try? FileManager.default.removeItem(at: outputURL)

    let asset = AVURLAsset(url: inputURL)
    let durationSec = CMTimeGetSeconds(asset.duration)
    guard durationSec > 0 else { throw NSError(domain: "gif", code: 1, userInfo: [NSLocalizedDescriptionKey: "empty-video"]) }
    guard asset.tracks(withMediaType: .video).first != nil else { throw NSError(domain: "gif", code: 4, userInfo: [NSLocalizedDescriptionKey: "no-video-track"]) }

    // Cap the clip so a long video doesn't produce a huge multi-MB GIF: at most the
    // first MAX_CLIP seconds, sampled at `fps`, hard-capped at MAX_FRAMES.
    let fps = 10.0
    let maxClip = 15.0
    let maxFrames = 150
    let clip = min(durationSec, maxClip)
    var frameCount = Int(clip * fps)
    frameCount = max(1, min(frameCount, maxFrames))
    let interval = clip / Double(frameCount)

    let generator = AVAssetImageGenerator(asset: asset)
    generator.appliesPreferredTrackTransform = true
    generator.requestedTimeToleranceBefore = CMTime(seconds: interval / 2, preferredTimescale: 600)
    generator.requestedTimeToleranceAfter = CMTime(seconds: interval / 2, preferredTimescale: 600)
    generator.maximumSize = CGSize(width: 480, height: 480)

    let gifType = UTType.gif.identifier as CFString
    guard let dest = CGImageDestinationCreateWithURL(outputURL as CFURL, gifType, frameCount, nil) else {
      throw NSError(domain: "gif", code: 2, userInfo: [NSLocalizedDescriptionKey: "dest-failed"])
    }
    let gifProps = [kCGImagePropertyGIFDictionary as String: [kCGImagePropertyGIFLoopCount as String: 0]]
    CGImageDestinationSetProperties(dest, gifProps as CFDictionary)
    let frameProps = [kCGImagePropertyGIFDictionary as String: [kCGImagePropertyGIFUnclampedDelayTime as String: interval]]

    for i in 0..<frameCount {
      let t = CMTime(seconds: Double(i) * interval, preferredTimescale: 600)
      let cgImage = try generator.copyCGImage(at: t, actualTime: nil)
      CGImageDestinationAddImage(dest, cgImage, frameProps as CFDictionary)
    }

    guard CGImageDestinationFinalize(dest) else {
      throw NSError(domain: "gif", code: 3, userInfo: [NSLocalizedDescriptionKey: "finalize-failed"])
    }
  }
}
