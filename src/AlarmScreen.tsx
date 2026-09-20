import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  Vibration,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CircleButton } from './CircleButton';
import type { Pill } from './storage';
import { colors } from './theme';

const SPEECH_INTERVAL_MS = 8_000;
const VIBRATION_INTERVAL_MS = 1_500;
// Safety net: if the Modal's onShow never fires, start the alarm anyway
// rather than leaving a due dose completely silent.
const SHOW_FALLBACK_MS = 2_000;
// Border pulse: one full cycle per second (500ms up + 500ms down).
const PULSE_HALF_CYCLE_MS = 500;
// The confirm circle is the biggest element: at least 240, larger on tall
// screens.
const CONFIRM_MIN = 240;
const CONFIRM_MAX = 300;

type AlarmScreenProps = {
  pill: Pill;
  escalated: boolean;
  familyPhone: string | null;
  onConfirm: () => void;
  onCall: () => void;
};

export function AlarmScreen({
  pill,
  escalated,
  familyPhone,
  onConfirm,
  onCall,
}: AlarmScreenProps) {
  const flash = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(false);
  const { width, height } = useWindowDimensions();

  const confirmSize = Math.max(
    CONFIRM_MIN,
    Math.min(CONFIRM_MAX, width - 64, height * 0.36)
  );

  useEffect(() => {
    const timer = setTimeout(() => setShown(true), SHOW_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, []);

  // Voice, vibration and the flashing border only start once the modal is
  // actually on screen (Modal onShow), not when the component mounts.
  useEffect(() => {
    if (!shown) return;
    const speakNow = () =>
      Speech.speak(`Пора принять ${pill.name}`, { language: 'ru-RU', pitch: 1, rate: 0.95 });
    speakNow();
    const speechTimer = setInterval(speakNow, SPEECH_INTERVAL_MS);

    const buzzNow = () => {
      Vibration.vibrate(600);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    };
    buzzNow();
    const vibrationTimer = setInterval(buzzNow, VIBRATION_INTERVAL_MS);

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(flash, {
          toValue: 1,
          duration: PULSE_HALF_CYCLE_MS,
          useNativeDriver: true,
        }),
        Animated.timing(flash, {
          toValue: 0.15,
          duration: PULSE_HALF_CYCLE_MS,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();

    return () => {
      clearInterval(speechTimer);
      clearInterval(vibrationTimer);
      Vibration.cancel();
      Speech.stop();
      loop.stop();
    };
  }, [shown, pill.id, pill.name, flash]);

  return (
    <Modal
      visible
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onShow={() => setShown(true)}
    >
      <SafeAreaView style={styles.safeArea}>
        <Animated.View
          pointerEvents="none"
          style={[styles.flashBorder, { borderColor: colors.amber, opacity: flash }]}
        />
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.time}>{pill.time}</Text>
            <Text
              style={styles.pillName}
              numberOfLines={2}
              adjustsFontSizeToFit
              minimumFontScale={0.6}
            >
              {pill.name}
            </Text>
            <Text style={styles.eyebrow}>Пора принять лекарство</Text>
          </View>

          <View style={styles.confirmArea}>
            <CircleButton
              icon="checkmark-circle-outline"
              label="Принял(а)"
              backgroundColor={colors.green}
              onPress={onConfirm}
              size={confirmSize}
            />
          </View>

          {escalated && (
            <View style={styles.escalation}>
              <View style={styles.escalationPanel}>
                <Text style={styles.escalationText}>Родные оповещены</Text>
              </View>
              {familyPhone ? (
                <Pressable
                  style={({ pressed }) => [styles.callButton, pressed && styles.callPressed]}
                  onPress={onCall}
                  accessibilityRole="button"
                  accessibilityLabel="Позвонить"
                >
                  <Ionicons name="call-outline" size={32} color={colors.onButton} />
                  <Text style={styles.callButtonText}>Позвонить</Text>
                </Pressable>
              ) : (
                <Text style={styles.noPhoneText}>Укажите номер семьи в настройках</Text>
              )}
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flashBorder: {
    ...StyleSheet.absoluteFill,
    borderWidth: 14,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 20,
  },
  header: {
    alignItems: 'center',
  },
  time: {
    fontSize: 56,
    lineHeight: 64,
    fontWeight: '700',
    color: colors.text,
  },
  pillName: {
    fontSize: 40,
    lineHeight: 46,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  eyebrow: {
    fontSize: 28,
    lineHeight: 34,
    color: colors.text,
    textAlign: 'center',
    marginTop: 4,
  },
  confirmArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  escalation: {
    alignSelf: 'stretch',
  },
  escalationPanel: {
    backgroundColor: colors.amberSoft,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 12,
  },
  escalationText: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '700',
    color: colors.amber,
    textAlign: 'center',
  },
  callButton: {
    alignSelf: 'stretch',
    minHeight: 72,
    borderRadius: 16,
    backgroundColor: colors.navy,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  callPressed: {
    opacity: 0.9,
  },
  callButtonText: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.onButton,
  },
  noPhoneText: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    color: colors.amber,
    textAlign: 'center',
  },
});
