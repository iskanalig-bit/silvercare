import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from './theme';

const pad = (n: number) => String(n).padStart(2, '0');

// The next full 5 minutes after now (14:23 -> 14:25, 14:25 -> 14:30,
// 23:58 -> 00:00).
function nextFiveMinutes(): { hours: number; minutes: number } {
  const now = new Date();
  const total =
    (now.getHours() * 60 + Math.floor(now.getMinutes() / 5) * 5 + 5) % (24 * 60);
  return { hours: Math.floor(total / 60), minutes: total % 60 };
}

type StepperProps = {
  label: string;
  value: number;
  onUp: () => void;
  onDown: () => void;
};

function Stepper({ label, value, onUp, onDown }: StepperProps) {
  return (
    <View style={styles.stepper}>
      <Text style={styles.stepperLabel}>{label}</Text>
      <Pressable
        style={({ pressed }) => [styles.stepButton, pressed && styles.stepButtonPressed]}
        onPress={onUp}
        accessibilityRole="button"
        accessibilityLabel={`${label}: больше`}
      >
        <Ionicons name="chevron-up" size={40} color={colors.onButton} />
      </Pressable>
      <Text style={styles.stepperValue}>{pad(value)}</Text>
      <Pressable
        style={({ pressed }) => [styles.stepButton, pressed && styles.stepButtonPressed]}
        onPress={onDown}
        accessibilityRole="button"
        accessibilityLabel={`${label}: меньше`}
      >
        <Ionicons name="chevron-down" size={40} color={colors.onButton} />
      </Pressable>
    </View>
  );
}

type AddPillModalProps = {
  visible: boolean;
  onCancel: () => void;
  onSave: (name: string, time: string) => void;
};

export function AddPillModal({ visible, onCancel, onSave }: AddPillModalProps) {
  const initial = nextFiveMinutes();
  const [name, setName] = useState('');
  const [hours, setHours] = useState(initial.hours);
  const [minutes, setMinutes] = useState(initial.minutes);
  const [error, setError] = useState('');

  // Each time the form opens, the time defaults to the next full 5 minutes.
  useEffect(() => {
    if (visible) {
      const t = nextFiveMinutes();
      setHours(t.hours);
      setMinutes(t.minutes);
    }
  }, [visible]);

  const reset = () => {
    setName('');
    setError('');
  };

  const handleCancel = () => {
    reset();
    onCancel();
  };

  const handleSave = () => {
    if (name.trim().length === 0) {
      setError('Введите название лекарства');
      return;
    }
    onSave(name.trim(), `${pad(hours)}:${pad(minutes)}`);
    reset();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
          >
            <Text style={styles.title}>Новое лекарство</Text>

            <Text style={styles.label}>Название</Text>
            <TextInput
              style={styles.input}
              placeholder="Например, Аспирин"
              placeholderTextColor={colors.placeholder}
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (error) setError('');
              }}
              autoCapitalize="sentences"
              returnKeyType="done"
            />

            <Text style={styles.label}>Время приёма</Text>
            <View style={styles.timeRow}>
              <Stepper
                label="Часы"
                value={hours}
                onUp={() => setHours((h) => (h + 1) % 24)}
                onDown={() => setHours((h) => (h + 23) % 24)}
              />
              <Text style={styles.colon}>:</Text>
              <Stepper
                label="Минуты"
                value={minutes}
                onUp={() => setMinutes((m) => (m + 5) % 60)}
                onDown={() => setMinutes((m) => (m + 55) % 60)}
              />
            </View>

            {error.length > 0 && <Text style={styles.error}>{error}</Text>}

            <Pressable
              style={({ pressed }) => [styles.saveButton, pressed && styles.buttonPressed]}
              onPress={handleSave}
              accessibilityRole="button"
            >
              <Text style={styles.saveButtonText}>Сохранить</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.cancelButton, pressed && styles.buttonPressed]}
              onPress={handleCancel}
              accessibilityRole="button"
            >
              <Text style={styles.cancelButtonText}>Отмена</Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  label: {
    fontSize: 24,
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    borderWidth: 2,
    borderColor: colors.muted,
    borderRadius: 12,
    backgroundColor: colors.background,
    minHeight: 64,
    paddingVertical: 10,
    paddingHorizontal: 16,
    fontSize: 28,
    color: colors.text,
    marginBottom: 24,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  stepper: {
    flex: 1,
    alignItems: 'stretch',
  },
  stepperLabel: {
    fontSize: 24,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 6,
  },
  stepButton: {
    minWidth: 64,
    minHeight: 64,
    borderRadius: 16,
    backgroundColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonPressed: {
    opacity: 0.9,
  },
  stepperValue: {
    fontSize: 48,
    lineHeight: 64,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  colon: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.text,
    width: 28,
    textAlign: 'center',
    marginTop: 35, // centers the colon on the value row, not the whole stepper
  },
  error: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.amber,
    marginBottom: 16,
  },
  saveButton: {
    alignSelf: 'stretch',
    minHeight: 72,
    borderRadius: 16,
    backgroundColor: colors.green,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  saveButtonText: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.onButton,
  },
  cancelButton: {
    alignSelf: 'stretch',
    minHeight: 72,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.blue,
  },
  buttonPressed: {
    opacity: 0.9,
  },
});
