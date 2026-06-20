import Foundation

// Tiny shared store backed by the App Group, so the widget's App Intents and the
// app/module can pass data both ways:
//  - the app writes the current workout snapshot (for "advance to next set")
//  - the widget writes pending actions (taps) for the app to reconcile on resume
public enum AppGroupStore {
  public static let suiteName = "group.com.vanquil.morfai"

  private static var defaults: UserDefaults? {
    UserDefaults(suiteName: suiteName)
  }

  private static let pendingKey = "pendingActions"
  private static let snapshotKey = "workoutSnapshot"

  // MARK: - Pending actions (widget → app)

  public static func appendPendingAction(_ action: [String: Any]) {
    guard let d = defaults else { return }
    var list = d.array(forKey: pendingKey) as? [[String: Any]] ?? []
    list.append(action)
    d.set(list, forKey: pendingKey)
  }

  /// Returns and clears the queued actions.
  public static func drainPendingActions() -> [[String: Any]] {
    guard let d = defaults else { return [] }
    let list = d.array(forKey: pendingKey) as? [[String: Any]] ?? []
    d.removeObject(forKey: pendingKey)
    return list
  }

  // MARK: - Workout snapshot (app → widget intents)

  /// Stores the ordered working sets so a CompleteSet intent can find the next
  /// not-done set without the app running. Shape:
  /// [{ exerciseKey, exerciseName, setNumber, totalSets, reps, weight, unit, done }]
  public static func saveSnapshot(_ sets: [[String: Any]]) {
    defaults?.set(sets, forKey: snapshotKey)
  }

  public static func loadSnapshot() -> [[String: Any]] {
    defaults?.array(forKey: snapshotKey) as? [[String: Any]] ?? []
  }

  /// Marks one set done in the snapshot and returns the next not-done set, if any.
  public static func completeAndAdvance(exerciseKey: String, setNumber: Int) -> [String: Any]? {
    guard let d = defaults else { return nil }
    var snap = loadSnapshot()
    if let i = snap.firstIndex(where: {
      ($0["exerciseKey"] as? String) == exerciseKey && ($0["setNumber"] as? Int) == setNumber
    }) {
      snap[i]["done"] = true
      d.set(snap, forKey: snapshotKey)
    }
    return snap.first { ($0["done"] as? Bool) != true }
  }

  /// Appends a "keep going" bonus set — a not-done copy of the exercise's last
  /// set — so finishing the final planned set rolls into another instead of
  /// ending the activity. Returns the new set. The app mirrors this on resume.
  public static func appendBonusSet(exerciseKey: String) -> [String: Any]? {
    guard let d = defaults else { return nil }
    var snap = loadSnapshot()
    let exSets = snap.filter { ($0["exerciseKey"] as? String) == exerciseKey }
    guard var bonus = exSets.last else { return nil }
    let newTotal = exSets.count + 1
    bonus["setNumber"] = newTotal
    bonus["totalSets"] = newTotal
    bonus["done"] = false
    // Keep the count consistent across the exercise's existing rows too.
    for i in snap.indices where (snap[i]["exerciseKey"] as? String) == exerciseKey {
      snap[i]["totalSets"] = newTotal
    }
    snap.append(bonus)
    d.set(snap, forKey: snapshotKey)
    return bonus
  }
}
