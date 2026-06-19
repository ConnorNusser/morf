import ActivityKit
import ExpoModulesCore

// JS-facing module. Starts/updates/ends the activity and ferries data through the
// App Group. `MorfLiveActivityAttributes` + `AppGroupStore` are compiled in via
// the podspec's shared source_files (see LiveActivity.podspec).
public class LiveActivityModule: Module {
  public func definition() -> ModuleDefinition {
    Name("LiveActivity")

    Function("isSupported") { () -> Bool in
      if #available(iOS 16.2, *) {
        return ActivityAuthorizationInfo().areActivitiesEnabled
      }
      return false
    }

    AsyncFunction("start") { (content: [String: Any]) -> String? in
      guard #available(iOS 16.2, *) else { return nil }
      let state = Self.state(from: content)
      do {
        let activity = try Activity.request(
          attributes: MorfLiveActivityAttributes(),
          content: .init(state: state, staleDate: nil)
        )
        return activity.id
      } catch {
        return nil
      }
    }

    AsyncFunction("update") { (content: [String: Any]) in
      guard #available(iOS 16.2, *) else { return }
      let state = Self.state(from: content)
      for activity in Activity<MorfLiveActivityAttributes>.activities {
        await activity.update(.init(state: state, staleDate: nil))
      }
    }

    AsyncFunction("end") {
      guard #available(iOS 16.2, *) else { return }
      for activity in Activity<MorfLiveActivityAttributes>.activities {
        await activity.end(nil, dismissalPolicy: .immediate)
      }
    }

    // Ordered working sets, so a CompleteSet intent can advance without the app.
    AsyncFunction("saveWorkoutSnapshot") { (sets: [[String: Any]]) in
      AppGroupStore.saveSnapshot(sets)
    }

    AsyncFunction("pullPendingActions") { () -> [[String: Any]] in
      AppGroupStore.drainPendingActions()
    }
  }

  @available(iOS 16.2, *)
  private static func state(from content: [String: Any]) -> MorfLiveActivityAttributes.State {
    let mode = content["mode"] as? String ?? "rest"
    let title = content["workoutTitle"] as? String ?? "Workout"

    if mode == "set", let set = content["set"] as? [String: Any] {
      return .init(
        mode: "set",
        workoutTitle: title,
        exerciseKey: set["exerciseKey"] as? String,
        setExerciseName: set["exerciseName"] as? String,
        setNumber: set["setNumber"] as? Int,
        totalSets: set["totalSets"] as? Int,
        reps: set["reps"] as? Int,
        weight: set["weight"] as? Double,
        unit: set["unit"] as? String
      )
    }

    let rest = content["rest"] as? [String: Any]
    let endMs = (rest?["endTime"] as? Double) ?? 0
    return .init(
      mode: "rest",
      workoutTitle: title,
      restEndTime: Date(timeIntervalSince1970: endMs / 1000.0),
      restExerciseName: rest?["exerciseName"] as? String,
      nextLabel: rest?["nextLabel"] as? String
    )
  }
}
