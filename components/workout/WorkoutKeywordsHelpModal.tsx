import IconButton from '@/components/IconButton';
import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
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
        <View style={[styles.header, { backgroundColor: 'transparent', borderBottomColor: currentTheme.colors.border }]}>
          <View style={styles.headerSpacer} />
          <Text style={[styles.headerTitle, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
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
          <View style={[styles.importantNote, { backgroundColor: currentTheme.colors.primary + '15', borderColor: currentTheme.colors.primary }]}>
            <Ionicons name="information-circle" size={20} color={currentTheme.colors.primary} />
            <Text style={[styles.importantNoteText, { color: currentTheme.colors.text, fontFamily: 'Raleway_500Medium' }]}>
              {"If an exercise isn't recognized, it will automatically be saved as a custom exercise with AI-generated metadata."}
            </Text>
          </View>

          {/* Special Keywords Section - Most Important */}
          <View style={[styles.section, { backgroundColor: 'transparent' }]}>
            <Text style={[styles.sectionTitle, { color: currentTheme.colors.primary, fontFamily: 'Raleway_700Bold' }]}>
              Special Keywords
            </Text>
            <Text style={[styles.sectionDescription, { color: currentTheme.colors.secondary, fontFamily: 'Raleway_400Regular' }]}>
              Use these keywords on a new line after an exercise to track different types of sets:
            </Text>

            <View style={[styles.specialKeyword, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}>
              <View style={[styles.keywordHeader, { backgroundColor: 'transparent' }]}>
                <Text style={[styles.keywordName, { color: currentTheme.colors.primary, fontFamily: 'Raleway_600SemiBold' }]}>Actual</Text>
                <Text style={[styles.keywordBadge, { color: '#fff', backgroundColor: currentTheme.colors.accent }]}>Recommended</Text>
              </View>
              <Text style={[styles.keywordDesc, { color: currentTheme.colors.text, fontFamily: 'Raleway_400Regular' }]}>
                Marks sets as actually completed. Use this after your template sets to log what you actually did.
              </Text>
              <View style={[styles.keywordExample, { backgroundColor: currentTheme.colors.background }]}>
                <Text style={[styles.exampleText, { color: currentTheme.colors.text, fontFamily: 'Raleway_400Regular' }]}>
                  Bench Press 135x10, 145x8{'\n'}
                  <Text style={{ color: currentTheme.colors.primary }}>Actual</Text> 135x10, 145x8, 155x6
                </Text>
              </View>
            </View>

            <View style={[styles.specialKeyword, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}>
              <View style={[styles.keywordHeader, { backgroundColor: 'transparent' }]}>
                <Text style={[styles.keywordName, { color: currentTheme.colors.primary, fontFamily: 'Raleway_600SemiBold' }]}>Target</Text>
              </View>
              <Text style={[styles.keywordDesc, { color: currentTheme.colors.text, fontFamily: 'Raleway_400Regular' }]}>
                {"Marks sets as target/template sets (what you're aiming for). These won't count as completed."}
              </Text>
              <View style={[styles.keywordExample, { backgroundColor: currentTheme.colors.background }]}>
                <Text style={[styles.exampleText, { color: currentTheme.colors.text, fontFamily: 'Raleway_400Regular' }]}>
                  <Text style={{ color: currentTheme.colors.primary }}>Target</Text> Squat 185x8, 205x6, 225x4
                </Text>
              </View>
            </View>

            <View style={[styles.specialKeyword, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}>
              <View style={[styles.keywordHeader, { backgroundColor: 'transparent' }]}>
                <Text style={[styles.keywordName, { color: currentTheme.colors.primary, fontFamily: 'Raleway_600SemiBold' }]}>Custom</Text>
              </View>
              <Text style={[styles.keywordDesc, { color: currentTheme.colors.text, fontFamily: 'Raleway_400Regular' }]}>
                Forces an exercise to be saved as a custom exercise, even if a similar name exists.
              </Text>
              <View style={[styles.keywordExample, { backgroundColor: currentTheme.colors.background }]}>
                <Text style={[styles.exampleText, { color: currentTheme.colors.text, fontFamily: 'Raleway_400Regular' }]}>
                  <Text style={{ color: currentTheme.colors.primary }}>Custom</Text> My Special Press 95x12
                </Text>
              </View>
            </View>
          </View>

          {/* Equipment Keywords */}
          <View style={[styles.section, { backgroundColor: 'transparent' }]}>
            <Text style={[styles.sectionTitle, { color: currentTheme.colors.primary, fontFamily: 'Raleway_600SemiBold' }]}>
              Equipment Keywords
            </Text>
            <View style={[styles.keywordGroup, { backgroundColor: 'transparent' }]}>
              <View style={[styles.keywordRow, { backgroundColor: 'transparent' }]}>
                <Text style={[styles.keyword, { color: currentTheme.colors.text, backgroundColor: currentTheme.colors.surface }]}>barbell</Text>
                <Text style={[styles.keyword, { color: currentTheme.colors.text, backgroundColor: currentTheme.colors.surface }]}>bb</Text>
                <Text style={[styles.keyword, { color: currentTheme.colors.text, backgroundColor: currentTheme.colors.surface }]}>bar</Text>
              </View>
              <View style={[styles.keywordRow, { backgroundColor: 'transparent' }]}>
                <Text style={[styles.keyword, { color: currentTheme.colors.text, backgroundColor: currentTheme.colors.surface }]}>dumbbell</Text>
                <Text style={[styles.keyword, { color: currentTheme.colors.text, backgroundColor: currentTheme.colors.surface }]}>db</Text>
                <Text style={[styles.keyword, { color: currentTheme.colors.text, backgroundColor: currentTheme.colors.surface }]}>dumbbells</Text>
              </View>
              <View style={[styles.keywordRow, { backgroundColor: 'transparent' }]}>
                <Text style={[styles.keyword, { color: currentTheme.colors.text, backgroundColor: currentTheme.colors.surface }]}>cable</Text>
                <Text style={[styles.keyword, { color: currentTheme.colors.text, backgroundColor: currentTheme.colors.surface }]}>cables</Text>
              </View>
              <View style={[styles.keywordRow, { backgroundColor: 'transparent' }]}>
                <Text style={[styles.keyword, { color: currentTheme.colors.text, backgroundColor: currentTheme.colors.surface }]}>machine</Text>
                <Text style={[styles.keyword, { color: currentTheme.colors.text, backgroundColor: currentTheme.colors.surface }]}>smith</Text>
              </View>
              <View style={[styles.keywordRow, { backgroundColor: 'transparent' }]}>
                <Text style={[styles.keyword, { color: currentTheme.colors.text, backgroundColor: currentTheme.colors.surface }]}>kettlebell</Text>
                <Text style={[styles.keyword, { color: currentTheme.colors.text, backgroundColor: currentTheme.colors.surface }]}>kb</Text>
              </View>
              <View style={[styles.keywordRow, { backgroundColor: 'transparent' }]}>
                <Text style={[styles.keyword, { color: currentTheme.colors.text, backgroundColor: currentTheme.colors.surface }]}>bodyweight</Text>
                <Text style={[styles.keyword, { color: currentTheme.colors.text, backgroundColor: currentTheme.colors.surface }]}>bw</Text>
              </View>
            </View>
          </View>

          {/* Variation Keywords */}
          <View style={[styles.section, { backgroundColor: 'transparent' }]}>
            <Text style={[styles.sectionTitle, { color: currentTheme.colors.primary, fontFamily: 'Raleway_600SemiBold' }]}>
              Variation Keywords
            </Text>
            <View style={[styles.keywordGroup, { backgroundColor: 'transparent' }]}>
              <View style={[styles.keywordRow, { backgroundColor: 'transparent' }]}>
                <Text style={[styles.keyword, { color: currentTheme.colors.text, backgroundColor: currentTheme.colors.surface }]}>single arm</Text>
                <Text style={[styles.keyword, { color: currentTheme.colors.text, backgroundColor: currentTheme.colors.surface }]}>one arm</Text>
              </View>
              <View style={[styles.keywordRow, { backgroundColor: 'transparent' }]}>
                <Text style={[styles.keyword, { color: currentTheme.colors.text, backgroundColor: currentTheme.colors.surface }]}>incline</Text>
                <Text style={[styles.keyword, { color: currentTheme.colors.text, backgroundColor: currentTheme.colors.surface }]}>decline</Text>
                <Text style={[styles.keyword, { color: currentTheme.colors.text, backgroundColor: currentTheme.colors.surface }]}>flat</Text>
              </View>
              <View style={[styles.keywordRow, { backgroundColor: 'transparent' }]}>
                <Text style={[styles.keyword, { color: currentTheme.colors.text, backgroundColor: currentTheme.colors.surface }]}>close grip</Text>
                <Text style={[styles.keyword, { color: currentTheme.colors.text, backgroundColor: currentTheme.colors.surface }]}>wide grip</Text>
              </View>
            </View>
          </View>

          {/* Format Examples */}
          <View style={[styles.section, { backgroundColor: 'transparent' }]}>
            <Text style={[styles.sectionTitle, { color: currentTheme.colors.primary, fontFamily: 'Raleway_600SemiBold' }]}>
              Format Examples
            </Text>
            <View style={[styles.examples, { backgroundColor: currentTheme.colors.surface, borderRadius: 12, padding: 16 }]}>
              <Text style={[styles.example, { color: currentTheme.colors.text }]}>
                Bench 135x8, 155x6, 165x4
              </Text>
              <Text style={[styles.example, { color: currentTheme.colors.text }]}>
                DB bench 40x12, 45x10
              </Text>
              <Text style={[styles.example, { color: currentTheme.colors.text }]}>
                Machine chest press 100x10
              </Text>
              <Text style={[styles.example, { color: currentTheme.colors.text }]}>
                Cable fly 30x15, 35x12
              </Text>
              <Text style={[styles.example, { color: currentTheme.colors.text }]}>
                Tricep pushdowns 50x12
              </Text>
              <Text style={[styles.example, { color: currentTheme.colors.text }]}>
                Single arm db row 35x10
              </Text>
            </View>
          </View>

          {/* Common Abbreviations */}
          <View style={[styles.section, { backgroundColor: 'transparent' }]}>
            <Text style={[styles.sectionTitle, { color: currentTheme.colors.primary, fontFamily: 'Raleway_600SemiBold' }]}>
              Common Abbreviations
            </Text>
            <View style={[styles.abbreviations, { backgroundColor: currentTheme.colors.surface, borderRadius: 12, padding: 16 }]}>
              <Text style={[styles.abbreviation, { color: currentTheme.colors.text }]}>OHP = Overhead Press</Text>
              <Text style={[styles.abbreviation, { color: currentTheme.colors.text }]}>RDL = Romanian Deadlift</Text>
              <Text style={[styles.abbreviation, { color: currentTheme.colors.text }]}>BB = Barbell</Text>
              <Text style={[styles.abbreviation, { color: currentTheme.colors.text }]}>DB = Dumbbell</Text>
              <Text style={[styles.abbreviation, { color: currentTheme.colors.text }]}>KB = Kettlebell</Text>
              <Text style={[styles.abbreviation, { color: currentTheme.colors.text }]}>BW = Bodyweight</Text>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: {
    fontSize: 17,
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },
  importantNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 24,
  },
  importantNoteText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    marginBottom: 12,
  },
  sectionDescription: {
    fontSize: 13,
    marginBottom: 12,
    lineHeight: 18,
  },
  specialKeyword: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  keywordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  keywordName: {
    fontSize: 16,
  },
  keywordBadge: {
    fontSize: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    overflow: 'hidden',
    fontFamily: 'Raleway_600SemiBold',
  },
  keywordDesc: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  keywordExample: {
    borderRadius: 8,
    padding: 12,
  },
  exampleText: {
    fontSize: 13,
    lineHeight: 20,
  },
  keywordGroup: {
    gap: 10,
  },
  keywordRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  keyword: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    fontSize: 14,
    fontFamily: 'Raleway_500Medium',
    overflow: 'hidden',
  },
  examples: {
    gap: 8,
  },
  example: {
    fontSize: 14,
    fontFamily: 'Raleway_400Regular',
  },
  abbreviations: {
    gap: 6,
  },
  abbreviation: {
    fontSize: 14,
    fontFamily: 'Raleway_400Regular',
  },
});
