import Button from '@/components/Button';
import Chip from '@/components/Chip';
import IconButton from '@/components/IconButton';
import { Text, View, useInk } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { aiWorkoutGenerator } from '@/lib/ai/aiWorkoutGenerator';
import { radius, screenGutter, space, withAlpha } from '@/lib/ui/tokens';
import { lineHeightFor, type } from '@/lib/ui/typography';
import { Ionicons } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Modal,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  View as RNView,
  Keyboard,
  InputAccessoryView,
} from 'react-native';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface PlanBuilderModalProps {
  visible: boolean;
  onComplete: (planText: string) => void;
  onCancel: () => void;
  initialRequest?: string;
}

const PlanBuilderModal: React.FC<PlanBuilderModalProps> = ({
  visible,
  onComplete,
  onCancel,
  initialRequest = '',
}) => {
  const { currentTheme } = useTheme();
  const ink = useInk();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState(initialRequest);
  const [currentPlan, setCurrentPlan] = useState('');
  const [isPlanExpanded, setIsPlanExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [contextQuestions, setContextQuestions] = useState<string[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);
  const inputAccessoryViewID = 'planBuilderAccessory';

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setMessages([]);
      setCurrentPlan('');
      setIsPlanExpanded(false);
      setContextQuestions([]);
      setInputText(initialRequest);
    }
  }, [visible, initialRequest]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const handleSendMessage = useCallback(async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed || isLoading) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: trimmed,
    };
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setContextQuestions([]);
    setIsLoading(true);
    Keyboard.dismiss();

    try {
      if (currentPlan) {
        // Refine existing plan
        const chatHistory = messages.map(m => ({ role: m.role, content: m.content }));
        const result = await aiWorkoutGenerator.refinePlan(currentPlan, chatHistory, trimmed);

        // Update plan if changed
        if (result.noteText !== currentPlan) {
          setCurrentPlan(result.noteText);
        }

        // Add assistant response
        const assistantMessage: ChatMessage = {
          id: `assistant_${Date.now()}`,
          role: 'assistant',
          content: result.response,
        };
        setMessages(prev => [...prev, assistantMessage]);

        // Set follow-up questions
        if (result.followUpQuestions && result.followUpQuestions.length > 0) {
          setContextQuestions(result.followUpQuestions);
        }
      } else {
        // Generate new plan
        const result = await aiWorkoutGenerator.generateWorkoutNote({ customRequest: trimmed });
        setCurrentPlan(result.noteText);

        // Add assistant response
        const assistantMessage: ChatMessage = {
          id: `assistant_${Date.now()}`,
          role: 'assistant',
          content: `I've created a ${result.title.toLowerCase()} for you! ${result.contextQuestions && result.contextQuestions.length > 0 ? 'A few questions to refine it:' : 'Check it out below.'}`,
        };
        setMessages(prev => [...prev, assistantMessage]);

        // Set context questions
        if (result.contextQuestions && result.contextQuestions.length > 0) {
          setContextQuestions(result.contextQuestions);
        }
      }
    } catch (error) {
      console.error('Error in plan builder:', error);
      const errorMessage: ChatMessage = {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        content: "Sorry, I couldn't process that. Please try again.",
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [currentPlan, messages, isLoading]);

  const handleQuestionPress = (question: string) => {
    if (!isLoading) {
      handleSendMessage(question);
    }
  };

  const handleUsePlan = () => {
    if (currentPlan) {
      onComplete(currentPlan);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onCancel}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: currentTheme.colors.border }]}>
          <IconButton icon="chevron-back" onPress={onCancel} />
          <Text variant="title" weight="semiBold" tone="primary">
            Plan Builder
          </Text>
          <RNView style={styles.headerRight}>
            {currentPlan ? (
              <Button title="Create" onPress={handleUsePlan} variant="primary" size="small" />
            ) : (
              <RNView style={styles.headerRight} />
            )}
          </RNView>
        </View>

        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          {/* Chat Messages */}
          <ScrollView
            ref={scrollViewRef}
            style={styles.chatContainer}
            contentContainerStyle={styles.chatContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
          {/* Welcome message */}
          {messages.length === 0 && (
            <RNView style={styles.welcomeContainer}>
              <Ionicons name="sparkles" size={48} color={withAlpha(currentTheme.colors.primary, 'faint')} />
              <Text variant="heading" weight="semiBold" tone="primary" style={styles.welcomeTitle}>
                {"Let's Build Your Workout"}
              </Text>
              <Text variant="body" tone="muted" style={styles.welcomeSubtitle}>
                Describe what you want to do today
              </Text>
            </RNView>
          )}

          {/* Messages */}
          {messages.map((message) => (
            <RNView
              key={message.id}
              style={[
                styles.messageBubble,
                message.role === 'user' ? styles.userMessage : styles.assistantMessage,
                {
                  backgroundColor: message.role === 'user'
                    ? currentTheme.colors.primary
                    : currentTheme.colors.surface,
                },
              ]}
            >
              <Text
                variant="body"
                tone="primary"
                style={[styles.messageText, message.role === 'user' && styles.userMessageText]}
              >
                {message.content}
              </Text>
            </RNView>
          ))}

          {/* Context Questions */}
          {contextQuestions.length > 0 && !isLoading && (
            <RNView style={styles.questionsContainer}>
              {contextQuestions.map((question, index) => (
                <Chip
                  key={index}
                  label={question}
                  onPress={() => handleQuestionPress(question)}
                />
              ))}
            </RNView>
          )}

          {/* Plan Preview Card */}
          {currentPlan && (
            <TouchableOpacity
              style={[styles.planCard, { backgroundColor: currentTheme.colors.surface, borderColor: currentTheme.colors.border }]}
              onPress={() => setIsPlanExpanded(!isPlanExpanded)}
              activeOpacity={0.8}
            >
              <RNView style={styles.planHeader}>
                <RNView style={styles.planHeaderLeft}>
                  <Ionicons name="document-text-outline" size={18} color={currentTheme.colors.primary} />
                  <Text variant="body" weight="semiBold" tone="primary">
                    Current Plan
                  </Text>
                </RNView>
                <Ionicons
                  name={isPlanExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={ink.muted}
                />
              </RNView>

              {isPlanExpanded ? (
                <Text variant="meta" tone="primary" style={styles.planText}>
                  {currentPlan}
                </Text>
              ) : (
                <Text
                  variant="meta"
                  tone="muted"
                  style={styles.planText}
                  numberOfLines={2}
                >
                  {currentPlan}
                </Text>
              )}
            </TouchableOpacity>
          )}

          {/* Loading indicator */}
          {isLoading && (
            <RNView style={[styles.messageBubble, styles.assistantMessage, { backgroundColor: currentTheme.colors.surface }]}>
              <RNView style={styles.typingIndicator}>
                <RNView style={[styles.typingDot, { backgroundColor: ink.faint }]} />
                <RNView style={[styles.typingDot, { backgroundColor: ink.faint }]} />
                <RNView style={[styles.typingDot, { backgroundColor: ink.faint }]} />
              </RNView>
            </RNView>
          )}
          </ScrollView>

          {/* Input Area */}
          <View style={[styles.inputContainer, { backgroundColor: currentTheme.colors.background }]}>
            <RNView style={[styles.inputWrapper, { backgroundColor: currentTheme.colors.surface }]}>
              <TextInput
                style={[
                  styles.input,
                  {
                    color: currentTheme.colors.text,
                  },
                ]}
                value={inputText}
                onChangeText={setInputText}
                placeholder={currentPlan ? "Ask to refine your plan..." : "e.g., push day, leg workout..."}
                placeholderTextColor={ink.faint}
                multiline
                maxLength={500}
                editable={!isLoading}
                onSubmitEditing={() => handleSendMessage(inputText)}
                blurOnSubmit={false}
                inputAccessoryViewID={inputAccessoryViewID}
              />
              <IconButton
                icon="arrow-up-circle"
                onPress={() => handleSendMessage(inputText)}
                disabled={!inputText.trim() || isLoading}
                style={{
                  backgroundColor: inputText.trim() && !isLoading
                    ? currentTheme.colors.primary
                    : 'transparent',
                }}
                iconColor={inputText.trim() && !isLoading ? '#fff' : ink.ghost}
              />
            </RNView>
          </View>

          {/* Keyboard accessory with Done button */}
          {Platform.OS === 'ios' && (
            <InputAccessoryView nativeID={inputAccessoryViewID}>
              <RNView style={[styles.accessoryContainer, { backgroundColor: currentTheme.colors.surface, borderTopColor: currentTheme.colors.border }]}>
                <RNView style={{ flex: 1 }} />
                <TouchableOpacity
                  onPress={() => Keyboard.dismiss()}
                  style={styles.doneButton}
                >
                  <Text variant="body" weight="semiBold">
                    Done
                  </Text>
                </TouchableOpacity>
              </RNView>
            </InputAccessoryView>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: screenGutter,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerRight: {
    minWidth: 60,
    height: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  chatContainer: {
    flex: 1,
  },
  chatContent: {
    padding: screenGutter,
    gap: space.lg,
  },
  welcomeContainer: {
    alignItems: 'center',
    // Empty-state rhythm (matches EmptyState).
    paddingVertical: 60,
    gap: space.md,
  },
  welcomeTitle: {
    marginTop: space.sm,
  },
  welcomeSubtitle: {
    textAlign: 'center',
  },
  // Chat-bubble grammar: the 20pt bubble radius is structural to this screen.
  messageBubble: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: 20,
    maxWidth: '80%',
  },
  userMessage: {
    alignSelf: 'flex-end',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
  },
  messageText: {
    lineHeight: lineHeightFor(type.body),
  },
  userMessageText: {
    color: '#fff',
  },
  typingIndicator: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'center',
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  questionsContainer: {
    gap: space.sm,
    marginTop: space.xs,
    alignSelf: 'flex-start',
    maxWidth: '85%',
  },
  planCard: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: space.lg,
    marginTop: space.sm,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.sm,
  },
  planHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
  },
  planText: {
    lineHeight: lineHeightFor(type.meta),
  },
  inputContainer: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  // Composer: the 24pt radius is structural — the multiline input grows past
  // pill geometry.
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: space.sm,
    borderRadius: 24,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  input: {
    flex: 1,
    fontSize: type.body,
    maxHeight: 100,
    paddingVertical: space.sm,
  },
  accessoryContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  doneButton: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
});

export default PlanBuilderModal;
