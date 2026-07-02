Pod::Spec.new do |s|
  s.name           = 'SwipeCleanAudioEncode'
  s.version        = '1.0.0'
  s.summary        = 'Encode/extract audio (M4A, WAV, MP3) from a video'
  s.description    = 'Extracts a video audio track to M4A (AVAssetExportSession), WAV (AVAssetReader PCM + RIFF), or MP3 (bundled LAME 3.100, LGPL).'
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
    'SWIFT_COMPILATION_MODE' => 'wholemodule',
    # HAVE_CONFIG_H pulls in our hand-written config.h; header paths reach the
    # vendored LAME, which lives INSIDE ios/ so the pod is self-contained (no `../`
    # entries that would shift CocoaPods' base dir and break header visibility).
    'GCC_PREPROCESSOR_DEFINITIONS' => '$(inherited) HAVE_CONFIG_H=1',
    'HEADER_SEARCH_PATHS' => '"$(PODS_TARGET_SRCROOT)/lame" "$(PODS_TARGET_SRCROOT)/lame/libmp3lame" "$(PODS_TARGET_SRCROOT)/lame/mpglib" "$(PODS_TARGET_SRCROOT)/lame/include"',
    'GCC_WARN_INHIBIT_ALL_WARNINGS' => 'YES'
  }

  # Expose only the ObjC wrapper header to the module umbrella (so Swift sees
  # SCLameEncoder); LAME's own headers stay private.
  s.public_header_files = "SCLameEncoder.h"
  s.preserve_paths = "lame/**/*"

  s.source_files = [
    "*.{h,m,swift}",
    "lame/libmp3lame/*.{c,h}",
    "lame/libmp3lame/vector/*.{c,h}",
    "lame/mpglib/*.{c,h}",
    "lame/include/lame.h",
    "lame/config.h"
  ]
end
