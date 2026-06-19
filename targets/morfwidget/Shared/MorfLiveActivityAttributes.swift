import ActivityKit
import Foundation

// The single source of truth for the activity shape, compiled into BOTH the app
// (via LiveActivity.podspec) and the widget extension (it lives in the target).
// Mirrors lib/liveActivity/types.ts — keep the two in sync.

public struct MorfLiveActivityAttributes: ActivityAttributes {
  public typealias ContentState = State

  public struct State: Codable, Hashable {
    public var mode: String          // "rest" | "set"
    public var workoutTitle: String

    // rest mode
    public var restEndTime: Date?    // self-ticking countdown target
    public var restExerciseName: String?
    public var nextLabel: String?

    // set mode
    public var exerciseKey: String?  // draft row key, for reconcile
    public var setExerciseName: String?
    public var setNumber: Int?
    public var totalSets: Int?
    public var reps: Int?
    public var weight: Double?
    public var unit: String?         // "lbs" | "kg"

    public init(
      mode: String,
      workoutTitle: String,
      restEndTime: Date? = nil,
      restExerciseName: String? = nil,
      nextLabel: String? = nil,
      exerciseKey: String? = nil,
      setExerciseName: String? = nil,
      setNumber: Int? = nil,
      totalSets: Int? = nil,
      reps: Int? = nil,
      weight: Double? = nil,
      unit: String? = nil
    ) {
      self.mode = mode
      self.workoutTitle = workoutTitle
      self.restEndTime = restEndTime
      self.restExerciseName = restExerciseName
      self.nextLabel = nextLabel
      self.exerciseKey = exerciseKey
      self.setExerciseName = setExerciseName
      self.setNumber = setNumber
      self.totalSets = totalSets
      self.reps = reps
      self.weight = weight
      self.unit = unit
    }
  }

  public init() {}
}
