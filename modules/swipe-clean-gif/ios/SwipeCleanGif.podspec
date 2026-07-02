Pod::Spec.new do |s|
  s.name           = 'SwipeCleanGif'
  s.version        = '1.0.0'
  s.summary        = 'Convert a video into an animated GIF'
  s.description    = 'Samples video frames (AVAssetImageGenerator) and encodes an animated GIF via ImageIO — OS frameworks only, no third-party libs.'
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
