import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View as RNView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ViewShot from 'react-native-view-shot';
import { Text, View } from '@/components/Themed';
import { useTheme } from '@/contexts/ThemeContext';
import {
  calculateRecapStats,
  RecapPeriod,
  RecapStats,
  getPreviousPeriod,
  getNextPeriod,
  canGoNext,
} from '@/lib/recapStats';
import {
  formatLargeNumber,
  getVolumeComparison,
  getWorkoutCountComparison,
} from '@/lib/funComparisons';
import { captureAndShare } from '@/lib/shareUtils';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 40;

interface RecapCardData {
  id: string;
  type: 'workouts' | 'volume' | 'streak' | 'topExercise' | 'prs' | 'muscles' | 'active';
  title: string;
  icon: string;
  gradient: string[];
}

const CARD_TYPES: RecapCardData[] = [
  { id: 'workouts', type: 'workouts', title: 'Workouts', icon: '🏋️', gradient: ['#667eea', '#764ba2'] },
  { id: 'volume', type: 'volume', title: 'Volume', icon: '💪', gradient: ['#f093fb', '#f5576c'] },
  { id: 'streak', type: 'streak', title: 'Streak', icon: '🔥', gradient: ['#fa709a', '#fee140'] },
  { id: 'topExercise', type: 'topExercise', title: 'Top Exercise', icon: '⭐', gradient: ['#a8edea', '#fed6e3'] },
  { id: 'prs', type: 'prs', title: 'PRs', icon: '🏆', gradient: ['#ffecd2', '#fcb69f'] },
  { id: 'muscles', type: 'muscles', title: 'Focus', icon: '🎯', gradient: ['#667eea', '#764ba2'] },
  { id: 'active', type: 'active', title: 'Days Active', icon: '✨', gradient: ['#a18cd1', '#fbc2eb'] },
];

interface RecapViewProps {
  onClose: () => void;
}

export default function RecapView({ onClose }: RecapViewProps) {
  const { currentTheme } = useTheme();
  const [period, setPeriod] = useState<RecapPeriod>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [stats, setStats] = useState<RecapStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const viewShotRefs = useRef<Record<string, ViewShot | null>>({});

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const data = await calculateRecapStats(period, currentDate);
      setStats(data);
    } catch (error) {
      console.error('Error loading recap stats:', error);
    } finally {
      setLoading(false);
    }
  }, [period, currentDate]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handlePrevPeriod = () => {
    setCurrentDate(getPreviousPeriod(period, currentDate));
  };

  const handleNextPeriod = () => {
    if (canGoNext(period, currentDate)) {
      setCurrentDate(getNextPeriod(period, currentDate));
    }
  };

  const handleShare = async (cardType: string) => {
    const ref = viewShotRefs.current[cardType];
    if (ref) {
      await captureAndShare({ current: ref } as React.RefObject<ViewShot>);
    }
  };

  const availableCards = CARD_TYPES.filter(card => {
    if (!stats) return false;
    switch (card.type) {
      case 'workouts': return stats.totalWorkouts > 0;
      case 'volume': return stats.totalVolume > 0;
      case 'streak': return stats.currentStreak > 0 || stats.longestStreak.days > 0;
      case 'topExercise': return stats.topExercises.length > 0;
      case 'prs': return stats.prsAchieved > 0;
      case 'muscles': return stats.muscleGroupDistribution.length > 0;
      case 'active': return stats.daysActive > 0;
      default: return false;
    }
  });

  const renderCard = ({ item, index }: { item: RecapCardData; index: number }) => {
    if (!stats) return null;

    const renderCardContent = () => {
      switch (item.type) {
        case 'workouts':
          return (
            <>
              <Text style={styles.cardMainValue}>{stats.totalWorkouts}</Text>
              <Text style={styles.cardSubtitle}>WORKOUTS</Text>
              <Text style={styles.cardFunFact}>
                {getWorkoutCountComparison(stats.totalWorkouts).text} {getWorkoutCountComparison(stats.totalWorkouts).emoji}
              </Text>
            </>
          );
        case 'volume':
          return (
            <>
              <Text style={styles.cardMainValue}>{formatLargeNumber(stats.totalVolume)}</Text>
              <Text style={styles.cardSubtitle}>{stats.unit.toUpperCase()} LIFTED</Text>
              <Text style={styles.cardFunFact}>
                Like lifting {getVolumeComparison(stats.totalVolume).text} {getVolumeComparison(stats.totalVolume).emoji}
              </Text>
            </>
          );
        case 'streak':
          return (
            <>
              <Text style={styles.cardMainValue}>{stats.currentStreak || stats.longestStreak.days}</Text>
              <Text style={styles.cardSubtitle}>
                {stats.currentStreak > 0 ? 'DAY STREAK' : 'LONGEST STREAK'}
              </Text>
              {stats.currentStreak > 0 && (
                <Text style={styles.cardFunFact}>Keep it going!</Text>
              )}
            </>
          );
        case 'topExercise':
          return (
            <>
              <Text style={[styles.cardMainValue, { fontSize: 32 }]}>{stats.topExercises[0]?.name}</Text>
              <Text style={styles.cardSubtitle}>{stats.topExercises[0]?.count} TIMES</Text>
              {stats.topExercises[0]?.bestWeight > 0 && (
                <Text style={styles.cardFunFact}>
                  Best: {stats.topExercises[0].bestWeight} {stats.unit}
                </Text>
              )}
            </>
          );
        case 'prs':
          return (
            <>
              <Text style={styles.cardMainValue}>{stats.prsAchieved}</Text>
              <Text style={styles.cardSubtitle}>PERSONAL RECORDS</Text>
              {stats.topPR && (
                <Text style={styles.cardFunFact}>
                  Top: +{stats.topPR.improvement} {stats.unit} on {stats.topPR.exercise}
                </Text>
              )}
            </>
          );
        case 'muscles':
          return (
            <>
              <Text style={[styles.cardMainValue, { fontSize: 36, textTransform: 'capitalize' }]}>
                {stats.muscleGroupDistribution[0]?.group}
              </Text>
              <Text style={styles.cardSubtitle}>MOST TRAINED</Text>
              <RNView style={styles.muscleList}>
                {stats.muscleGroupDistribution.slice(0, 3).map((m, i) => (
                  <RNView key={i} style={styles.muscleRow}>
                    <RNView style={styles.muscleBarContainer}>
                      <RNView style={[styles.muscleBar, { width: `${m.percentage}%` }]} />
                    </RNView>
                    <Text style={styles.muscleName}>{m.group}</Text>
                    <Text style={styles.musclePercent}>{m.percentage}%</Text>
                  </RNView>
                ))}
              </RNView>
            </>
          );
        case 'active':
          return (
            <>
              <Text style={styles.cardMainValue}>{stats.daysActive}</Text>
              <Text style={styles.cardSubtitle}>DAYS ACTIVE</Text>
              <Text style={styles.cardFunFact}>
                {Math.round((stats.daysActive / stats.totalDaysInPeriod) * 100)}% of {period === 'week' ? 'the week' : period === 'month' ? 'the month' : 'the year'}
              </Text>
            </>
          );
        default:
          return null;
      }
    };

    return (
      <RNView style={styles.cardWrapper}>
        <ViewShot
          ref={ref => { viewShotRefs.current[item.type] = ref; }}
          options={{ format: 'png', quality: 1 }}
          style={styles.viewShot}
        >
          <LinearGradient
            colors={item.gradient as any}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.card}
          >
            <RNView style={styles.cardHeader}>
              <Text style={styles.cardIcon}>{item.icon}</Text>
              <Text style={styles.cardTitle}>{item.title.toUpperCase()}</Text>
            </RNView>

            <RNView style={styles.cardContent}>
              {renderCardContent()}
            </RNView>

            <RNView style={styles.cardFooter}>
              <Text style={styles.periodLabel}>{stats.periodLabel}</Text>
              <Text style={styles.periodSubtitle}>{stats.periodSubtitle}</Text>
            </RNView>
          </LinearGradient>
        </ViewShot>

        <TouchableOpacity
          style={[styles.shareButton, { backgroundColor: currentTheme.colors.surface, borderWidth: 1, borderColor: currentTheme.colors.border }]}
          onPress={() => handleShare(item.type)}
        >
          <Ionicons name="share-outline" size={18} color={currentTheme.colors.text} />
          <Text style={[styles.shareButtonText, { color: currentTheme.colors.text }]}>Share</Text>
        </TouchableOpacity>
      </RNView>
    );
  };

  const handleScroll = (event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / CARD_WIDTH);
    setCurrentCardIndex(index);
  };

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.colors.background }]}>
      {/* Header */}
      <RNView style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={28} color={currentTheme.colors.text} />
        </TouchableOpacity>

        {/* Period Selector */}
        <RNView style={styles.periodSelector}>
          {(['week', 'month', 'year'] as RecapPeriod[]).map((p) => (
            <TouchableOpacity
              key={p}
              style={[
                styles.periodButton,
                period === p && { backgroundColor: currentTheme.colors.accent },
              ]}
              onPress={() => setPeriod(p)}
            >
              <Text
                style={[
                  styles.periodButtonText,
                  { color: period === p ? '#FFF' : currentTheme.colors.text + '80' },
                ]}
              >
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </RNView>

        <RNView style={{ width: 28 }} />
      </RNView>

      {/* Period Navigation */}
      <RNView style={styles.periodNav}>
        <TouchableOpacity onPress={handlePrevPeriod} style={styles.navButton}>
          <Ionicons name="chevron-back" size={24} color={currentTheme.colors.text} />
        </TouchableOpacity>

        <RNView style={styles.periodInfo}>
          <Text style={[styles.periodNavLabel, { color: currentTheme.colors.text }]}>
            {stats?.periodLabel || '...'}
          </Text>
          <Text style={[styles.periodNavSubtitle, { color: currentTheme.colors.text + '60' }]}>
            {stats?.periodSubtitle || ''}
          </Text>
        </RNView>

        <TouchableOpacity
          onPress={handleNextPeriod}
          style={[styles.navButton, !canGoNext(period, currentDate) && { opacity: 0.3 }]}
          disabled={!canGoNext(period, currentDate)}
        >
          <Ionicons name="chevron-forward" size={24} color={currentTheme.colors.text} />
        </TouchableOpacity>
      </RNView>

      {/* Cards */}
      {loading ? (
        <RNView style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={currentTheme.colors.accent} />
          <Text style={[styles.loadingText, { color: currentTheme.colors.text }]}>
            Loading your recap...
          </Text>
        </RNView>
      ) : availableCards.length === 0 ? (
        <RNView style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🏋️</Text>
          <Text style={[styles.emptyText, { color: currentTheme.colors.text }]}>
            No workouts this {period}
          </Text>
          <Text style={[styles.emptySubtext, { color: currentTheme.colors.text + '60' }]}>
            Start logging to see your recap!
          </Text>
        </RNView>
      ) : (
        <>
          <FlatList
            ref={flatListRef}
            data={availableCards}
            renderItem={renderCard}
            keyExtractor={item => item.id}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_WIDTH + 20}
            decelerationRate="fast"
            contentContainerStyle={styles.cardsContainer}
            onScroll={handleScroll}
            scrollEventThrottle={16}
          />

          {/* Page Indicator */}
          <RNView style={styles.pageIndicator}>
            {availableCards.map((_, index) => (
              <RNView
                key={index}
                style={[
                  styles.dot,
                  {
                    backgroundColor: index === currentCardIndex
                      ? currentTheme.colors.accent
                      : currentTheme.colors.text + '30',
                  },
                ]}
              />
            ))}
          </RNView>

          {/* Swipe Hint */}
          <Text style={[styles.swipeHint, { color: currentTheme.colors.text + '40' }]}>
            Swipe to see more
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  closeButton: {
    padding: 4,
  },
  periodSelector: {
    flexDirection: 'row',
    backgroundColor: 'rgba(150,150,150,0.1)',
    borderRadius: 20,
    padding: 4,
  },
  periodButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  periodButtonText: {
    fontSize: 14,
    fontFamily: 'Raleway_600SemiBold',
  },
  periodNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  navButton: {
    padding: 8,
  },
  periodInfo: {
    alignItems: 'center',
  },
  periodNavLabel: {
    fontSize: 20,
    fontFamily: 'Raleway_700Bold',
  },
  periodNavSubtitle: {
    fontSize: 14,
    fontFamily: 'Raleway_500Medium',
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Raleway_500Medium',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 20,
    fontFamily: 'Raleway_600SemiBold',
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 16,
    fontFamily: 'Raleway_400Regular',
    textAlign: 'center',
    marginTop: 8,
  },
  cardsContainer: {
    paddingHorizontal: 20,
  },
  cardWrapper: {
    width: CARD_WIDTH,
    marginRight: 20,
    alignItems: 'center',
  },
  viewShot: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  card: {
    width: CARD_WIDTH,
    height: SCREEN_HEIGHT * 0.55,
    borderRadius: 24,
    padding: 24,
    justifyContent: 'space-between',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardIcon: {
    fontSize: 28,
  },
  cardTitle: {
    fontSize: 14,
    fontFamily: 'Raleway_700Bold',
    color: '#FFF',
    letterSpacing: 2,
  },
  cardContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardMainValue: {
    fontSize: 72,
    fontFamily: 'Raleway_700Bold',
    color: '#FFF',
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: 16,
    fontFamily: 'Raleway_600SemiBold',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 2,
    marginTop: 8,
  },
  cardFunFact: {
    fontSize: 16,
    fontFamily: 'Raleway_500Medium',
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginTop: 20,
    paddingHorizontal: 20,
  },
  cardFooter: {
    alignItems: 'center',
  },
  periodLabel: {
    fontSize: 14,
    fontFamily: 'Raleway_600SemiBold',
    color: 'rgba(255,255,255,0.7)',
  },
  periodSubtitle: {
    fontSize: 12,
    fontFamily: 'Raleway_400Regular',
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 24,
    marginTop: 16,
  },
  shareButtonText: {
    fontSize: 16,
    fontFamily: 'Raleway_600SemiBold',
  },
  pageIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  swipeHint: {
    textAlign: 'center',
    fontSize: 14,
    fontFamily: 'Raleway_400Regular',
    marginTop: 16,
    marginBottom: 40,
  },
  muscleList: {
    width: '100%',
    marginTop: 20,
    gap: 12,
  },
  muscleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  muscleBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  muscleBar: {
    height: '100%',
    backgroundColor: '#FFF',
    borderRadius: 4,
  },
  muscleName: {
    fontSize: 12,
    fontFamily: 'Raleway_500Medium',
    color: 'rgba(255,255,255,0.9)',
    width: 70,
    textTransform: 'capitalize',
  },
  musclePercent: {
    fontSize: 12,
    fontFamily: 'Raleway_600SemiBold',
    color: '#FFF',
    width: 35,
    textAlign: 'right',
  },
});
