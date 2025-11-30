import Button from '@/components/Button';
import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import { aiWorkoutGenerator } from '@/lib/aiWorkoutGenerator';
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
} from 'react-native';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState(initialRequest);
  const [currentPlan, setCurrentPlan] = useState('');
  const [isPlanExpanded, setIsPlanExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [contextQuestions, setContextQuestions] = useState<string[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);

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
      timestamp: new Date(),
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
          timestamp: new Date(),
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
          timestamp: new Date(),
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
        timestamp: new Date(),
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
        <View style={[styles.header, { backgroundColor: 'transparent', borderBottomColor: currentTheme.colors.border }]}>
          <TouchableOpacity onPress={onCancel} style={[styles.backButton, { backgroundColor: currentTheme.colors.surface }]}>
            <Ionicons name="chevron-back" size={20} color={currentTheme.colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
            Plan Builder
          </Text>
          <RNView style={styles.headerRight}>
            {currentPlan ? (
              <TouchableOpacity onPress={handleUsePlan} style={styles.createButton}>
                <Text style={[styles.createText, { color: currentTheme.colors.primary, fontFamily: 'Raleway_600SemiBold' }]}>
                  Create
                </Text>
              </TouchableOpacity>
            ) : (
              <RNView style={styles.headerRight} />
            )}
          </RNView>
        </View>

        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
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
              <Ionicons name="sparkles" size={48} color={currentTheme.colors.primary + '40'} />
              <Text style={[styles.welcomeTitle, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
                Let's Build Your Workout
              </Text>
              <Text style={[styles.welcomeSubtitle, { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_400Regular' }]}>
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
                style={[
                  styles.messageText,
                  {
                    color: message.role === 'user' ? '#fff' : currentTheme.colors.text,
                    fontFamily: 'Raleway_400Regular',
                  },
                ]}
              >
                {message.content}
              </Text>
            </RNView>
          ))}

          {/* Context Questions */}
          {contextQuestions.length > 0 && !isLoading && (
            <RNView style={styles.questionsContainer}>
              {contextQuestions.map((question, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.questionChip, { backgroundColor: currentTheme.colors.surface }]}
                  onPress={() => handleQuestionPress(question)}
                >
                  <Text style={[styles.questionText, { color: currentTheme.colors.text, fontFamily: 'Raleway_500Medium' }]}>
                    {question}
                  </Text>
                </TouchableOpacity>
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
                  <Text style={[styles.planTitle, { color: currentTheme.colors.text, fontFamily: 'Raleway_600SemiBold' }]}>
                    Current Plan
                  </Text>
                </RNView>
                <Ionicons
                  name={isPlanExpanded ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={currentTheme.colors.text + '60'}
                />
              </RNView>

              {isPlanExpanded ? (
                <Text style={[styles.planTextExpanded, { color: currentTheme.colors.text, fontFamily: 'Raleway_400Regular' }]}>
                  {currentPlan}
                </Text>
              ) : (
                <Text
                  style={[styles.planTextCollapsed, { color: currentTheme.colors.text + '60', fontFamily: 'Raleway_400Regular' }]}
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
                <RNView style={[styles.typingDot, { backgroundColor: currentTheme.colors.text + '40' }]} />
                <RNView style={[styles.typingDot, { backgroundColor: currentTheme.colors.text + '40' }]} />
                <RNView style={[styles.typingDot, { backgroundColor: currentTheme.colors.text + '40' }]} />
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
                    fontFamily: 'Raleway_400Regular',
                  },
                ]}
                value={inputText}
                onChangeText={setInputText}
                placeholder={currentPlan ? "Ask to refine your plan..." : "e.g., push day, leg workout..."}
                placeholderTextColor={currentTheme.colors.text + '40'}
                multiline
                maxLength={500}
                editable={!isLoading}
                onSubmitEditing={() => handleSendMessage(inputText)}
                blurOnSubmit={false}
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  {
                    backgroundColor: inputText.trim() && !isLoading
                      ? currentTheme.colors.primary
                      : 'transparent',
                  },
                ]}
                onPress={() => handleSendMessage(inputText)}
                disabled={!inputText.trim() || isLoading}
              >
                <Ionicons
                  name="arrow-up-circle"
                  size={28}
                  color={inputText.trim() && !isLoading ? '#fff' : currentTheme.colors.text + '30'}
                />
              </TouchableOpacity>
            </RNView>
          </View>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerRight: {
    minWidth: 60,
    height: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  createButton: {
    paddingHorizontal: 4,
    height: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  createText: {
    fontSize: 16,
  },
  headerTitle: {
    fontSize: 18,
  },
  chatContainer: {
    flex: 1,
  },
  chatContent: {
    padding: 20,
    gap: 16,
  },
  welcomeContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  welcomeTitle: {
    fontSize: 22,
    marginTop: 8,
  },
  welcomeSubtitle: {
    fontSize: 15,
    textAlign: 'center',
  },
  messageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
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
    fontSize: 15,
    lineHeight: 21,
  },
  typingIndicator: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  questionsContainer: {
    gap: 8,
    marginTop: 4,
    alignSelf: 'flex-start',
    maxWidth: '85%',
  },
  questionChip: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  questionText: {
    fontSize: 14,
  },
  planCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginTop: 8,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  planHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planTitle: {
    fontSize: 15,
  },
  planTextCollapsed: {
    fontSize: 13,
    lineHeight: 18,
  },
  planTextExpanded: {
    fontSize: 14,
    lineHeight: 22,
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    paddingBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    maxHeight: 100,
    paddingVertical: 8,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default PlanBuilderModal;
