#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

// Objective-C wrapper around the bundled LAME encoder. Reads a video's audio track
// as 16-bit stereo PCM (AVAssetReader) and CBR-encodes it to an MP3 file. Exposed
// to the module's Swift via the pod's umbrella header.
@interface SCLameEncoder : NSObject

+ (BOOL)encodeVideoAtPath:(NSString *)inputPath
                toMp3Path:(NSString *)outputPath
                  bitrate:(int)bitrate
                    error:(NSError *_Nullable *_Nullable)error;

@end

NS_ASSUME_NONNULL_END
