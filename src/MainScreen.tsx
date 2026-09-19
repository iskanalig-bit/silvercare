import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddPillModal } from './AddPillModal';
import { AlarmScreen } from './AlarmScreen';
import { CircleButton } from './CircleButton';
import { colors } from './theme';
import { useDoseManager } from './useDoseManager';

export function MainScreen() {
  const {
    todayCounts,
    nextPendingPill,
    familyPhone,
    activeAlarm,
    addPill,
    confirmDose,
    confirmNextPendingDose,
    triggerDemoAlarm,
  } = useDoseManager();

  const [addModalVisible, setAddModalVisible] = useState(false);

  const callFamily = () => {
    Linking.openURL(`tel:${familyPhone}`).catch(() => {});
  };

  const doseCardText = nextPendingPill
    ? `${nextPendingPill.time}, ${nextPendingPill.name}`
    : 'На сегодня всё принято';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onLongPress={triggerDemoAlarm} delayLongPress={1200}>
          <Text style={styles.title}>Мои лекарства</Text>
        </Pressable>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Следующий приём:</Text>
          <Text style={styles.cardValue}>{doseCardText}</Text>
        </View>

        <View style={[styles.circleRow, styles.alignStart]}>
          <CircleButton
            icon="✅"
            label="Принял(а)"
            backgroundColor={colors.green}
            onPress={confirmNextPendingDose}
          />
        </View>

        <View style={[styles.circleRow, styles.alignEnd]}>
          <CircleButton
            icon="🧠"
            label="Память"
            backgroundColor={colors.blue}
            onPress={() => {}}
          />
        </View>

        <View style={[styles.circleRow, styles.alignStart]}>
          <CircleButton
            icon="📞"
            label="Позвонить семье"
            backgroundColor={colors.text}
            onPress={callFamily}
          />
        </View>

        <Pressable
          style={styles.addButton}
          onPress={() => setAddModalVisible(true)}
          accessibilityRole="button"
          accessibilityLabel="Добавить лекарство"
        >
          <Text style={styles.addButtonText}>+ Добавить лекарство</Text>
        </Pressable>

        <Text style={styles.counter}>
          Сегодня: принято {todayCounts.taken} из {todayCounts.total}
        </Text>
      </ScrollView>

      <AddPillModal
        visible={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
        onSave={(name, time) => {
          addPill(name, time);
          setAddModalVisible(false);
        }}
      />

      {activeAlarm && (
        <AlarmScreen
          pill={activeAlarm.pill}
          escalated={activeAlarm.escalated}
          onConfirm={() => confirmDose(activeAlarm.pill)}
          onCall={callFamily}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  card: {
    backgroundColor: colors.panel,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 20,
    marginBottom: 28,
  },
  cardLabel: {
    fontSize: 20,
    color: colors.text,
    marginBottom: 6,
  },
  cardValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  circleRow: {
    marginBottom: 24,
  },
  alignStart: {
    alignItems: 'flex-start',
  },
  alignEnd: {
    alignItems: 'flex-end',
  },
  addButton: {
    alignSelf: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 22,
    marginTop: 8,
  },
  addButtonText: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  counter: {
    fontSize: 18,
    color: colors.text,
    textAlign: 'center',
    marginTop: 20,
  },
});
