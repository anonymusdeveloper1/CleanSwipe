Pod::Spec.new do |s|
  s.name           = 'SwipeCleanAudioEncode'
  s.version        = '1.0.0'
  s.summary        = 'Encode/extract audio (M4A, WAV) from a video'
  s.description    = 'Extracts a video audio track to M4A (AVAssetExportSession) or WAV (AVAssetReader PCM + RIFF).'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = {
    :ios => '15.1'
  }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  # Swift only. The vendored LAME 3.100 C sources and the SCLameEncoder ObjC
  # bridge were removed (PROJECT_CONTEXT 2026-08-22 c), which also retires the
  # HAVE_CONFIG_H define, the LAME header search paths, the public-header
  # declaration and the warning suppression that existed solely for LAME.
  s.source_files = "*.swift"
end
