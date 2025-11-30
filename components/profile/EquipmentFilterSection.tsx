import { useTheme } from "@/contexts/ThemeContext";
import { useSound } from "@/hooks/useSound";
import { useUser } from "@/contexts/UserContext";
import playHapticFeedback from "@/lib/haptic";
import { Equipment } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import Card from "../Card";
import { Text } from "../Themed";

const EQUIPMENT_OPTIONS: { type: Equipment; label: string; icon: string }[] = [
  { type: 'barbell', label: 'Barbell', icon: 'barbell-outline' },
  { type: 'dumbbell', label: 'Dumbbells', icon: 'fitness-outline' },
  { type: 'machine', label: 'Machines', icon: 'cog-outline' },
  { type: 'cable', label: 'Cables', icon: 'git-branch-outline' },
  { type: 'kettlebell', label: 'Kettlebell', icon: 'ellipse-outline' },
  { type: 'bodyweight', label: 'Bodyweight', icon: 'body-outline' },
];

const ALL_EQUIPMENT: Equipment[] = ['barbell', 'dumbbell', 'machine', 'cable', 'kettlebell', 'bodyweight'];

const EquipmentFilterSection = () => {
  const { currentTheme } = useTheme();
  const { userProfile, updateProfile } = useUser();
  const { play: playSound } = useSound('pop');
  const [isExpanded, setIsExpanded] = useState(false);

  const selectedEquipment = userProfile?.equipmentFilter?.includedEquipment || ALL_EQUIPMENT;

  const toggleExpanded = () => {
    playHapticFeedback('selection', false);
    setIsExpanded(!isExpanded);
  };

  const toggleEquipment = async (equipment: Equipment) => {
    if (!userProfile) return;

    let newEquipment: Equipment[];

    if (selectedEquipment.includes(equipment)) {
      // Don't allow deselecting all - keep at least one
      if (selectedEquipment.length > 1) {
        newEquipment = selectedEquipment.filter(e => e !== equipment);
      } else {
        return;
      }
    } else {
      newEquipment = [...selectedEquipment, equipment];
    }

    try {
      playHapticFeedback('selection', false);
      playSound();

      await updateProfile({
        ...userProfile,
        age: userProfile.age || 28,
        equipmentFilter: {
          mode: newEquipment.length === ALL_EQUIPMENT.length ? 'all' : 'custom',
          includedEquipment: newEquipment,
        },
      });
    } catch (error) {
      console.error('Error updating equipment filter:', error);
    }
  };

  const selectAll = async () => {
    if (!userProfile) return;

    try {
      playHapticFeedback('selection', false);
      playSound();

      await updateProfile({
        ...userProfile,
        age: userProfile.age || 28,
        equipmentFilter: {
          mode: 'all',
          includedEquipment: ALL_EQUIPMENT,
        },
      });
    } catch (error) {
      console.error('Error updating equipment filter:', error);
    }
  };

  const getEquipmentSummary = () => {
    if (selectedEquipment.length === ALL_EQUIPMENT.length) {
      return 'All Equipment';
    }
    if (selectedEquipment.length === 1 && selectedEquipment[0] === 'bodyweight') {
      return 'Bodyweight Only';
    }
    return `${selectedEquipment.length} types selected`;
  };

  const allSelected = selectedEquipment.length === ALL_EQUIPMENT.length;

  return (
    <Card style={styles.card} variant="clean">
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={toggleExpanded}
        activeOpacity={0.7}
      >
        <View style={[styles.sectionHeaderContent, { backgroundColor: 'transparent' }]}>
          <Text style={[
            styles.sectionTitle,
            {
              color: currentTheme.colors.text,
              fontFamily: currentTheme.properties.headingFontFamily || 'Raleway_600SemiBold',
            }
          ]}>
            Available Equipment
          </Text>
          {!isExpanded && (
            <Text style={[
              styles.subtitle,
              {
                color: currentTheme.colors.primary,
                fontFamily: 'Raleway_500Medium',
              }
            ]}>
              {getEquipmentSummary()}
            </Text>
          )}
          {isExpanded && (
            <Text style={[
              styles.description,
              {
                color: currentTheme.colors.text + '70',
                fontFamily: 'Raleway_400Regular',
              }
            ]}>
              Select the equipment you have access to for AI workout generation
            </Text>
          )}
        </View>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={currentTheme.colors.text}
        />
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.expandedContent}>
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
                fontFamily: 'Raleway_500Medium',
              }
            ]}>
              Select All Equipment
            </Text>
          </TouchableOpacity>

          {/* Equipment grid */}
          <View style={styles.equipmentGrid}>
            {EQUIPMENT_OPTIONS.map((equipment) => {
              const isSelected = selectedEquipment.includes(equipment.type);
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
                    name={equipment.icon as any}
                    size={22}
                    color={isSelected ? '#FFFFFF' : currentTheme.colors.text}
                  />
                  <Text style={[
                    styles.equipmentLabel,
                    {
                      color: isSelected ? '#FFFFFF' : currentTheme.colors.text,
                      fontFamily: 'Raleway_500Medium',
                    }
                  ]}>
                    {equipment.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[
            styles.hint,
            { color: currentTheme.colors.secondary, fontFamily: 'Raleway_400Regular' }
          ]}>
            AI will only suggest exercises using your selected equipment
          </Text>
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    gap: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  sectionHeaderContent: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.8,
    marginTop: 4,
  },
  description: {
    fontSize: 14,
    marginTop: 4,
  },
  expandedContent: {
    paddingTop: 8,
    gap: 12,
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  selectAllText: {
    fontSize: 14,
  },
  equipmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  equipmentButton: {
    width: '31%',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  equipmentLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  hint: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
});

export default EquipmentFilterSection;
