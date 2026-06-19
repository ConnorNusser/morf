/** @type {import('@bacons/apple-targets').Config} */
module.exports = {
  type: 'widget',
  name: 'MorfWidget',
  // Must match the app's App Group so the widget intents and the app share state.
  entitlements: {
    'com.apple.security.application-groups': ['group.com.vanquil.morfai'],
  },
  // SwiftUI for the UI, ActivityKit/WidgetKit for the Live Activity, AppIntents
  // for the interactive buttons (iOS 17+).
  frameworks: ['SwiftUI', 'ActivityKit', 'WidgetKit', 'AppIntents'],
  deploymentTarget: '16.2',
  // NOTE: the Morf mark lives in this target's committed Assets.xcassets
  // (MorfLogo.imageset) → Image("MorfLogo"). We don't use apple-targets' `images`
  // config because its mod breaks incremental prebuild (removeFromProject); the
  // file-system-synchronized target group bundles the catalog automatically.
};
