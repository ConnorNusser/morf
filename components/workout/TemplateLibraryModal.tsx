import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { storageService } from '@/lib/storage';
import { WorkoutTemplate } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View as RNView,
} from 'react-native';

interface TemplateLibraryModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectTemplate: (template: WorkoutTemplate) => void;
}

const TemplateLibraryModal: React.FC<TemplateLibraryModalProps> = ({
  visible,
  onClose,
  onSelectTemplate,
}) => {
  const { currentTheme } = useTheme();
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load templates when modal opens
  useEffect(() => {
    if (visible) {
      loadTemplates();
    }
  }, [visible]);

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const loadedTemplates = await storageService.getWorkoutTemplates();
      // Sort by most recently used, then by created date
      const sorted = loadedTemplates.sort((a, b) => {
        if (a.lastUsed && b.lastUsed) {
          return b.lastUsed.getTime() - a.lastUsed.getTime();
        }
        if (a.lastUsed) return -1;
        if (b.lastUsed) return 1;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
      setTemplates(sorted);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteTemplate = useCallback(async (templateId: string, templateName: string) => {
    Alert.alert(
      'Delete Template',
      `Are you sure you want to delete "${templateName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await storageService.deleteWorkoutTemplate(templateId);
            await loadTemplates();
          },
        },
      ]
    );
  }, []);

  const handleSelectTemplate = useCallback(async (template: WorkoutTemplate) => {
    await storageService.updateTemplateLastUsed(template.id);
    onSelectTemplate(template);
  }, [onSelectTemplate]);

  const formatDate = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    return date.toLocaleDateString();
  };

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
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={currentTheme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
            Import Notes
          </Text>
          <RNView style={styles.headerRight} />
        </View>

        {/* Content */}
        <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
          {isLoading ? (
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_400Regular' }]}>
                Loading templates...
              </Text>
            </View>
          ) : templates.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="bookmark-outline" size={64} color={currentTheme.colors.text + '20'} />
              <Text style={[styles.emptyTitle, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
                No Templates Yet
              </Text>
              <Text style={[styles.emptyText, { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_400Regular' }]}>
                Save your workout notes as templates to reuse them later
              </Text>
            </View>
          ) : (
            templates.map((template) => (
              <TouchableOpacity
                key={template.id}
                style={[styles.templateCard, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}
                onPress={() => handleSelectTemplate(template)}
                activeOpacity={0.7}
              >
                <RNView style={styles.templateHeader}>
                  <Ionicons name="document-text" size={20} color={currentTheme.colors.accent} />
                  <Text style={[styles.templateName, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
                    {template.name}
                  </Text>
                </RNView>

                <Text
                  style={[styles.templatePreview, { color: currentTheme.colors.text + '80', fontFamily: 'Raleway_400Regular' }]}
                  numberOfLines={3}
                >
                  {template.noteText}
                </Text>

                <RNView style={styles.templateFooter}>
                  <Text style={[styles.templateDate, { color: currentTheme.colors.text + '50', fontFamily: 'Raleway_400Regular' }]}>
                    Created {formatDate(template.createdAt)}
                  </Text>
                  {template.lastUsed && (
                    <Text style={[styles.templateDate, { color: currentTheme.colors.accent + '80', fontFamily: 'Raleway_500Medium' }]}>
                      Last used {formatDate(template.lastUsed)}
                    </Text>
                  )}
                </RNView>
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
  },
  headerRight: {
    width: 44,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    gap: 12,
  },
  emptyContainer: {
    paddingVertical: 80,
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    marginTop: 16,
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  templateCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  templateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  templateName: {
    fontSize: 16,
    flex: 1,
  },
  templatePreview: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  templateFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  templateDate: {
    fontSize: 12,
  },
});

export default TemplateLibraryModal;
