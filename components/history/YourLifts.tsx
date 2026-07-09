import LiftDisplayFilter from "@/components/LiftDisplayFilter";
import { View } from "@/components/Themed";
import SectionLabel from "@/components/ui/SectionLabel";
import WorkoutStatsCard from "@/components/WorkoutStatsCard";
import { storageService } from "@/lib/storage/storage";
import { space } from "@/lib/ui/tokens";
import { LiftDisplayFilters, UserProgress } from "@/types";
import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet } from "react-native";

interface YourLiftsProps {
  lifts: UserProgress[];
}

// Each featured lift as a tier-coloured strength card; the LiftDisplayFilter chip bar hides/shows lifts and persists the choice.
function YourLifts({ lifts }: YourLiftsProps) {
  const [filters, setFilters] = useState<LiftDisplayFilters>({ hiddenLiftIds: [] });

  useEffect(() => {
    storageService
      .getLiftDisplayFilters()
      .then(setFilters)
      .catch(() => {});
  }, []);

  const visibleLifts = useMemo(
    () => lifts.filter((l) => !filters.hiddenLiftIds.includes(l.workoutId)),
    [lifts, filters]
  );

  if (lifts.length === 0) return null;

  return (
    <View>
      <SectionLabel>Your Lifts</SectionLabel>

      <LiftDisplayFilter availableLifts={lifts} onFiltersChanged={setFilters} />

      <View style={styles.list}>
        {visibleLifts.map((lift, i) => (
          <WorkoutStatsCard key={lift.workoutId} stats={lift} delay={i * 90} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    marginTop: space.md,
    gap: space.md,
  },
});

export default React.memo(YourLifts);
