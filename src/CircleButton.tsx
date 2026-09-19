import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, CIRCLE_SIZE } from './theme';

type CircleButtonProps = {
  icon: string;
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
        <Text style={styles.icon}>{icon}</Text>
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
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  icon: {
    fontSize: 40,
    textAlign: 'center',
    marginBottom: 4,
  },
  label: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '700',
    color: colors.onButton,
    textAlign: 'center',
    paddingHorizontal: 6,
  },
});
