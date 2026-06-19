import ActivityKit
import AppIntents

// Mutates the running activity from an App Intent. The perform() of a
// LiveActivityIntent runs in the APP process, so this file is compiled into both
// the widget extension AND the app (module pod) — see docs/SPIKE.md.
@available(iOS 16.2, *)
enum LiveActivityMutator {
  static func current() -> Activity<MorfLiveActivityAttributes>? {
    Activity<MorfLiveActivityAttributes>.activities.first
  }

  // MARK: set mode

  static func adjustReps(by delta: Int) async {
    guard let activity = current() else { return }
    var s = activity.content.state
    guard s.mode == "set" else { return }
    s.reps = max(0, (s.reps ?? 0) + delta)
    await activity.update(.init(state: s, staleDate: nil))
    if let key = s.exerciseKey, let n = s.setNumber {
      AppGroupStore.appendPendingAction([
        "type": "adjustReps", "exerciseKey": key, "setIndex": n - 1, "reps": s.reps ?? 0,
      ])
    }
  }

  static func adjustWeight(by delta: Double) async {
    guard let activity = current() else { return }
    var s = activity.content.state
    guard s.mode == "set" else { return }
    s.weight = max(0, (s.weight ?? 0) + delta)
    await activity.update(.init(state: s, staleDate: nil))
    if let key = s.exerciseKey, let n = s.setNumber {
      AppGroupStore.appendPendingAction([
        "type": "adjustWeight", "exerciseKey": key, "setIndex": n - 1, "weight": s.weight ?? 0,
      ])
    }
  }

  static func completeSet() async {
    guard let activity = current() else { return }
    let s = activity.content.state
    guard s.mode == "set", let key = s.exerciseKey, let n = s.setNumber else { return }

    AppGroupStore.appendPendingAction([
      "type": "completeSet", "exerciseKey": key, "setIndex": n - 1,
      "reps": s.reps ?? 0, "weight": s.weight ?? 0,
    ])

    // Jump to the next not-done set, computed from the shared snapshot — so the
    // Lock Screen advances (across exercises) even with the app suspended.
    if let next = AppGroupStore.completeAndAdvance(exerciseKey: key, setNumber: n) {
      let ns = MorfLiveActivityAttributes.State(
        mode: "set",
        workoutTitle: s.workoutTitle,
        exerciseKey: next["exerciseKey"] as? String,
        setExerciseName: next["exerciseName"] as? String,
        setNumber: next["setNumber"] as? Int,
        totalSets: next["totalSets"] as? Int,
        reps: next["reps"] as? Int,
        weight: next["weight"] as? Double,
        unit: next["unit"] as? String
      )
      await activity.update(.init(state: ns, staleDate: nil))
    } else {
      await activity.end(nil, dismissalPolicy: .immediate)
    }
  }

  // MARK: rest mode

  static func addRest(seconds: Int) async {
    guard let activity = current() else { return }
    var s = activity.content.state
    guard s.mode == "rest", let end = s.restEndTime else { return }
    let newEnd = end.addingTimeInterval(Double(seconds))
    if newEnd <= Date() {
      AppGroupStore.appendPendingAction(["type": "skipRest"])
      await activity.end(nil, dismissalPolicy: .immediate)
      return
    }
    s.restEndTime = newEnd
    await activity.update(.init(state: s, staleDate: nil))
    AppGroupStore.appendPendingAction(["type": "addRest", "seconds": seconds])
  }

  static func endRest() async {
    AppGroupStore.appendPendingAction(["type": "skipRest"])
    if let activity = current() {
      await activity.end(nil, dismissalPolicy: .immediate)
    }
  }
}

@available(iOS 17.0, *)
struct AdjustRepsIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Adjust reps"
  @Parameter(title: "Delta") var delta: Int
  init() {}
  init(delta: Int) { self.delta = delta }
  func perform() async throws -> some IntentResult {
    await LiveActivityMutator.adjustReps(by: delta)
    return .result()
  }
}

@available(iOS 17.0, *)
struct AdjustWeightIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Adjust weight"
  @Parameter(title: "Delta") var delta: Double
  init() {}
  init(delta: Double) { self.delta = delta }
  func perform() async throws -> some IntentResult {
    await LiveActivityMutator.adjustWeight(by: delta)
    return .result()
  }
}

@available(iOS 17.0, *)
struct CompleteSetIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Complete set"
  init() {}
  func perform() async throws -> some IntentResult {
    await LiveActivityMutator.completeSet()
    return .result()
  }
}

@available(iOS 17.0, *)
struct AddRestIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "Adjust rest"
  @Parameter(title: "Seconds") var seconds: Int
  init() {}
  init(seconds: Int) { self.seconds = seconds }
  func perform() async throws -> some IntentResult {
    await LiveActivityMutator.addRest(seconds: seconds)
    return .result()
  }
}

@available(iOS 17.0, *)
struct EndRestIntent: LiveActivityIntent {
  static var title: LocalizedStringResource = "End rest"
  init() {}
  func perform() async throws -> some IntentResult {
    await LiveActivityMutator.endRest()
    return .result()
  }
}
