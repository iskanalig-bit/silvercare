import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AddPillModal } from './AddPillModal';
import { AlarmScreen } from './AlarmScreen';
import { CircleButton } from './CircleButton';
import { MemoryGameModal } from './MemoryGameModal';
import { colors } from './theme';
import { useDoseManager } from './useDoseManager';

const GAP = 8;
const TOP_CIRCLE_MAX = 210;
const BOTTOM_CIRCLE_MAX = 190;
const CIRCLE_MIN = 150;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

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

  const { width } = useWindowDimensions();
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [memoryModalVisible, setMemoryModalVisible] = useState(false);
  const [cluster, setCluster] = useState({ width: 0, height: 0 });

  const onClusterLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    setCluster({ width: w, height: h });
  };

  const callFamily = () => {
    Linking.openURL(`tel:${familyPhone}`).catch(() => {});
  };

  const doseCardText = nextPendingPill
    ? `${nextPendingPill.time} · ${nextPendingPill.name}`
    : 'На сегодня всё принято';

  // Bottom circles: sized from screen width, floored at 150 (never smaller —
  // slight horizontal overlap is preferred over shrinking further).
  const rawBottomFromWidth = (width - 24) / 2;
  let topSize = TOP_CIRCLE_MAX;
  let bottomSize = clamp(rawBottomFromWidth, CIRCLE_MIN, BOTTOM_CIRCLE_MAX);

  // Fit the vertical stack (top circle + gap + bottom row) into the measured
  // cluster height so the screen never needs to scroll.
  if (cluster.height > 0) {
    const availForSizes = Math.max(0, cluster.height - GAP);
    if (topSize + bottomSize > availForSizes) {
      const scale = availForSizes / (topSize + bottomSize);
      topSize *= scale;
      bottomSize *= scale;
      if (bottomSize < CIRCLE_MIN && availForSizes >= CIRCLE_MIN) {
        bottomSize = CIRCLE_MIN;
        topSize = Math.max(0, availForSizes - bottomSize);
      }
    }
  }

  // Bottom row: 8px gap normally; if the two circles don't fit the measured
  // cluster width, overlap them slightly instead of shrinking below 150.
  const clusterWidth = cluster.width || width - 32;
  const idealRowWidth = bottomSize * 2 + GAP;
  const halfGapMargin =
    idealRowWidth > clusterWidth ? (clusterWidth - idealRowWidth) / 2 : GAP / 2;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.root}>
        <Pressable
          onLongPress={triggerDemoAlarm}
          delayLongPress={1200}
          hitSlop={8}
          style={styles.gearButton}
          accessibilityRole="button"
          accessibilityLabel="Настройки"
        >
          <Ionicons name="settings-outline" size={28} color={colors.blue} />
        </Pressable>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Следующий приём</Text>
          <Text style={styles.cardValue}>{doseCardText}</Text>
          <Text style={styles.cardCounter}>
            Сегодня: принято {todayCounts.taken} из {todayCounts.total}
          </Text>
        </View>

        <View style={styles.cluster} onLayout={onClusterLayout}>
          <View style={{ marginBottom: GAP }}>
            <CircleButton
              icon="checkmark-circle-outline"
              label="Принял(а)"
              backgroundColor={colors.green}
              size={topSize}
              onPress={confirmNextPendingDose}
            />
          </View>

          <View style={styles.bottomRow}>
            <View style={{ marginHorizontal: halfGapMargin }}>
              <CircleButton
                icon="bulb-outline"
                label="Память"
                backgroundColor={colors.blue}
                size={bottomSize}
                onPress={() => setMemoryModalVisible(true)}
              />
            </View>
            <View style={{ marginHorizontal: halfGapMargin }}>
              <CircleButton
                icon="call-outline"
                label="Позвонить семье"
                backgroundColor={colors.navy}
                size={bottomSize}
                onPress={callFamily}
              />
            </View>
          </View>
        </View>

        <Pressable
          style={styles.addButton}
          onPress={() => setAddModalVisible(true)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Добавить лекарство"
        >
          <Text style={styles.addButtonText}>+ Добавить лекарство</Text>
        </Pressable>
      </View>

      <AddPillModal
        visible={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
        onSave={(name, time) => {
          addPill(name, time);
          setAddModalVisible(false);
        }}
      />

      <MemoryGameModal
        visible={memoryModalVisible}
        onClose={() => setMemoryModalVisible(false)}
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
  root: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  gearButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  card: {
    backgroundColor: colors.panel,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 18,
    marginBottom: 12,
    maxHeight: 110,
    justifyContent: 'center',
  },
  cardLabel: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 2,
  },
  cardValue: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '700',
    color: colors.text,
  },
  cardCounter: {
    fontSize: 14,
    color: colors.text,
    marginTop: 4,
  },
  cluster: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomRow: {
    flexDirection: 'row',
  },
  addButton: {
    alignSelf: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  addButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.blue,
  },
});
