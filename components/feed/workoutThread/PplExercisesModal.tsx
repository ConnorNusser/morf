import IconButton from '@/components/IconButton';
import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { PPL_COLORS, PPL_LABELS, PPLCategory } from '@/lib/data/pplCategories';
import { PPLExerciseEntry } from '@/lib/data/pplExerciseGroups';
import React from 'react';
import { Modal, ScrollView, StyleSheet } from 'react-native';

interface PplExercisesModalProps {
  visible: boolean;
  onClose: () => void;
  selectedPplCategory: PPLCategory | null;
  pplExercises: Record<PPLCategory, PPLExerciseEntry[]>;
}

export default function PplExercisesModal({
  visible,
  onClose,
  selectedPplCategory,
  pplExercises,
}: PplExercisesModalProps) {
  const { currentTheme } = useTheme();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.pplModalContainer, { backgroundColor: currentTheme.colors.background }]}>
        <View style={[styles.pplModalHeader, { borderBottomColor: currentTheme.colors.border }]}>
          <View style={styles.pplModalCloseButton} />
          <View style={styles.pplModalTitleContainer}>
            {selectedPplCategory && (
              <View style={[styles.pplModalTitleChip, { backgroundColor: PPL_COLORS[selectedPplCategory] + '20' }]}>
                <View style={[styles.pplDot, { backgroundColor: PPL_COLORS[selectedPplCategory] }]} />
                <Text variant="emphasis" tone="primary" weight="semiBold">
                  {PPL_LABELS[selectedPplCategory]}
                </Text>
              </View>
            )}
          </View>
          <IconButton icon="close" onPress={onClose} />
        </View>

        <ScrollView style={styles.pplModalContent} contentContainerStyle={styles.pplModalContentContainer}>
          {selectedPplCategory && (
            <>
              <Text style={[styles.pplModalExerciseCount, { color: currentTheme.colors.text + '99', fontWeight: '400' }]}>
                {pplExercises[selectedPplCategory].length} exercise{pplExercises[selectedPplCategory].length !== 1 ? 's' : ''}
              </Text>

              <View style={styles.pplModalExerciseList}>
                {pplExercises[selectedPplCategory].map((exercise, index) => (
                  <View
                    key={index}
                    style={[styles.pplModalExerciseRow, { borderBottomColor: currentTheme.colors.border }]}
                  >
                    <Text style={[styles.pplModalExerciseName, { color: currentTheme.colors.text, fontWeight: '500' }]}>
                      {exercise.name}
                    </Text>
                    <View style={[styles.pplModalSetsBadge, { backgroundColor: selectedPplCategory ? PPL_COLORS[selectedPplCategory] + '15' : currentTheme.colors.primary + '15' }]}>
                      <Text style={[styles.pplModalSetsText, { color: selectedPplCategory ? PPL_COLORS[selectedPplCategory] : currentTheme.colors.primary, fontWeight: '600' }]}>
                        {exercise.sets} sets
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  pplDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pplModalContainer: {
    flex: 1,
  },
  pplModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pplModalCloseButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pplModalTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  pplModalTitleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  pplModalContent: {
    flex: 1,
  },
  pplModalContentContainer: {
    padding: 16,
  },
  pplModalExerciseCount: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  pplModalExerciseList: {
    gap: 0,
  },
  pplModalExerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pplModalExerciseName: {
    fontSize: 15,
    lineHeight: 20,
    flex: 1,
  },
  pplModalSetsBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 12,
  },
  pplModalSetsText: {
    fontSize: 13,
  },
});
