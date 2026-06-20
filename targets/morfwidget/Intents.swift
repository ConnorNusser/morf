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

  private static let kRestSeconds = 120.0

  static func completeSet() async {
    guard let activity = current() else { return }
    let s = activity.content.state
    guard s.mode == "set", let key = s.exerciseKey, let n = s.setNumber else { return }

    let restEnd = Date().addingTimeInterval(kRestSeconds)
    AppGroupStore.appendPendingAction([
      "type": "completeSet", "exerciseKey": key, "setIndex": n - 1,
      "reps": s.reps ?? 0, "weight": s.weight ?? 0,
    ])
    AppGroupStore.appendPendingAction([
      "type": "startRest", "endTime": restEnd.timeIntervalSince1970 * 1000,
    ])

    // Mark it done, then start a rest countdown (matches the in-app behavior).
    // The next set resumes when rest ends (End button or app reconcile).
    _ = AppGroupStore.completeAndAdvance(exerciseKey: key, setNumber: n)
    var next = nextNotDone()
    if next == nil {
      // Bottom of the list — spawn a "keep going" copy of this set so rest rolls
      // into another rep instead of ending the activity. App mirrors it on resume.
      next = AppGroupStore.appendBonusSet(exerciseKey: key)
      AppGroupStore.appendPendingAction(["type": "addBonusSet", "exerciseKey": key])
    }
    let nextLabel: String? = next.flatMap {
      guard let name = $0["exerciseName"] as? String, let sn = $0["setNumber"] as? Int else { return nil }
      return "Next: \(name) · Set \(sn)"
    }
    let rest = MorfLiveActivityAttributes.State(
      mode: "rest",
      workoutTitle: s.workoutTitle,
      restEndTime: restEnd,
      restExerciseName: s.setExerciseName,
      nextLabel: nextLabel
    )
    await activity.update(.init(state: rest, staleDate: nil))
  }

  private static func nextNotDone() -> [String: Any]? {
    AppGroupStore.loadSnapshot().first { ($0["done"] as? Bool) != true }
  }

  private static func setState(_ from: [String: Any], workoutTitle: String) -> MorfLiveActivityAttributes.State {
    MorfLiveActivityAttributes.State(
      mode: "set",
      workoutTitle: workoutTitle,
      exerciseKey: from["exerciseKey"] as? String,
      setExerciseName: from["exerciseName"] as? String,
      setNumber: from["setNumber"] as? Int,
      totalSets: from["totalSets"] as? Int,
      reps: from["reps"] as? Int,
      weight: from["weight"] as? Double,
      unit: from["unit"] as? String
    )
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
    guard let activity = current() else { return }
    AppGroupStore.appendPendingAction(["type": "skipRest"])
    // Rest over → resume the next not-done set; end the activity if none left.
    if let next = nextNotDone() {
      await activity.update(.init(state: setState(next, workoutTitle: activity.content.state.workoutTitle), staleDate: nil))
    } else {
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
