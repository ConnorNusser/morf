import { Text, View, useInk } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { radius, screenGutter, space } from '@/lib/ui/tokens';
import { EQUIPMENT_OPTIONS } from '@/lib/workout/customExercises';
import { Equipment } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { ScrollView, StyleSheet, TextInput, TouchableOpacity } from 'react-native';

interface ExerciseSearchFiltersProps {
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  equipmentFilter: Equipment | 'all';
  setEquipmentFilter: (v: Equipment | 'all') => void;
}

// Search bar + horizontal equipment filter chips for the custom-exercise manager.
export default function ExerciseSearchFilters({
  searchQuery, setSearchQuery, equipmentFilter, setEquipmentFilter,
}: ExerciseSearchFiltersProps) {
  const { currentTheme } = useTheme();
  const ink = useInk();

  return (
    <>
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}>
          <Ionicons name="search" size={18} color={ink.muted} />
          <TextInput
            style={[styles.searchInput, { color: currentTheme.colors.text, fontWeight: '400' }]}
            placeholder="Search exercises..."
            placeholderTextColor={ink.faint}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={ink.muted} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        <TouchableOpacity
          style={[
            styles.filterChip,
            {
              backgroundColor: equipmentFilter === 'all'
                ? currentTheme.colors.primary
                : currentTheme.colors.surface,
              borderColor: equipmentFilter === 'all'
                ? currentTheme.colors.primary
                : currentTheme.colors.border,
            }
          ]}
          onPress={() => setEquipmentFilter('all')}
        >
          <Text
            variant="meta"
            style={[
              styles.filterChipText,
              {
                color: equipmentFilter === 'all' ? '#FFFFFF' : currentTheme.colors.text,
              }
            ]}
          >
            All
          </Text>
        </TouchableOpacity>
        {EQUIPMENT_OPTIONS.map((eq) => (
          <TouchableOpacity
            key={eq.value}
            style={[
              styles.filterChip,
              {
                backgroundColor: equipmentFilter === eq.value
                  ? currentTheme.colors.primary
                  : currentTheme.colors.surface,
                borderColor: equipmentFilter === eq.value
                  ? currentTheme.colors.primary
                  : currentTheme.colors.border,
              }
            ]}
            onPress={() => setEquipmentFilter(eq.value)}
          >
            <Text
              variant="meta"
              style={[
                styles.filterChipText,
                {
                  color: equipmentFilter === eq.value ? '#FFFFFF' : currentTheme.colors.text,
                }
              ]}
            >
              {eq.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  searchContainer: {
    paddingHorizontal: screenGutter,
    paddingBottom: space.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    borderRadius: radius.control,
    borderWidth: 1,
    gap: space.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  filterContainer: {
    flexGrow: 0,
    flexShrink: 0,
    marginBottom: space.md,
  },
  filterContent: {
    paddingHorizontal: screenGutter,
    gap: space.sm,
    alignItems: 'center',
  },
  filterChip: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.control,
    borderWidth: 1,
  },
  filterChipText: {
    lineHeight: 18,
  },
});
