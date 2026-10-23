# Not "PlatoWatch": that's the watch app's target, and two targets of one
# name in the same workspace is asking for a confusing build failure.
Pod::Spec.new do |s|
  s.name           = 'PlatoWatchBridge'
  s.version        = '1.0.0'
  s.summary        = 'WatchConnectivity bridge between Plato and its Apple Watch app'
  s.description    = 'Sends the workout in progress to the watch and queues what the watch logs until JavaScript applies it.'
  s.author         = ''
  s.homepage       = 'https://braydenric.github.io/plato'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'WatchConnectivity'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift}"
end
