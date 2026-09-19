import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { Pill } from './storage';
import { colors } from './theme';

const MIN_PHONE_DIGITS = 10;

type SettingsModalProps = {
  visible: boolean;
  onClose: () => void;
  familyPhone: string | null;
  onSaveFamilyPhone: (phone: string) => void | Promise<void>;
  pills: Pill[];
  onDeletePill: (pillId: string) => void;
  onResetData: () => void;
};

export function SettingsModal({
  visible,
  onClose,
  familyPhone,
  onSaveFamilyPhone,
  pills,
  onDeletePill,
  onResetData,
}: SettingsModalProps) {
  const [phoneInput, setPhoneInput] = useState(familyPhone ?? '');
  const [phoneStatus, setPhoneStatus] = useState<'saved' | 'invalid' | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      setPhoneInput(familyPhone ?? '');
      setPhoneStatus(null);
    }
  }, [visible, familyPhone]);

  useEffect(
    () => () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    },
    []
  );

  const handleSavePhone = async () => {
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    const trimmed = phoneInput.trim();
    if (trimmed.replace(/\D/g, '').length < MIN_PHONE_DIGITS) {
      setPhoneStatus('invalid');
      return;
    }
    await onSaveFamilyPhone(trimmed);
    setPhoneStatus('saved');
    savedTimerRef.current = setTimeout(() => setPhoneStatus(null), 2000);
  };

  const confirmReset = () => {
    Alert.alert(
      'Сбросить данные?',
      'Все лекарства и история приёма будут удалены без возможности восстановления.',
      [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Сбросить', style: 'destructive', onPress: onResetData },
      ]
    );
  };

  const confirmDeletePill = (pill: Pill) => {
    Alert.alert('Удалить лекарство?', `«${pill.name}» будет удалено.`, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: () => onDeletePill(pill.id) },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Настройки</Text>

          <Text style={styles.sectionLabel}>Телефон семьи</Text>
          <TextInput
            style={styles.input}
            placeholder="+7 900 000 00 00"
            placeholderTextColor={colors.placeholder}
            value={phoneInput}
            onChangeText={(text) => {
              setPhoneInput(text);
              if (phoneStatus === 'invalid') setPhoneStatus(null);
            }}
            keyboardType="phone-pad"
          />
          <Pressable style={styles.saveButton} onPress={handleSavePhone}>
            <Text style={styles.saveButtonText}>Сохранить телефон</Text>
          </Pressable>
          {phoneStatus === 'saved' && <Text style={styles.statusSaved}>Сохранено</Text>}
          {phoneStatus === 'invalid' && (
            <Text style={styles.statusInvalid}>Проверьте номер</Text>
          )}

          <Text style={styles.sectionLabel}>Лекарства</Text>
          {pills.length === 0 && (
            <Text style={styles.emptyText}>Лекарства ещё не добавлены</Text>
          )}
          {pills.map((pill) => (
            <View key={pill.id} style={styles.pillRow}>
              <View style={styles.pillInfo}>
                <Text style={styles.pillName}>{pill.name}</Text>
                <Text style={styles.pillTime}>{pill.time}</Text>
              </View>
              <Pressable
                style={styles.deleteButton}
                onPress={() => confirmDeletePill(pill)}
                accessibilityRole="button"
                accessibilityLabel={`Удалить ${pill.name}`}
              >
                <Text style={styles.deleteButtonText}>Удалить</Text>
              </Pressable>
            </View>
          ))}

          <Pressable style={styles.resetButton} onPress={confirmReset}>
            <Text style={styles.resetButtonText}>Сбросить данные</Text>
          </Pressable>

          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Закрыть</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 24,
    textAlign: 'center',
  },
  sectionLabel: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    marginTop: 20,
    marginBottom: 10,
  },
  input: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.panel,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 22,
    color: colors.text,
    marginBottom: 12,
  },
  saveButton: {
    backgroundColor: colors.blue,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.onButton,
  },
  statusSaved: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.green,
    marginTop: 10,
  },
  statusInvalid: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.amber,
    marginTop: 10,
  },
  emptyText: {
    fontSize: 18,
    color: colors.placeholder,
  },
  pillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.panel,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  pillInfo: {
    flex: 1,
  },
  pillName: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  pillTime: {
    fontSize: 18,
    color: colors.text,
    marginTop: 2,
  },
  deleteButton: {
    borderWidth: 2,
    borderColor: colors.amber,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.amber,
  },
  resetButton: {
    backgroundColor: colors.amber,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  resetButtonText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.onButton,
  },
  closeButton: {
    alignSelf: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginTop: 16,
  },
  closeButtonText: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.blue,
  },
});
