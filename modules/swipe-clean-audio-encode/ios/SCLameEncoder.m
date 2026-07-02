#import "SCLameEncoder.h"
#import <AVFoundation/AVFoundation.h>
#import "lame.h"

static NSError *SCLameError(NSString *msg) {
  return [NSError errorWithDomain:@"SCLame" code:1 userInfo:@{NSLocalizedDescriptionKey: msg}];
}

@implementation SCLameEncoder

+ (BOOL)encodeVideoAtPath:(NSString *)inputPath
                toMp3Path:(NSString *)outputPath
                  bitrate:(int)bitrate
                    error:(NSError *_Nullable *_Nullable)error {
  NSURL *inputURL = [NSURL fileURLWithPath:inputPath];
  NSURL *outputURL = [NSURL fileURLWithPath:outputPath];
  [[NSFileManager defaultManager] removeItemAtURL:outputURL error:nil];

  AVURLAsset *asset = [AVURLAsset URLAssetWithURL:inputURL options:nil];
  AVAssetTrack *track = [[asset tracksWithMediaType:AVMediaTypeAudio] firstObject];
  if (!track) {
    if (error) *error = SCLameError(@"no-audio-track");
    return NO;
  }

  const int channels = 2;
  const int sampleRate = 44100;
  NSDictionary *settings = @{
    AVFormatIDKey: @(kAudioFormatLinearPCM),
    AVSampleRateKey: @(sampleRate),
    AVNumberOfChannelsKey: @(channels),
    AVLinearPCMBitDepthKey: @(16),
    AVLinearPCMIsBigEndianKey: @(NO),
    AVLinearPCMIsFloatKey: @(NO),
    AVLinearPCMIsNonInterleaved: @(NO)
  };

  NSError *readerErr = nil;
  AVAssetReader *reader = [[AVAssetReader alloc] initWithAsset:asset error:&readerErr];
  if (!reader) {
    if (error) *error = readerErr ?: SCLameError(@"reader-init-failed");
    return NO;
  }
  AVAssetReaderTrackOutput *readerOutput = [[AVAssetReaderTrackOutput alloc] initWithTrack:track outputSettings:settings];
  [reader addOutput:readerOutput];
  [reader startReading];

  lame_t lame = lame_init();
  if (!lame) {
    if (error) *error = SCLameError(@"lame-init-failed");
    return NO;
  }
  lame_set_num_channels(lame, channels);
  lame_set_in_samplerate(lame, sampleRate);
  lame_set_brate(lame, bitrate > 0 ? bitrate : 192);
  lame_set_mode(lame, JOINT_STEREO);
  lame_set_quality(lame, 3);
  if (lame_init_params(lame) < 0) {
    lame_close(lame);
    if (error) *error = SCLameError(@"lame-params-failed");
    return NO;
  }

  FILE *out = fopen([outputPath fileSystemRepresentation], "wb");
  if (!out) {
    lame_close(lame);
    if (error) *error = SCLameError(@"output-open-failed");
    return NO;
  }

  BOOL ok = YES;
  while (reader.status == AVAssetReaderStatusReading) {
    CMSampleBufferRef sb = [readerOutput copyNextSampleBuffer];
    if (!sb) break;
    CMBlockBufferRef bb = CMSampleBufferGetDataBuffer(sb);
    if (bb) {
      size_t length = 0;
      char *dataPtr = NULL;
      if (CMBlockBufferGetDataPointer(bb, 0, NULL, &length, &dataPtr) == kCMBlockBufferNoErr && dataPtr && length > 0) {
        int samplesPerChannel = (int)(length / (2 * channels));
        int mp3cap = (int)(1.25 * samplesPerChannel + 7200);
        unsigned char *mp3buf = malloc(mp3cap);
        if (mp3buf) {
          int written = lame_encode_buffer_interleaved(lame, (short *)dataPtr, samplesPerChannel, mp3buf, mp3cap);
          if (written > 0) fwrite(mp3buf, 1, (size_t)written, out);
          else if (written < 0) ok = NO;
          free(mp3buf);
        }
      }
    }
    CMSampleBufferInvalidate(sb);
    CFRelease(sb);
    if (!ok) break;
  }

  unsigned char flushbuf[7200];
  int flushed = lame_encode_flush(lame, flushbuf, (int)sizeof(flushbuf));
  if (flushed > 0) fwrite(flushbuf, 1, (size_t)flushed, out);

  fclose(out);
  lame_close(lame);

  if (reader.status == AVAssetReaderStatusFailed || !ok) {
    if (error) *error = reader.error ?: SCLameError(@"encode-failed");
    return NO;
  }
  return YES;
}

@end
