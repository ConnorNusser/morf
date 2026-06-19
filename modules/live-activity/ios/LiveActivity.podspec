require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', '..', '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'LiveActivity'
  s.version        = '1.0.0'
  s.summary        = 'Drive iOS Live Activities (rest timer + interactive set logging) from JS.'
  s.author         = package['author'] || ''
  s.homepage       = 'https://github.com/ConnorNusser/morf'
  # Must be <= the app's deployment target or autolinking drops this pod from the
  # modules provider. All ActivityKit/App Intents code is @available-guarded, so a
  # lower floor is safe.
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.swift_version  = '5.9'

  # CocoaPods only compiles files inside the pod's own dir, so the module keeps
  # its own copy of the Attributes/AppGroupStore types (mirrors
  # targets/morfwidget/Shared/*). The app and widget are separate binaries either
  # way — ActivityKit matches the activity by the type NAME, so identical copies
  # in each target interoperate. Keep the two copies in sync.
  s.source_files = '*.swift'
end
