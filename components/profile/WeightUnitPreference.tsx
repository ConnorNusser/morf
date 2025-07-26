import { useTheme } from "@/contexts/ThemeContext";
import { useSound } from "@/hooks/useSound";
import { useUser } from "@/hooks/useUser";
import playHapticFeedback from "@/lib/haptic";
import { WeightUnit } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import Card from "../Card";
import { Text } from "../Themed";

const WeightUnitPreferenceSection = () => {
  const { currentTheme } = useTheme();
  const { userProfile, updateProfile } = useUser();
  const { play: playSound } = useSound('pop');
  const [isExpanded, setIsExpanded] = useState(false);

  const weightUnit = userProfile?.weightUnitPreference || 'lbs';

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const handleWeightUnitChange = async (newWeightUnit: WeightUnit) => {
    try {
      playHapticFeedback('selection', false);
      playSound();
      
      if (!userProfile) return;
      
      // Update profile using context which will trigger re-renders across the app
      await updateProfile({
        ...userProfile,
        age: userProfile.age || 28,
        weightUnitPreference: newWeightUnit,
      });
    } catch (error) {
      console.error('Error updating weight unit preference:', error);
    }
  };

  const getWeightUnitSummary = () => {
    return weightUnit === 'kg' ? 'Metric (kg)' : 'Imperial (lbs)';
  };

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
            Weight Units
          </Text>
          {!isExpanded && (
            <Text style={[
              styles.weightUnitSubtitle, 
              { 
                color: currentTheme.colors.primary,
                fontFamily: 'Raleway_500Medium',
              }
            ]}>
              {getWeightUnitSummary()}
            </Text>
          )}
          {isExpanded && (
            <Text style={[
              styles.weightUnitDescription, 
              { 
                color: currentTheme.colors.text,
                fontFamily: 'Raleway_400Regular',
              }
            ]}>
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
              <Text style={[
                styles.unitButtonText,
                { 
                  color: weightUnit === 'lbs' ? '#FFFFFF' : currentTheme.colors.text,
                  fontFamily: 'Raleway_600SemiBold',
                }
              ]}>
                lbs
              </Text>
              <Text style={[
                styles.unitButtonSubtext,
                { 
                  color: weightUnit === 'lbs' ? '#FFFFFF' + '90' : currentTheme.colors.text + '70',
                  fontFamily: 'Raleway_400Regular',
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
              <Text style={[
                styles.unitButtonText,
                { 
                  color: weightUnit === 'kg' ? '#FFFFFF' : currentTheme.colors.text,
                  fontFamily: 'Raleway_600SemiBold',
                }
              ]}>
                kg
              </Text>
              <Text style={[
                styles.unitButtonSubtext,
                { 
                  color: weightUnit === 'kg' ? '#FFFFFF' + '90' : currentTheme.colors.text + '70',
                  fontFamily: 'Raleway_400Regular',
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
  weightUnitSubtitle: {
    fontSize: 14,
    opacity: 0.8,
    marginTop: 4,
  },
  weightUnitDescription: {
    fontSize: 14,
    opacity: 0.8,
    marginTop: 4,
  },
  weightUnitContent: {
    paddingTop: 16,
  },
  unitToggle: {
    flexDirection: 'row',
    width: '100%',
    gap: 12,
  },
  unitButton: {
    flex: 1,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  unitButtonSubtext: {
    fontSize: 12,
    fontWeight: '400',
  },
});

export default WeightUnitPreferenceSection;