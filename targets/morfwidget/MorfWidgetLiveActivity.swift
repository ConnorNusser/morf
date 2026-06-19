import ActivityKit
import SwiftUI
import WidgetKit

// Modern emerald accent (swapped from indigo). Easy to retune in one place.
private let kAccent = Color(red: 0.16, green: 0.80, blue: 0.52) // ~#29CC85
private let kBlue = Color(red: 0.20, green: 0.52, blue: 1.0)    // modern blue CTA ~#3385FF

private extension View {
  // Crisp rolling-digit update. numericText is iOS 17+ inside app extensions, so
  // gate it; below 17 the value just changes without the transition.
  @ViewBuilder func numericRoll(_ value: Double) -> some View {
    if #available(iOS 17.0, *) {
      contentTransition(.numericText(value: value))
    } else {
      self
    }
  }
}

// Widget extension entry point.
@main
struct MorfWidgetBundle: WidgetBundle {
  var body: some Widget {
    if #available(iOS 16.2, *) {
      MorfLiveActivityWidget()
    }
  }
}

@available(iOS 16.2, *)
struct MorfLiveActivityWidget: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: MorfLiveActivityAttributes.self) { context in
      LockScreen(s: context.state)
        .padding(.horizontal, 14).padding(.vertical, 11)
        // Translucent tint over the system material → glassy, wallpaper shows through.
        .activityBackgroundTint(Color.black.opacity(0.28))
        .activitySystemActionForegroundColor(.white)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.center) {
          LockScreen(s: context.state).padding(.vertical, 2)
        }
      } compactLeading: {
        Image(systemName: context.state.mode == "rest" ? "timer" : "dumbbell.fill")
          .foregroundStyle(kAccent)
      } compactTrailing: {
        CompactValue(s: context.state)
      } minimal: {
        Image(systemName: context.state.mode == "rest" ? "timer" : "dumbbell.fill")
          .foregroundStyle(kAccent)
      }
    }
  }
}

@available(iOS 16.2, *)
struct LockScreen: View {
  let s: MorfLiveActivityAttributes.State
  var body: some View {
    if s.mode == "set" { SetCard(s: s) } else { RestCard(s: s) }
  }
}

// "Album art" style tile — an SF Symbol on an accent gradient (e.g. the rest timer).
@available(iOS 16.2, *)
private struct ArtTile: View {
  let symbol: String
  var body: some View {
    RoundedRectangle(cornerRadius: 10, style: .continuous)
      .fill(LinearGradient(colors: [kAccent, kAccent.opacity(0.6)], startPoint: .topLeading, endPoint: .bottomTrailing))
      .frame(width: 38, height: 38)
      .overlay(Image(systemName: symbol).font(.system(size: 17, weight: .bold)).foregroundStyle(.white))
  }
}

// The Morf mark as the set card's "album art".
@available(iOS 16.2, *)
private struct LogoTile: View {
  var body: some View {
    Image("MorfLogo").resizable().aspectRatio(contentMode: .fill)
      .frame(width: 38, height: 38)
      .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
  }
}

@available(iOS 16.2, *)
private func stepIcon(_ name: String) -> some View {
  Image(systemName: name)
    .font(.system(size: 14, weight: .bold))
    .foregroundStyle(.white)
    .frame(width: 30, height: 30)
    .background(.ultraThinMaterial, in: Circle())
}

// MARK: - Set card

@available(iOS 16.2, *)
struct SetCard: View {
  let s: MorfLiveActivityAttributes.State
  private var unit: String { s.unit ?? "lbs" }
  private var wDelta: Double { unit == "kg" ? 2.5 : 5 }
  private var wStr: String { let w = s.weight ?? 0; return w == w.rounded() ? String(Int(w)) : String(w) }

  var body: some View {
    VStack(spacing: 9) {
      HStack(spacing: 10) {
        LogoTile()
        VStack(alignment: .leading, spacing: 1) {
          Text(s.setExerciseName ?? "Exercise")
            .font(.system(.headline, design: .rounded).weight(.bold))
            .foregroundStyle(.white).lineLimit(1)
          Text("Set \(s.setNumber ?? 0) of \(s.totalSets ?? 0)")
            .font(.caption).foregroundStyle(.white.opacity(0.5))
        }
        Spacer(minLength: 0)
      }

      HStack(spacing: 9) {
        weightStepper
        repsStepper
      }

      completeButton
    }
  }

  @ViewBuilder private var weightStepper: some View {
    HStack(spacing: 12) {
      if #available(iOS 17.0, *) {
        Button(intent: AdjustWeightIntent(delta: -wDelta)) { stepIcon("minus") }.buttonStyle(.plain)
      }
      VStack(spacing: -1) {
        Text(wStr).font(.system(.title2, design: .rounded).weight(.semibold)).foregroundStyle(.white)
          .monospacedDigit().numericRoll(s.weight ?? 0)
        Text(unit).font(.system(size: 10, weight: .medium)).textCase(.uppercase)
          .tracking(0.6).foregroundStyle(.white.opacity(0.4))
      }
      if #available(iOS 17.0, *) {
        Button(intent: AdjustWeightIntent(delta: wDelta)) { stepIcon("plus") }.buttonStyle(.plain)
      }
    }
    .frame(maxWidth: .infinity)
  }

  @ViewBuilder private var repsStepper: some View {
    HStack(spacing: 12) {
      if #available(iOS 17.0, *) {
        Button(intent: AdjustRepsIntent(delta: -1)) { stepIcon("minus") }.buttonStyle(.plain)
      }
      VStack(spacing: -1) {
        Text("\(s.reps ?? 0)").font(.system(.title2, design: .rounded).weight(.semibold)).foregroundStyle(.white)
          .monospacedDigit().numericRoll(Double(s.reps ?? 0))
        Text("reps").font(.system(size: 10, weight: .medium)).textCase(.uppercase)
          .tracking(0.6).foregroundStyle(.white.opacity(0.4))
      }
      if #available(iOS 17.0, *) {
        Button(intent: AdjustRepsIntent(delta: 1)) { stepIcon("plus") }.buttonStyle(.plain)
      }
    }
    .frame(maxWidth: .infinity)
  }

  @ViewBuilder private var completeButton: some View {
    if #available(iOS 17.0, *) {
      Button(intent: CompleteSetIntent()) {
        HStack(spacing: 5) {
          Image(systemName: "checkmark.circle.fill")
          Text("Complete set").font(.system(.subheadline, design: .rounded).weight(.semibold))
        }
        .foregroundStyle(.white)
        .frame(maxWidth: .infinity).padding(.vertical, 9)
        .background(kBlue, in: Capsule())
      }.buttonStyle(.plain)
    } else {
      Text("Open Morf to log this set").font(.footnote).foregroundStyle(.white.opacity(0.5))
    }
  }
}

// MARK: - Rest card

@available(iOS 16.2, *)
struct RestCard: View {
  let s: MorfLiveActivityAttributes.State

  var body: some View {
    VStack(spacing: 10) {
      HStack(spacing: 10) {
        ArtTile(symbol: "timer")
        VStack(alignment: .leading, spacing: 1) {
          Text("REST").font(.caption2.weight(.bold)).tracking(1.5).foregroundStyle(kAccent)
          Text(s.nextLabel ?? s.restExerciseName ?? "Recovering")
            .font(.caption).foregroundStyle(.white.opacity(0.6)).lineLimit(1)
        }
        Spacer(minLength: 8)
        if let end = s.restEndTime {
          Text(timerInterval: Date()...end, countsDown: true)
            .font(.system(size: 28, weight: .bold, design: .rounded)).monospacedDigit()
            .foregroundStyle(.white).frame(minWidth: 74).multilineTextAlignment(.trailing)
        }
      }

      if #available(iOS 17.0, *) {
        HStack(spacing: 8) {
          restPill("−30s", intent: AddRestIntent(seconds: -30))
          Button(intent: EndRestIntent()) {
            Text("End").font(.system(.subheadline, design: .rounded).weight(.semibold))
              .foregroundStyle(.white).frame(maxWidth: .infinity).padding(.vertical, 8)
              .background(.ultraThinMaterial, in: Capsule())
          }.buttonStyle(.plain)
          restPill("+30s", intent: AddRestIntent(seconds: 30))
        }
      } else {
        Text("Open Morf to control rest").font(.footnote).foregroundStyle(.white.opacity(0.5))
      }
    }
  }

  @available(iOS 17.0, *)
  private func restPill(_ label: String, intent: AddRestIntent) -> some View {
    Button(intent: intent) {
      Text(label).font(.system(.subheadline, design: .rounded).weight(.semibold))
        .foregroundStyle(.white).frame(maxWidth: .infinity).padding(.vertical, 8)
        .background(.ultraThinMaterial, in: Capsule())
    }.buttonStyle(.plain)
  }
}

@available(iOS 16.2, *)
struct CompactValue: View {
  let s: MorfLiveActivityAttributes.State
  var body: some View {
    if s.mode == "rest", let end = s.restEndTime {
      Text(timerInterval: Date()...end, countsDown: true)
        .monospacedDigit().foregroundStyle(.white).frame(maxWidth: 52)
    } else {
      Text("\(s.reps ?? 0)").font(.system(.body, design: .rounded).weight(.semibold)).foregroundStyle(.white)
    }
  }
}
