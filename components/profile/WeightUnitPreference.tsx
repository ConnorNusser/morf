import { useTheme } from "@/contexts/ThemeContext";
import { useSound } from "@/hooks/useSound";
import { useUser } from "@/contexts/UserContext";
import playHapticFeedback from "@/lib/utils/haptic";
import { WeightUnit } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import { radius, space } from "@/lib/ui/tokens";
import Card from "../Card";
import { Text } from "../Themed";

const WeightUnitPreferenceSection = () => {
  const { currentTheme } = useTheme();
  const { userProfile, updateProfile } = useUser();
  const { play: playSound } = useSound('pop');
  const [isExpanded, setIsExpanded] = useState(false);

  const weightUnit = userProfile?.weightUnitPreference || 'lbs';

  const handleWeightUnitChange = async (newWeightUnit: WeightUnit) => {
    try {
      playHapticFeedback('selection', false);
      playSound();
      
      if (!userProfile) return;

      await updateProfile({
        ...userProfile,
        age: userProfile.age || 28,
        weightUnitPreference: newWeightUnit,
      });
    } catch (error) {
      console.error('Error updating weight unit preference:', error);
    }
  };

  return (
    <Card style={styles.card}>
      <TouchableOpacity 
        style={styles.sectionHeader}
        onPress={() => setIsExpanded(!isExpanded)}
        activeOpacity={0.7}
      >
        <View style={[styles.sectionHeaderContent, { backgroundColor: 'transparent' }]}>
          <Text variant="title" weight="bold" tone="primary" style={styles.sectionTitle}>
            Weight Units
          </Text>
          {!isExpanded && (
            <Text variant="meta" style={styles.weightUnitMeta}>
              {weightUnit === 'kg' ? 'Metric (kg)' : 'Imperial (lbs)'}
            </Text>
          )}
          {isExpanded && (
            <Text variant="meta" tone="secondary" style={styles.weightUnitMeta}>
              Choose your preferred unit system for weights and exercises
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
        <View style={styles.weightUnitContent}>
          <View style={styles.unitToggle}>
            <TouchableOpacity
              style={[
                styles.unitButton,
                { 
                  backgroundColor: weightUnit === 'lbs' ? currentTheme.colors.primary : currentTheme.colors.surface,
                  borderColor: currentTheme.colors.border,
                },
              ]}
              onPress={() => handleWeightUnitChange('lbs')}
              activeOpacity={0.7}
            >
              <Text variant="body" weight="semiBold" style={[
                styles.unitButtonText,
                {
                  color: weightUnit === 'lbs' ? '#FFFFFF' : currentTheme.colors.text,
                }
              ]}>
                lbs
              </Text>
              <Text variant="meta" weight="regular" style={[
                styles.unitButtonSubtext,
                {
                  color: weightUnit === 'lbs' ? '#FFFFFF' + '90' : currentTheme.colors.text + '70',
                }
              ]}>
                Imperial
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[
                styles.unitButton,
                { 
                  backgroundColor: weightUnit === 'kg' ? currentTheme.colors.primary : currentTheme.colors.surface,
                  borderColor: currentTheme.colors.border,
                },
              ]}
              onPress={() => handleWeightUnitChange('kg')}
              activeOpacity={0.7}
            >
              <Text variant="body" weight="semiBold" style={[
                styles.unitButtonText,
                {
                  color: weightUnit === 'kg' ? '#FFFFFF' : currentTheme.colors.text,
                }
              ]}>
                kg
              </Text>
              <Text variant="meta" weight="regular" style={[
                styles.unitButtonSubtext,
                {
                  color: weightUnit === 'kg' ? '#FFFFFF' + '90' : currentTheme.colors.text + '70',
                }
              ]}>
                Metric
              </Text>
            </TouchableOpacity>
          </View>
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
  sectionTitle: {
  },
  weightUnitMeta: {
    marginTop: space.xs,
  },
  weightUnitContent: {
    paddingTop: space.lg,
  },
  unitToggle: {
    flexDirection: 'row',
    width: '100%',
    gap: space.md,
  },
  unitButton: {
    flex: 1,
    paddingVertical: space.lg,
    paddingHorizontal: space.xl,
    borderRadius: radius.card,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitButtonText: {
    marginBottom: space.xs,
  },
  unitButtonSubtext: {
  },
});

export default WeightUnitPreferenceSection;