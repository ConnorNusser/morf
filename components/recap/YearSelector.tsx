import React from 'react';
import { StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';

interface YearSelectorProps {
  years: number[];
  selectedYear: number;
  onYearChange: (year: number) => void;
}

export default function YearSelector({ years, selectedYear, onYearChange }: YearSelectorProps) {
  const { currentTheme } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: 'transparent' }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {years.map((year) => {
          const isSelected = year === selectedYear;
          return (
            <TouchableOpacity
              key={year}
              style={[
                styles.yearButton,
                {
                  backgroundColor: isSelected ? currentTheme.colors.accent : currentTheme.colors.surface,
                  borderColor: isSelected ? currentTheme.colors.accent : currentTheme.colors.border,
                },
              ]}
              onPress={() => onYearChange(year)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.yearText,
                  {
                    color: isSelected ? '#FFFFFF' : currentTheme.colors.text,
                    fontFamily: isSelected ? 'Raleway_600SemiBold' : 'Raleway_500Medium',
                  },
                ]}
              >
                {year}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  scrollContent: {
    paddingHorizontal: 4,
    gap: 10,
  },
  yearButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  yearText: {
    fontSize: 16,
  },
});
