import Button from '@/components/Button';
import Card from '@/components/Card';
import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import React from 'react';
import { StyleSheet } from 'react-native';

interface RestTimerProps {
  isResting: boolean;
  formattedTime: string;
  onSkip: () => void;
}

export default function RestTimer({ isResting, formattedTime, onSkip }: RestTimerProps) {
  const { currentTheme } = useTheme();

  if (!isResting) {
    return null;
  }

  return (
    <Card style={StyleSheet.flatten([
      styles.restCard,
      { backgroundColor: currentTheme.colors.accent + '20' }
    ])} variant="elevated">
      <View style={[styles.restContent, { backgroundColor: 'transparent' }]}>
        <View style={[styles.restInfo, { backgroundColor: 'transparent' }]}>
          <Text style={[styles.restTitle, { color: currentTheme.colors.accent }]}>
            Rest Time
          </Text>
          <Text style={[styles.restTimer, { color: currentTheme.colors.accent }]}>
            {formattedTime}
          </Text>
        </View>
        <Button
          title="Skip"
          onPress={onSkip}
          variant="secondary"
          size="small"
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  restCard: {
    marginBottom: 16,
    padding: 16,
  },
  restContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  restInfo: {
    flex: 1,
  },
  restTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  restTimer: {
    fontSize: 24,
    fontWeight: 'bold',
  },
}); 