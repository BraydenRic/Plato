Pod::Spec.new do |s|
  s.name           = 'PlatoHealth'
  s.version        = '1.0.0'
  s.summary        = 'Reads cardio workouts from Apple Health for Plato'
  s.description    = 'Read-only HealthKit access: lists cardio workouts and the distance readings their splits are worked out from.'
  s.author         = ''
  s.homepage       = 'https://plato-workouts.web.app/'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.frameworks = 'HealthKit'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "**/*.{h,m,mm,swift}"
end
