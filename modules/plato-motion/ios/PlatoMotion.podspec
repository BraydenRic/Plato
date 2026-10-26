Pod::Spec.new do |s|
  s.name           = 'PlatoMotion'
  s.version        = '1.0.0'
  s.summary        = "The iPhone's step counter, for Plato's cardio sessions"
  s.description    = 'Distance on foot from CMPedometer: live while a session runs, and per minute when it ends, for splits.'
  s.author         = ''
  s.homepage       = 'https://plato-workouts.web.app/'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'CoreMotion'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift}"
end
