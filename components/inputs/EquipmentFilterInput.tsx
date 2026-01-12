import { useTheme } from '@/contexts/ThemeContext';
import { Equipment } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';

interface EquipmentFilterInputProps {
  value: Equipment[];
  onChange: (equipment: Equipment[]) => void;
  style?: ViewStyle;
}

const EQUIPMENT_OPTIONS: { type: Equipment; label: string; icon: string }[] = [
  { type: 'barbell', label: 'Barbell', icon: 'barbell-outline' },
  { type: 'dumbbell', label: 'Dumbbells', icon: 'fitness-outline' },
  { type: 'machine', label: 'Machines', icon: 'cog-outline' },
  { type: 'smith-machine', label: 'Smith Machine', icon: 'apps-outline' },
  { type: 'cable', label: 'Cables', icon: 'git-branch-outline' },
  { type: 'kettlebell', label: 'Kettlebell', icon: 'ellipse-outline' },
  { type: 'bodyweight', label: 'Bodyweight', icon: 'body-outline' },
];

export default function EquipmentFilterInput({ value, onChange, style }: EquipmentFilterInputProps) {
  const { currentTheme } = useTheme();

  const toggleEquipment = (equipment: Equipment) => {
    if (value.includes(equipment)) {
      // Don't allow deselecting all - keep at least one
      if (value.length > 1) {
        onChange(value.filter(e => e !== equipment));
      }
    } else {
      onChange([...value, equipment]);
    }
  };

  const selectAll = () => {
    onChange(EQUIPMENT_OPTIONS.map(e => e.type));
  };

  const allSelected = value.length === EQUIPMENT_OPTIONS.length;

  return (
    <View style={[styles.container, style]}>
      {/* Select All button */}
      <TouchableOpacity
        style={[
          styles.selectAllButton,
          {
            backgroundColor: allSelected ? currentTheme.colors.primary + '20' : currentTheme.colors.surface,
            borderColor: allSelected ? currentTheme.colors.primary : currentTheme.colors.border,
          }
        ]}
        onPress={selectAll}
        activeOpacity={0.7}
      >
        <Ionicons
          name={allSelected ? "checkmark-circle" : "checkmark-circle-outline"}
          size={20}
          color={allSelected ? currentTheme.colors.primary : currentTheme.colors.secondary}
        />
        <Text style={[
          styles.selectAllText,
          {
            color: allSelected ? currentTheme.colors.primary : currentTheme.colors.text,
          }
        ]}>
          Select All Equipment
        </Text>
      </TouchableOpacity>

      {/* Equipment grid */}
      <View style={styles.grid}>
        {EQUIPMENT_OPTIONS.map((equipment) => {
          const isSelected = value.includes(equipment.type);
          return (
            <TouchableOpacity
              key={equipment.type}
              style={[
                styles.equipmentButton,
                {
                  backgroundColor: isSelected ? currentTheme.colors.primary : currentTheme.colors.surface,
                  borderColor: isSelected ? currentTheme.colors.primary : currentTheme.colors.border,
                }
              ]}
              onPress={() => toggleEquipment(equipment.type)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={equipment.icon as React.ComponentProps<typeof Ionicons>["name"]}
                size={24}
                color={isSelected ? '#FFFFFF' : currentTheme.colors.text}
              />
              <Text style={[
                styles.equipmentLabel,
                {
                  color: isSelected ? '#FFFFFF' : currentTheme.colors.text,
                }
              ]}>
                {equipment.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[styles.hint, { color: currentTheme.colors.secondary, fontFamily: currentTheme.fonts.regular }]}>
        Select the equipment you have access to
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  selectAllText: {
    fontSize: 15,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
  },
  equipmentButton: {
    width: '45%',
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  equipmentLabel: {
    fontSize: 14,
    textAlign: 'center',
  },
  hint: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 16,
  },
});
