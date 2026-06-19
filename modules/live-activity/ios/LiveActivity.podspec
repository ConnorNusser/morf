require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', '..', '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'LiveActivity'
  s.version        = '1.0.0'
  s.summary        = 'Drive iOS Live Activities (rest timer + interactive set logging) from JS.'
  s.author         = package['author'] || ''
  s.homepage       = 'https://github.com/ConnorNusser/morf'
  s.platforms      = { :ios => '16.2' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.swift_version  = '5.9'

  # The module's own Swift + the Attributes/AppGroupStore shared with the widget
  # extension. Compiling the SAME files into both targets is what lets ActivityKit
  # match the activity type across the app and the widget. See docs/SPIKE.md.
  s.source_files = '*.swift', '../../../targets/morfwidget/Shared/*.swift'
end
