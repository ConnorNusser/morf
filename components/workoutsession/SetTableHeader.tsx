import { Text, View } from '@/components/Themed';
import { Theme } from '@/lib/theme';
import React from 'react';
import { StyleSheet } from 'react-native';

interface SetTableHeaderProps {
  isBodyweight: boolean;
  displayUnit: 'lbs' | 'kg';
  themeColors: Theme['colors'];
}

export default function SetTableHeader({ isBodyweight, displayUnit, themeColors }: SetTableHeaderProps) {
  return (
    <View style={[styles.container, { backgroundColor: 'transparent', borderBottomColor: themeColors.border }]}>
      {/* Set Number - Fixed width to match set number circle */}
      <View style={styles.setNumberColumn}>
        <Text style={[styles.headerText, { 
          color: themeColors.text,
          fontFamily: 'Raleway_500Medium',
          opacity: 0.7,
        }]}>Set</Text>
      </View>
      
      {/* Weight - Fixed width for non-bodyweight, hidden for bodyweight */}
      {!isBodyweight && (
        <View style={styles.weightColumn}>
          <Text style={[styles.headerText, { 
            color: themeColors.text,
            fontFamily: 'Raleway_500Medium',
            opacity: 0.7,
          }]}>{displayUnit}</Text>
        </View>
      )}
      
      {/* Reps - Fixed width */}
      <View style={styles.repsColumn}>
        <Text style={[styles.headerText, { 
          color: themeColors.text,
          fontFamily: 'Raleway_500Medium',
          opacity: 0.7,
        }]}>Reps</Text>
      </View>
      
      {/* Actions - Flex space with right alignment */}
      <View style={styles.actionColumn}>
        <Text style={[styles.headerText, { 
          color: themeColors.text,
          fontFamily: 'Raleway_500Medium',
          opacity: 0.7,
        }]}>Action</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  headerText: {
    fontSize: 14,
    textAlign: 'center',
  },
  setNumberColumn: {
    width: 40, // Match set number + margin
    alignItems: 'center',
  },
  weightColumn: {
    width: 80, // Increased spacing
    alignItems: 'center',
    marginHorizontal: 4,
  },
  repsColumn: {
    width: 80, // Increased spacing
    alignItems: 'center',
    marginHorizontal: 4,
  },
  actionColumn: {
    flex: 1, // Take remaining space for actions
    alignItems: 'flex-end', // Align to right
    paddingRight: 40, // Much more padding to move actions farther right
  },
}); 