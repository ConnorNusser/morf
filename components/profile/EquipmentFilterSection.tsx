import { useTheme } from "@/contexts/ThemeContext";
import { useExpandToggle } from '@/hooks/useExpandToggle';
import { useSound } from "@/hooks/useSound";
import { useUser } from "@/contexts/UserContext";
import playHapticFeedback from "@/lib/utils/haptic";
import { Equipment } from "@/types";
import { ALL_EQUIPMENT, EQUIPMENT_DISPLAY_LABELS } from "@/lib/workout/equipment";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import Card from "../Card";
import { Text, useInk } from "../Themed";
import { radius, space, tint } from "@/lib/ui/tokens";

const EQUIPMENT_ICONS: Record<Equipment, string> = {
  barbell: 'barbell-outline',
  dumbbell: 'fitness-outline',
  machine: 'cog-outline',
  'smith-machine': 'apps-outline',
  cable: 'git-branch-outline',
  kettlebell: 'ellipse-outline',
  bodyweight: 'body-outline',
};

const EQUIPMENT_OPTIONS: { type: Equipment; label: string; icon: string }[] =
  ALL_EQUIPMENT.map(type => ({
    type,
    label: EQUIPMENT_DISPLAY_LABELS[type],
    icon: EQUIPMENT_ICONS[type],
  }));

const EquipmentFilterSection = () => {
  const { currentTheme } = useTheme();
  const ink = useInk();
  const { userProfile, updateProfile } = useUser();
  const { play: playSound } = useSound('pop');

  const selectedEquipment = userProfile?.equipmentFilter?.includedEquipment || ALL_EQUIPMENT;

  const [isExpanded, toggleExpanded] = useExpandToggle();

  const toggleEquipment = async (equipment: Equipment) => {
    if (!userProfile) return;

    let newEquipment: Equipment[];

    if (selectedEquipment.includes(equipment)) {
      // Keep at least one equipment selected
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
    <Card style={styles.card}>
      <TouchableOpacity
        style={styles.sectionHeader}
        onPress={toggleExpanded}
        activeOpacity={0.7}
      >
        <View style={styles.sectionHeaderContent}>
          <Text variant="title" weight="bold" tone="primary">
            Available Equipment
          </Text>
          {!isExpanded && (
            <Text variant="meta" style={styles.subtitle}>
              {getEquipmentSummary()}
            </Text>
          )}
          {isExpanded && (
            <Text variant="meta" tone="secondary" style={styles.description}>
              Select the equipment you have access to for AI workout generation
            </Text>
          )}
        </View>
        <Ionicons
          name={isExpanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={ink.primary}
        />
      </TouchableOpacity>

      {isExpanded && (
        <View style={styles.expandedContent}>
          <TouchableOpacity
            style={[
              styles.selectAllButton,
              {
                backgroundColor: allSelected ? tint(currentTheme.colors.primary) : currentTheme.colors.surface,
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
            <Text variant="meta" tone={allSelected ? undefined : 'primary'}>
              Select All Equipment
            </Text>
          </TouchableOpacity>

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
                    name={equipment.icon as React.ComponentProps<typeof Ionicons>["name"]}
                    size={22}
                    color={isSelected ? '#FFFFFF' : ink.primary}
                  />
                  <Text
                    variant="meta"
                    style={[
                      styles.equipmentLabel,
                      { color: isSelected ? '#FFFFFF' : currentTheme.colors.text },
                    ]}
                  >
                    {equipment.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text
            variant="meta"
            weight="regular"
            style={[styles.hint, { color: currentTheme.colors.secondary }]}
          >
            AI will only suggest exercises using your selected equipment
          </Text>
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    gap: space.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: space.xs,
  },
  sectionHeaderContent: {
    flex: 1,
  },
  subtitle: {
    opacity: 0.8,
    marginTop: space.xs,
  },
  description: {
    marginTop: space.xs,
  },
  expandedContent: {
    paddingTop: space.sm,
    gap: space.md,
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.control,
    borderWidth: 1,
  },
  equipmentGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.md,
  },
  equipmentButton: {
    width: '31%',
    paddingVertical: space.md,
    paddingHorizontal: space.sm,
    borderRadius: radius.control,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
  },
  equipmentLabel: {
    textAlign: 'center',
  },
  hint: {
    textAlign: 'center',
    marginTop: space.xs,
  },
});

export default EquipmentFilterSection;
