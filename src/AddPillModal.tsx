import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from './theme';

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

type AddPillModalProps = {
  visible: boolean;
  onCancel: () => void;
  onSave: (name: string, time: string) => void;
};

export function AddPillModal({ visible, onCancel, onSave }: AddPillModalProps) {
  const [name, setName] = useState('');
  const [time, setTime] = useState('');
  const [error, setError] = useState('');

  const reset = () => {
    setName('');
    setTime('');
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
    if (!TIME_PATTERN.test(time.trim())) {
      setError('Введите время в формате ЧЧ:ММ, например 09:00');
      return;
    }
    onSave(name.trim(), time.trim());
    reset();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.content}>
            <Text style={styles.title}>Новое лекарство</Text>

            <Text style={styles.label}>Название</Text>
            <TextInput
              style={styles.input}
              placeholder="Например, Аспирин"
              placeholderTextColor={colors.placeholder}
              value={name}
              onChangeText={setName}
              autoCapitalize="sentences"
            />

            <Text style={styles.label}>Время приёма (ЧЧ:ММ)</Text>
            <TextInput
              style={styles.input}
              placeholder="09:00"
              placeholderTextColor={colors.placeholder}
              value={time}
              onChangeText={setTime}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
            />

            {error.length > 0 && <Text style={styles.error}>{error}</Text>}

            <View style={styles.buttonRow}>
              <Pressable style={[styles.button, styles.cancelButton]} onPress={handleCancel}>
                <Text style={styles.cancelButtonText}>Отмена</Text>
              </Pressable>
              <Pressable style={[styles.button, styles.saveButton]} onPress={handleSave}>
                <Text style={styles.saveButtonText}>Сохранить</Text>
              </Pressable>
            </View>
          </View>
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
    flex: 1,
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 24,
    textAlign: 'center',
  },
  label: {
    fontSize: 20,
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.panel,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 24,
    color: colors.text,
    marginBottom: 20,
  },
  error: {
    fontSize: 18,
    color: colors.amber,
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 16,
  },
  button: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
  },
  cancelButton: {
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  cancelButtonText: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.text,
  },
  saveButton: {
    backgroundColor: colors.green,
  },
  saveButtonText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.onButton,
  },
});
