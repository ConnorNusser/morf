import ActivityKit
import SwiftUI
import WidgetKit

private let kAccent = Color(red: 0.42, green: 0.45, blue: 0.96) // indigo brand accent
private let kCard = Color(white: 0.07)

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
        .padding(14)
        .activityBackgroundTint(kCard)
        .activitySystemActionForegroundColor(.white)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.center) {
          LockScreen(s: context.state).padding(.vertical, 4)
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

// "Album art" style tile.
@available(iOS 16.2, *)
private struct ArtTile: View {
  let symbol: String
  var body: some View {
    RoundedRectangle(cornerRadius: 12, style: .continuous)
      .fill(LinearGradient(colors: [kAccent, kAccent.opacity(0.55)], startPoint: .topLeading, endPoint: .bottomTrailing))
      .frame(width: 46, height: 46)
      .overlay(Image(systemName: symbol).font(.system(size: 20, weight: .bold)).foregroundStyle(.white))
  }
}

@available(iOS 16.2, *)
private func stepIcon(_ name: String) -> some View {
  Image(systemName: name)
    .font(.system(size: 15, weight: .bold))
    .foregroundStyle(.white)
    .frame(width: 32, height: 32)
    .background(Color.white.opacity(0.14), in: Circle())
}

// MARK: - Set card

@available(iOS 16.2, *)
struct SetCard: View {
  let s: MorfLiveActivityAttributes.State
  private var unit: String { s.unit ?? "lbs" }
  private var wDelta: Double { unit == "kg" ? 2.5 : 5 }
  private var wStr: String { let w = s.weight ?? 0; return w == w.rounded() ? String(Int(w)) : String(w) }

  var body: some View {
    VStack(spacing: 12) {
      HStack(spacing: 12) {
        ArtTile(symbol: "dumbbell.fill")
        VStack(alignment: .leading, spacing: 2) {
          Text(s.setExerciseName ?? "Exercise")
            .font(.system(.title3, design: .rounded).weight(.bold))
            .foregroundStyle(.white).lineLimit(1)
          Text("Set \(s.setNumber ?? 0) of \(s.totalSets ?? 0)")
            .font(.subheadline).foregroundStyle(.white.opacity(0.5))
        }
        Spacer(minLength: 0)
      }

      HStack(spacing: 10) {
        weightStepper
        repsStepper
      }

      completeButton
    }
  }

  @ViewBuilder private var weightStepper: some View {
    HStack(spacing: 8) {
      if #available(iOS 17.0, *) {
        Button(intent: AdjustWeightIntent(delta: -wDelta)) { stepIcon("minus") }.buttonStyle(.plain)
      }
      VStack(spacing: 0) {
        Text(wStr).font(.system(.title3, design: .rounded).weight(.semibold)).foregroundStyle(.white).monospacedDigit()
        Text(unit).font(.caption2).foregroundStyle(.white.opacity(0.45))
      }.frame(maxWidth: .infinity)
      if #available(iOS 17.0, *) {
        Button(intent: AdjustWeightIntent(delta: wDelta)) { stepIcon("plus") }.buttonStyle(.plain)
      }
    }
    .padding(.vertical, 8).padding(.horizontal, 10)
    .background(Color.white.opacity(0.06), in: Capsule())
    .frame(maxWidth: .infinity)
  }

  @ViewBuilder private var repsStepper: some View {
    HStack(spacing: 8) {
      if #available(iOS 17.0, *) {
        Button(intent: AdjustRepsIntent(delta: -1)) { stepIcon("minus") }.buttonStyle(.plain)
      }
      VStack(spacing: 0) {
        Text("\(s.reps ?? 0)").font(.system(.title3, design: .rounded).weight(.semibold)).foregroundStyle(.white).monospacedDigit()
        Text("reps").font(.caption2).foregroundStyle(.white.opacity(0.45))
      }.frame(maxWidth: .infinity)
      if #available(iOS 17.0, *) {
        Button(intent: AdjustRepsIntent(delta: 1)) { stepIcon("plus") }.buttonStyle(.plain)
      }
    }
    .padding(.vertical, 8).padding(.horizontal, 10)
    .background(Color.white.opacity(0.06), in: Capsule())
    .frame(maxWidth: .infinity)
  }

  @ViewBuilder private var completeButton: some View {
    if #available(iOS 17.0, *) {
      Button(intent: CompleteSetIntent()) {
        HStack(spacing: 6) {
          Image(systemName: "checkmark.circle.fill")
          Text("Complete set").font(.system(.headline, design: .rounded))
        }
        .foregroundStyle(.white)
        .frame(maxWidth: .infinity).padding(.vertical, 11)
        .background(kAccent, in: Capsule())
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
    VStack(spacing: 12) {
      HStack(spacing: 12) {
        ArtTile(symbol: "timer")
        VStack(alignment: .leading, spacing: 2) {
          Text("REST").font(.caption.weight(.bold)).tracking(1.5).foregroundStyle(kAccent)
          Text(s.nextLabel ?? s.restExerciseName ?? "Recovering")
            .font(.subheadline).foregroundStyle(.white.opacity(0.6)).lineLimit(1)
        }
        Spacer(minLength: 8)
        if let end = s.restEndTime {
          Text(timerInterval: Date()...end, countsDown: true)
            .font(.system(size: 30, weight: .bold, design: .rounded)).monospacedDigit()
            .foregroundStyle(.white).frame(minWidth: 78).multilineTextAlignment(.trailing)
        }
      }

      if #available(iOS 17.0, *) {
        HStack(spacing: 8) {
          restPill("−30s", intent: AddRestIntent(seconds: -30))
          Button(intent: EndRestIntent()) {
            Text("End").font(.system(.subheadline, design: .rounded).weight(.semibold))
              .foregroundStyle(.white).frame(maxWidth: .infinity).padding(.vertical, 9)
              .background(Color.white.opacity(0.14), in: Capsule())
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
        .foregroundStyle(.white).frame(maxWidth: .infinity).padding(.vertical, 9)
        .background(Color.white.opacity(0.06), in: Capsule())
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
