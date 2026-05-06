import { View, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useRef, useEffect } from 'react';
import { useThemeColors } from '../../lib/hooks/useThemeColors';

interface PaginationDotsProps {
  total: number;
  activeIndex: number;
  onDotPress: (index: number) => void;
}

/** Animated pagination dots row — active dot expands to a pill shape. */
export function PaginationDots({ total, activeIndex, onDotPress }: PaginationDotsProps) {
  const colors = useThemeColors();

  return (
    <View style={styles.container}>
      {Array.from({ length: total }).map((_, i) => (
        <Dot
          key={i}
          index={i}
          isActive={i === activeIndex}
          activeColor={colors.header}
          inactiveColor={colors.chevron}
          onPress={onDotPress}
        />
      ))}
    </View>
  );
}

interface DotProps {
  index: number;
  isActive: boolean;
  activeColor: string;
  inactiveColor: string;
  onPress: (index: number) => void;
}

/** Single animated dot that expands when active. */
function Dot({ index, isActive, activeColor, inactiveColor, onPress }: DotProps) {
  const widthAnim = useRef(new Animated.Value(isActive ? 22 : 6)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: isActive ? 22 : 6,
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [isActive, widthAnim]);

  return (
    <TouchableOpacity
      onPress={() => onPress(index)}
      accessibilityRole="button"
      accessibilityLabel={`Go to slide ${index + 1}`}
      hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
    >
      <Animated.View
        style={[
          styles.dot,
          {
            width: widthAnim,
            backgroundColor: isActive ? activeColor : inactiveColor,
          },
        ]}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 18,
  },
  dot: {
    height: 6,
    borderRadius: 99,
  },
});
