import * as Haptics from 'expo-haptics';
import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CircleButton } from './CircleButton';
import type { Pill } from './storage';
import { colors } from './theme';

const SPEECH_INTERVAL_MS = 8_000;
const VIBRATION_INTERVAL_MS = 1_500;
// Safety net: if the Modal's onShow never fires, start the alarm anyway
// rather than leaving a due dose completely silent.
const SHOW_FALLBACK_MS = 2_000;

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
  const [noPhoneHint, setNoPhoneHint] = useState(false);

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
        Animated.timing(flash, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.timing(flash, { toValue: 0.15, duration: 450, useNativeDriver: true }),
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

  const handleCall = () => {
    if (!familyPhone) {
      // Don't open Settings from here — that would be a modal on a modal.
      setNoPhoneHint(true);
      return;
    }
    onCall();
  };

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
          <Text style={styles.eyebrow}>Пора принять лекарство</Text>
          <Text style={styles.pillName}>{pill.name}</Text>
          <Text style={styles.time}>Время: {pill.time}</Text>

          <View style={styles.confirmWrap}>
            <CircleButton
              icon="checkmark-circle-outline"
              label="Принял(а)"
              backgroundColor={colors.green}
              onPress={onConfirm}
              size={290}
            />
          </View>

          {escalated && (
            <View style={styles.escalation}>
              <Text style={styles.escalationText}>
                Родные оповещены о задержке приёма
              </Text>
              <Pressable
                style={styles.callButton}
                onPress={handleCall}
                accessibilityRole="button"
                accessibilityLabel="Позвонить"
              >
                <Text style={styles.callButtonText}>📞 Позвонить</Text>
              </Pressable>
              {noPhoneHint && (
                <Text style={styles.noPhoneHint}>Укажите номер семьи в настройках</Text>
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
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  eyebrow: {
    fontSize: 24,
    color: colors.text,
    marginBottom: 8,
  },
  pillName: {
    fontSize: 40,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  time: {
    fontSize: 24,
    color: colors.text,
    marginBottom: 36,
  },
  confirmWrap: {
    marginBottom: 24,
  },
  escalation: {
    alignItems: 'center',
    marginTop: 12,
  },
  escalationText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.amber,
    textAlign: 'center',
    marginBottom: 16,
  },
  noPhoneHint: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.amber,
    textAlign: 'center',
    marginTop: 12,
  },
  callButton: {
    backgroundColor: colors.amber,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 32,
  },
  callButtonText: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.onButton,
  },
});
