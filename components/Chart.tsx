import { useTheme } from '@/contexts/ThemeContext';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
  subtitle?: string;
}

interface ChartProps {
  data: ChartDataPoint[];
  type: 'bar' | 'horizontal-bar' | 'pie';
  height?: number;
  showValues?: boolean;
  title?: string;
}

export default function Chart({ 
  data, 
  type = 'bar', 
  height = 200, 
  showValues = true,
  title 
}: ChartProps) {
  const { currentTheme } = useTheme();
  
  if (!data || data.length === 0) {
    return (
      <View style={[styles.container, { height }]}>
        <Text style={[styles.noData, { color: currentTheme.colors.text }]}>
          No data available
        </Text>
      </View>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value));
  const minValue = Math.min(...data.map(d => d.value));
  const range = maxValue - minValue || 1;

  const formatValue = (value: number) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}k`;
    }
    return value.toString();
  };

  const renderBarChart = () => {
    const chartHeight = height - (title ? 60 : 40);
    const barWidth = Math.min(50, (300 - 20) / data.length - 10);

    return (
      <View style={styles.chartContainer}>
        <View style={[styles.barsContainer, { height: chartHeight }]}>
          {data.map((item, index) => {
            const barHeight = ((item.value - minValue) / range) * (chartHeight - 40);
            const barColor = item.color || currentTheme.colors.accent;
            
            return (
              <View key={index} style={styles.barWrapper}>
                <View style={styles.barContainer}>
                  {showValues && (
                    <Text style={[styles.barValue, { color: currentTheme.colors.text }]}>
                      {formatValue(item.value)}
                    </Text>
                  )}
                  <View
                    style={[
                      styles.bar,
                      {
                        height: Math.max(barHeight, 4),
                        width: barWidth,
                        backgroundColor: barColor,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.barLabel, { color: currentTheme.colors.text }]}>
                  {item.label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderHorizontalBarChart = () => {
    const chartHeight = height - (title ? 60 : 40);
    const barHeight = Math.min(30, (chartHeight - 20) / data.length - 8);

    return (
      <View style={styles.chartContainer}>
        <View style={[styles.horizontalBarsContainer, { height: chartHeight }]}>
          {data.map((item, index) => {
            const barWidth = ((item.value - minValue) / range) * 200;
            const barColor = item.color || currentTheme.colors.accent;
            
            return (
              <View key={index} style={styles.horizontalBarWrapper}>
                <View style={styles.horizontalBarLabelContainer}>
                  <Text 
                    style={[styles.horizontalBarLabel, { color: currentTheme.colors.text }]}
                    numberOfLines={2}
                    ellipsizeMode="tail"
                  >
                    {item.label}
                  </Text>
                  {item.subtitle && (
                    <Text style={[styles.horizontalBarSubtitle, { color: currentTheme.colors.text }]}>
                      {item.subtitle}
                    </Text>
                  )}
                </View>
                <View style={styles.horizontalBarContainer}>
                  <View
                    style={[
                      styles.horizontalBar,
                      {
                        width: Math.max(barWidth, 4),
                        height: barHeight,
                        backgroundColor: barColor,
                      },
                    ]}
                  />
                  {showValues && (
                    <Text style={[styles.horizontalBarValue, { color: currentTheme.colors.text }]}>
                      {formatValue(item.value)}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderPieChart = () => {
    const totalValue = data.reduce((sum, item) => sum + item.value, 0);
    const size = Math.min(height - (title ? 80 : 60), 140);
    const radius = size / 2;
    const strokeWidth = 20;
    const _circumference = 2 * Math.PI * (radius - strokeWidth / 2);
    
    let cumulativePercentage = 0;
    
    return (
      <View style={styles.chartContainer}>
        {/* Donut Chart using border technique */}
        <View style={[styles.donutContainer, { width: size, height: size }]}>
          <View 
            style={[
              styles.donutBase,
              { 
                width: size,
                height: size,
                borderRadius: radius,
                backgroundColor: currentTheme.colors.border,
                opacity: 0.2
              }
            ]} 
          />
          
          {/* Create segments using positioned colored arcs */}
          {data.map((item, index) => {
            const percentage = item.value / totalValue;
            const barColor = item.color || currentTheme.colors.accent;
            const rotation = cumulativePercentage * 360;
            const _segmentAngle = percentage * 360;
            
            cumulativePercentage += percentage;
            
            return (
              <View
                key={index}
                style={[
                  styles.donutSegment,
                  {
                    width: size,
                    height: size,
                    borderRadius: radius,
                    borderWidth: strokeWidth,
                    borderColor: barColor,
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    transform: [
                      { rotate: `${rotation}deg` }
                    ],
                    // Create segment effect by hiding parts of the circle
                    backgroundColor: 'transparent',
                  }
                ]}
              />
            );
          })}
          
          {/* Center content */}
          <View style={styles.donutCenter}>
            <Text style={[styles.donutCenterText, { color: currentTheme.colors.text }]}>
              Total
            </Text>
            <Text style={[styles.donutCenterValue, { color: currentTheme.colors.text }]}>
              {totalValue}
            </Text>
          </View>
        </View>
        
        {/* Legend */}
        <View style={styles.pieLegend}>
          {data.map((item, index) => {
            const percentage = ((item.value / totalValue) * 100).toFixed(1);
            const barColor = item.color || currentTheme.colors.accent;
            
            return (
              <View key={index} style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: barColor }]} />
                <Text style={[styles.legendText, { color: currentTheme.colors.text }]}>
                  {item.label}
                </Text>
                {showValues && (
                  <Text style={[styles.legendValue, { color: currentTheme.colors.text }]}>
                    {percentage}%
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {title && (
        <Text style={[styles.title, { color: currentTheme.colors.text }]}>
          {title}
        </Text>
      )}
      {type === 'pie' ? renderPieChart() : 
       type === 'horizontal-bar' ? renderHorizontalBarChart() : renderBarChart()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  noData: {
    textAlign: 'center',
    fontSize: 14,
    opacity: 0.6,
  },
  chartContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 10,
  },
  barWrapper: {
    alignItems: 'center',
    flex: 1,
  },
  barContainer: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
    paddingBottom: 8,
  },
  bar: {
    borderRadius: 4,
    minHeight: 4,
  },
  barValue: {
    fontSize: 12,
    marginBottom: 4,
  },
  barLabel: {
    fontSize: 11,
    marginTop: 8,
    textAlign: 'center',
    opacity: 0.8,
  },
  horizontalBarsContainer: {
    width: '100%',
    justifyContent: 'space-around',
  },
  horizontalBarWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  horizontalBarLabelContainer: {
    width: 100,
    paddingRight: 8,
    justifyContent: 'center',
  },
  horizontalBarLabel: {
    fontSize: 11,
    textAlign: 'right',
    opacity: 0.8,
  },
  horizontalBarSubtitle: {
    fontSize: 9,
    textAlign: 'right',
    opacity: 0.6,
  },
  horizontalBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 16,
    maxWidth: '70%',
  },
  horizontalBar: {
    borderRadius: 4,
    minWidth: 4,
    maxWidth: '80%',
  },
  horizontalBarValue: {
    fontSize: 11,
    marginLeft: 8,
    minWidth: 40,
  },
  donutContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  donutBase: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  donutSegment: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  donutCenter: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  donutCenterText: {
    fontSize: 14,
    marginBottom: 4,
  },
  donutCenterValue: {
    fontSize: 24,
  },
  pieLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 20,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 10,
    marginVertical: 5,
  },
  legendColor: {
    width: 15,
    height: 15,
    borderRadius: 8,
    marginRight: 8,
  },
  legendText: {
    fontSize: 12,
  },
  legendValue: {
    fontSize: 12,
    marginLeft: 8,
  },
}); 