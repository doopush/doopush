require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'DooPushReactNativeSDK'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.license        = package['license']
  s.author         = 'DooPush'
  s.homepage       = package['repository']['url']
  s.platforms      = { :ios => '13.0' }
  s.swift_version  = '5.9'
  s.source         = { :git => package['repository']['url'], :tag => "v#{s.version}" }
  s.static_framework = true

  # Native SDK dependency.
  s.dependency 'DooPushSDK', '~> 1.2'

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
  s.exclude_files = 'Tests/**/*'

  # Pod target xcconfig to handle dependency resolution.
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }
end
