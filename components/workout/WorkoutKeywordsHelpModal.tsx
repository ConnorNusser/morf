import IconButton from '@/components/IconButton';
import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { radius, screenGutter, space, tint } from '@/lib/ui/tokens';
import { lineHeightFor, type } from '@/lib/ui/typography';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
} from 'react-native';

interface WorkoutKeywordsHelpModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function WorkoutKeywordsHelpModal({ visible, onClose }: WorkoutKeywordsHelpModalProps) {
  const { currentTheme } = useTheme();

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: currentTheme.colors.border }]}>
          <View style={styles.headerSpacer} />
          <Text variant="title" weight="semiBold" tone="primary">
            Workout Note Guide
          </Text>
          <IconButton icon="close" onPress={onClose} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Important Note */}
          <View style={[styles.importantNote, { backgroundColor: tint(currentTheme.colors.primary), borderColor: currentTheme.colors.primary }]}>
            <Ionicons name="information-circle" size={20} color={currentTheme.colors.primary} />
            <Text variant="meta" weight="medium" tone="primary" style={styles.importantNoteText}>
              {"If an exercise isn't recognized, it will automatically be saved as a custom exercise with AI-generated metadata."}
            </Text>
          </View>

          {/* Special Keywords Section - Most Important */}
          <View style={styles.section}>
            <Text variant="body" weight="semiBold" style={styles.sectionTitle}>
              Special Keywords
            </Text>
            <Text variant="meta" style={[styles.sectionDescription, { color: currentTheme.colors.secondary }]}>
              Use these keywords on a new line after an exercise to track different types of sets:
            </Text>

            <View style={[styles.specialKeyword, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}>
              <View style={styles.keywordHeader}>
                <Text variant="body" weight="semiBold">Actual</Text>
                <Text variant="meta" weight="medium" style={[styles.keywordBadge, { backgroundColor: currentTheme.colors.accent }]}>Recommended</Text>
              </View>
              <Text variant="meta" tone="primary" style={styles.keywordDesc}>
                Marks sets as actually completed. Use this after your template sets to log what you actually did.
              </Text>
              <View style={[styles.keywordExample, { backgroundColor: currentTheme.colors.background }]}>
                <Text variant="meta" tone="primary" style={styles.exampleText}>
                  Bench Press 135x10, 145x8{'\n'}
                  <Text>Actual</Text> 135x10, 145x8, 155x6
                </Text>
              </View>
            </View>

            <View style={[styles.specialKeyword, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}>
              <View style={styles.keywordHeader}>
                <Text variant="body" weight="semiBold">Target</Text>
              </View>
              <Text variant="meta" tone="primary" style={styles.keywordDesc}>
                {"Marks sets as target/template sets (what you're aiming for). These won't count as completed."}
              </Text>
              <View style={[styles.keywordExample, { backgroundColor: currentTheme.colors.background }]}>
                <Text variant="meta" tone="primary" style={styles.exampleText}>
                  <Text>Target</Text> Squat 185x8, 205x6, 225x4
                </Text>
              </View>
            </View>

            <View style={[styles.specialKeyword, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}>
              <View style={styles.keywordHeader}>
                <Text variant="body" weight="semiBold">Custom</Text>
              </View>
              <Text variant="meta" tone="primary" style={styles.keywordDesc}>
                Forces an exercise to be saved as a custom exercise, even if a similar name exists.
              </Text>
              <View style={[styles.keywordExample, { backgroundColor: currentTheme.colors.background }]}>
                <Text variant="meta" tone="primary" style={styles.exampleText}>
                  <Text>Custom</Text> My Special Press 95x12
                </Text>
              </View>
            </View>
          </View>

          {/* Equipment Keywords */}
          <View style={styles.section}>
            <Text variant="body" weight="semiBold" style={styles.sectionTitle}>
              Equipment Keywords
            </Text>
            <View style={styles.keywordGroup}>
              <View style={styles.keywordRow}>
                <Text variant="meta" tone="primary" style={[styles.keyword, { backgroundColor: currentTheme.colors.surface }]}>barbell</Text>
                <Text variant="meta" tone="primary" style={[styles.keyword, { backgroundColor: currentTheme.colors.surface }]}>bb</Text>
                <Text variant="meta" tone="primary" style={[styles.keyword, { backgroundColor: currentTheme.colors.surface }]}>bar</Text>
              </View>
              <View style={styles.keywordRow}>
                <Text variant="meta" tone="primary" style={[styles.keyword, { backgroundColor: currentTheme.colors.surface }]}>dumbbell</Text>
                <Text variant="meta" tone="primary" style={[styles.keyword, { backgroundColor: currentTheme.colors.surface }]}>db</Text>
                <Text variant="meta" tone="primary" style={[styles.keyword, { backgroundColor: currentTheme.colors.surface }]}>dumbbells</Text>
              </View>
              <View style={styles.keywordRow}>
                <Text variant="meta" tone="primary" style={[styles.keyword, { backgroundColor: currentTheme.colors.surface }]}>cable</Text>
                <Text variant="meta" tone="primary" style={[styles.keyword, { backgroundColor: currentTheme.colors.surface }]}>cables</Text>
              </View>
              <View style={styles.keywordRow}>
                <Text variant="meta" tone="primary" style={[styles.keyword, { backgroundColor: currentTheme.colors.surface }]}>machine</Text>
                <Text variant="meta" tone="primary" style={[styles.keyword, { backgroundColor: currentTheme.colors.surface }]}>smith</Text>
              </View>
              <View style={styles.keywordRow}>
                <Text variant="meta" tone="primary" style={[styles.keyword, { backgroundColor: currentTheme.colors.surface }]}>kettlebell</Text>
                <Text variant="meta" tone="primary" style={[styles.keyword, { backgroundColor: currentTheme.colors.surface }]}>kb</Text>
              </View>
              <View style={styles.keywordRow}>
                <Text variant="meta" tone="primary" style={[styles.keyword, { backgroundColor: currentTheme.colors.surface }]}>bodyweight</Text>
                <Text variant="meta" tone="primary" style={[styles.keyword, { backgroundColor: currentTheme.colors.surface }]}>bw</Text>
              </View>
            </View>
          </View>

          {/* Variation Keywords */}
          <View style={styles.section}>
            <Text variant="body" weight="semiBold" style={styles.sectionTitle}>
              Variation Keywords
            </Text>
            <View style={styles.keywordGroup}>
              <View style={styles.keywordRow}>
                <Text variant="meta" tone="primary" style={[styles.keyword, { backgroundColor: currentTheme.colors.surface }]}>single arm</Text>
                <Text variant="meta" tone="primary" style={[styles.keyword, { backgroundColor: currentTheme.colors.surface }]}>one arm</Text>
              </View>
              <View style={styles.keywordRow}>
                <Text variant="meta" tone="primary" style={[styles.keyword, { backgroundColor: currentTheme.colors.surface }]}>incline</Text>
                <Text variant="meta" tone="primary" style={[styles.keyword, { backgroundColor: currentTheme.colors.surface }]}>decline</Text>
                <Text variant="meta" tone="primary" style={[styles.keyword, { backgroundColor: currentTheme.colors.surface }]}>flat</Text>
              </View>
              <View style={styles.keywordRow}>
                <Text variant="meta" tone="primary" style={[styles.keyword, { backgroundColor: currentTheme.colors.surface }]}>close grip</Text>
                <Text variant="meta" tone="primary" style={[styles.keyword, { backgroundColor: currentTheme.colors.surface }]}>wide grip</Text>
              </View>
            </View>
          </View>

          {/* Format Examples */}
          <View style={styles.section}>
            <Text variant="body" weight="semiBold" style={styles.sectionTitle}>
              Format Examples
            </Text>
            <View style={[styles.examples, { backgroundColor: currentTheme.colors.surface }]}>
              <Text variant="meta" tone="primary">
                Bench 135x8, 155x6, 165x4
              </Text>
              <Text variant="meta" tone="primary">
                DB bench 40x12, 45x10
              </Text>
              <Text variant="meta" tone="primary">
                Machine chest press 100x10
              </Text>
              <Text variant="meta" tone="primary">
                Cable fly 30x15, 35x12
              </Text>
              <Text variant="meta" tone="primary">
                Tricep pushdowns 50x12
              </Text>
              <Text variant="meta" tone="primary">
                Single arm db row 35x10
              </Text>
            </View>
          </View>

          {/* Common Abbreviations */}
          <View style={styles.section}>
            <Text variant="body" weight="semiBold" style={styles.sectionTitle}>
              Common Abbreviations
            </Text>
            <View style={[styles.abbreviations, { backgroundColor: currentTheme.colors.surface }]}>
              <Text variant="meta" tone="primary">OHP = Overhead Press</Text>
              <Text variant="meta" tone="primary">RDL = Romanian Deadlift</Text>
              <Text variant="meta" tone="primary">BB = Barbell</Text>
              <Text variant="meta" tone="primary">DB = Dumbbell</Text>
              <Text variant="meta" tone="primary">KB = Kettlebell</Text>
              <Text variant="meta" tone="primary">BW = Bodyweight</Text>
            </View>
          </View>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: screenGutter,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  // Balances the 40pt IconButton so the title stays centered.
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: screenGutter,
  },
  importantNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    marginBottom: space.section,
  },
  importantNoteText: {
    flex: 1,
    lineHeight: lineHeightFor(type.meta),
  },
  section: {
    marginBottom: space.section,
  },
  // Accent-colored section titles are this guide's grammar (kept over
  // SectionLabel caps); type role tokenized to body/semiBold.
  sectionTitle: {
    marginBottom: space.md,
  },
  sectionDescription: {
    marginBottom: space.md,
    lineHeight: lineHeightFor(type.meta),
  },
  specialKeyword: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: space.lg,
    marginBottom: space.md,
  },
  keywordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.sm,
  },
  keywordBadge: {
    color: '#fff',
    paddingHorizontal: space.sm,
    paddingVertical: 3,
    borderRadius: radius.badge,
    overflow: 'hidden',
  },
  keywordDesc: {
    lineHeight: lineHeightFor(type.meta),
    marginBottom: space.md,
  },
  keywordExample: {
    borderRadius: radius.control,
    padding: space.md,
  },
  exampleText: {
    lineHeight: lineHeightFor(type.meta),
  },
  keywordGroup: {
    gap: space.sm,
  },
  keywordRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  keyword: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.control,
    overflow: 'hidden',
  },
  examples: {
    gap: space.sm,
    borderRadius: radius.card,
    padding: space.lg,
  },
  abbreviations: {
    gap: space.sm,
    borderRadius: radius.card,
    padding: space.lg,
  },
});
