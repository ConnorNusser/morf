import ActivityKit
import SwiftUI
import WidgetKit

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
      LockScreenView(state: context.state)
        .padding(16)
        .activityBackgroundTint(Color.black.opacity(0.9))
        .activitySystemActionForegroundColor(.white)
    } dynamicIsland: { context in
      DynamicIsland {
        DynamicIslandExpandedRegion(.center) {
          LockScreenView(state: context.state).padding(.vertical, 6)
        }
      } compactLeading: {
        Image(systemName: context.state.mode == "rest" ? "timer" : "dumbbell.fill")
      } compactTrailing: {
        CompactTrailing(state: context.state)
      } minimal: {
        Image(systemName: context.state.mode == "rest" ? "timer" : "dumbbell.fill")
      }
    }
  }
}

// MARK: - Lock screen / expanded

@available(iOS 16.2, *)
struct LockScreenView: View {
  let state: MorfLiveActivityAttributes.State
  var body: some View {
    if state.mode == "set" {
      SetView(state: state)
    } else {
      RestView(state: state)
    }
  }
}

@available(iOS 16.2, *)
struct RestView: View {
  let state: MorfLiveActivityAttributes.State
  var body: some View {
    VStack(spacing: 4) {
      Text((state.restExerciseName ?? "Rest").uppercased())
        .font(.caption2).foregroundStyle(.secondary)
      if let end = state.restEndTime {
        Text(timerInterval: Date()...end, countsDown: true)
          .font(.system(size: 36, weight: .bold, design: .rounded))
          .monospacedDigit()
          .multilineTextAlignment(.center)
      }
      if let next = state.nextLabel {
        Text(next).font(.footnote).foregroundStyle(.secondary)
      }
    }
    .frame(maxWidth: .infinity)
  }
}

@available(iOS 16.2, *)
struct SetView: View {
  let state: MorfLiveActivityAttributes.State

  private var weightDelta: Double { (state.unit == "kg") ? 2.5 : 5 }
  private var weightLabel: String {
    let w = state.weight ?? 0
    let s = w.truncatingRemainder(dividingBy: 1) == 0 ? String(Int(w)) : String(w)
    return "\(s) \(state.unit ?? "lbs")"
  }

  var body: some View {
    VStack(spacing: 8) {
      HStack {
        Text(state.setExerciseName ?? "Exercise").font(.headline).lineLimit(1)
        Spacer()
        Text("Set \(state.setNumber ?? 0)/\(state.totalSets ?? 0)")
          .font(.subheadline).foregroundStyle(.secondary)
      }

      HStack(spacing: 16) {
        weightStepper
        repsStepper
      }

      completeButton
    }
  }

  @ViewBuilder private var repsStepper: some View {
    HStack(spacing: 6) {
      if #available(iOS 17.0, *) {
        Button(intent: AdjustRepsIntent(delta: -1)) { Image(systemName: "minus.circle.fill") }
          .buttonStyle(.plain)
      }
      Text("\(state.reps ?? 0) reps").font(.system(.body, design: .rounded)).monospacedDigit().frame(minWidth: 60)
      if #available(iOS 17.0, *) {
        Button(intent: AdjustRepsIntent(delta: 1)) { Image(systemName: "plus.circle.fill") }
          .buttonStyle(.plain)
      }
    }
  }

  @ViewBuilder private var weightStepper: some View {
    HStack(spacing: 6) {
      if #available(iOS 17.0, *) {
        Button(intent: AdjustWeightIntent(delta: -weightDelta)) { Image(systemName: "minus.circle.fill") }
          .buttonStyle(.plain)
      }
      Text(weightLabel).font(.system(.body, design: .rounded)).monospacedDigit().frame(minWidth: 64)
      if #available(iOS 17.0, *) {
        Button(intent: AdjustWeightIntent(delta: weightDelta)) { Image(systemName: "plus.circle.fill") }
          .buttonStyle(.plain)
      }
    }
  }

  @ViewBuilder private var completeButton: some View {
    if #available(iOS 17.0, *) {
      Button(intent: CompleteSetIntent()) {
        Text("Complete set").font(.headline).frame(maxWidth: .infinity)
      }
      .tint(.green)
      .buttonStyle(.borderedProminent)
    } else {
      Text("Open Morf to log this set").font(.footnote).foregroundStyle(.secondary)
    }
  }
}

@available(iOS 16.2, *)
struct CompactTrailing: View {
  let state: MorfLiveActivityAttributes.State
  var body: some View {
    if state.mode == "rest", let end = state.restEndTime {
      Text(timerInterval: Date()...end, countsDown: true)
        .monospacedDigit().frame(maxWidth: 56)
    } else {
      Text("\(state.reps ?? 0)×").monospacedDigit()
    }
  }
}
