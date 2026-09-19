import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, CIRCLE_SIZE } from './theme';

type CircleButtonProps = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  backgroundColor: string;
  onPress: () => void;
  onLongPress?: () => void;
  size?: number;
};

export function CircleButton({
  icon,
  label,
  backgroundColor,
  onPress,
  onLongPress,
  size = CIRCLE_SIZE,
}: CircleButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View pointerEvents="none">
        <Ionicons name={icon} size={56} color={colors.onButton} style={styles.icon} />
        <Text style={styles.label} numberOfLines={2}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    textAlign: 'center',
    marginBottom: 4,
  },
  label: {
    fontSize: 26,
    lineHeight: 30,
    fontWeight: '700',
    color: colors.onButton,
    textAlign: 'center',
    paddingHorizontal: 6,
  },
});
