import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 32,
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  programChip: {
    // Equal-width so Pause/Archive/Rename/Delete always share one row.
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  programChipText: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  programHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  programTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  // Plain status label, right-aligned on the program name row (green = active).
  statusText: {
    fontSize: 12,
    letterSpacing: 0.2,
  },
  // Cycle progress — one segment per program day, with a small count to the
  // right of the bar (no verbose caption; the timeline carries 'up next').
  cycleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
  },
  cycleBar: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  cycleSegment: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },
  cycleCount: {
    fontSize: 11.5,
  },
  programName: {
    fontSize: 17,
    flexShrink: 1,
  },
  programMeta: {
    fontSize: 13,
    marginTop: 5,
  },
  programActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    marginBottom: 4,
  },
  programDivider: {
    height: 1,
    marginTop: 14,
  },
  upNextInline: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  upNextInlineText: {
    fontSize: 10,
    letterSpacing: 0.5,
  },
  // Reorder mode (compact day rows with up/down controls)
  reorderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 8,
  },
  reorderName: {
    flex: 1,
    fontSize: 15,
    marginRight: 12,
  },
  reorderControls: {
    flexDirection: 'row',
    gap: 14,
  },
  reorderBtn: {
    padding: 2,
  },
  reorderBtnDisabled: {
    opacity: 0.25,
  },
  // "Add day" affordance below a program's day list
  addDayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 4,
  },
  addDayText: {
    fontSize: 14,
  },
  // Program timeline (days threaded onto a left spine)
  timeline: {
    marginTop: 2,
  },
  timelineRow: {
    flexDirection: 'row',
  },
  spine: {
    width: 26,
  },
  spineDot: {
    position: 'absolute',
    top: 18,
    left: 6,
    width: 13,
    height: 13,
    borderRadius: 7,
    borderWidth: 2,
  },
  // Completed-day marker — sized/positioned to sit centered on the spine where
  // the plain dot would be (dot is 13px at top:18/left:6; this 17px icon centers
  // on the same point).
  spineCheck: {
    position: 'absolute',
    top: 16,
    left: 4,
  },
  spineLineTop: {
    position: 'absolute',
    top: 0,
    height: 24,
    left: 11,
    width: 2,
  },
  spineLineBottom: {
    position: 'absolute',
    top: 24,
    bottom: 0,
    left: 11,
    width: 2,
  },
  renameOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  renameCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 18,
    padding: 20,
  },
  renameTitle: {
    fontSize: 17,
    marginBottom: 14,
  },
  renameInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  renameButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    marginTop: 18,
  },
  renameCancel: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  renameCancelText: {
    fontSize: 15,
  },
  renameSave: {
    paddingHorizontal: 22,
    paddingVertical: 10,
    borderRadius: 12,
  },
  renameSaveText: {
    fontSize: 15,
    color: '#fff',
  },

  // Generating banner
  // Scroll content
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 120,
  },

  // Progress Button
  progressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 20,
    gap: 10,
  },
  progressButtonText: {
    flex: 1,
    fontSize: 14,
  },

  // Sections
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 12,
  },

  // Routine card
  routineCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardInfo: {
    flex: 1,
    marginRight: 12,
  },
  // Program-level lift-momentum row above the day list: a segment per distinct
  // exercise + a count, mirroring the cycle bar's layout.
  programMomentum: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    marginBottom: 16,
  },
  momentumBar: {
    flex: 1,
    flexDirection: 'row',
    gap: 3,
  },
  momentumSeg: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },
  momentumLabel: {
    fontSize: 11.5,
  },
  expandHint: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  routineNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  pausedBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routineName: {
    fontSize: 16,
    flexShrink: 1,
  },
  routineSubtitle: {
    fontSize: 13,
    marginTop: 3,
    marginBottom: 4,
  },
  routineDate: {
    fontSize: 12,
    marginTop: 1,
  },
  startButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startButtonText: {
    fontSize: 14,
    color: '#fff',
  },

  // Expanded content
  expandedContent: {
    marginTop: 16,
  },
  exerciseList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 14,
    marginBottom: 2,
  },
  exerciseSets: {
    fontSize: 12,
  },
  // Per-exercise adherence verdict (improving / on track / easing back),
  // judged against the program's prescription, under the sets line.
  adherenceText: {
    fontSize: 11.5,
    marginTop: 3,
  },
  weightInfo: {
    alignItems: 'flex-end',
  },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  weightValue: {
    fontSize: 14,
  },
  noDataText: {
    fontSize: 13,
  },
  deloadWarning: {
    fontSize: 10,
  },
  deloadButton: {
    marginTop: 4,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
    backgroundColor: '#FF3B3015',
  },
  deloadBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  deloadBannerText: {
    fontSize: 12,
    flex: 1,
  },
  deloadBannerButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  deloadBannerButtonText: {
    fontSize: 11,
    color: '#FFFFFF',
  },

  // Action row
  actionRow: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 12,
    paddingTop: 12,
  },
  actionItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  actionText: {
    fontSize: 13,
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 24,
  },
  emptyButtonText: {
    fontSize: 15,
    color: '#fff',
  },
});
