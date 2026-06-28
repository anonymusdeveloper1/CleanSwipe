Pod::Spec.new do |s|
  s.name           = 'SwipeCleanAudioExtract'
  s.version        = '1.0.0'
  s.summary        = 'Extract audio (M4A) from a video'
  s.description    = 'Extracts a video audio track into an M4A file via AVAssetExportSession.'
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

  s.source_files = "**/*.{h,m,swift}"
end
