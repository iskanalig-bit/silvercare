import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { useEffect, useState } from 'react';
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
import { SettingsModal } from './SettingsModal';
import { colors } from './theme';
import { useDoseManager } from './useDoseManager';

const GAP = 8;
const TOP_CIRCLE_SIZE = 210;
const BOTTOM_CIRCLE_SIZE = 190; // circle minimum — circles never shrink below
// this; on a screen too small to fit them with the normal 8px gap, they
// overlap (negative margin) instead.

// iOS can't present two modals at once: when an alarm starts while another
// modal is open we close that one first and give its dismiss animation this
// long to finish before presenting the alarm.
const MODAL_DISMISS_MS = 400;

export function MainScreen() {
  const {
    pills,
    todayCounts,
    nextPendingPill,
    nextTomorrowPill,
    familyPhone,
    activeAlarm,
    banner,
    addPill,
    deletePill,
    saveFamilyPhone,
    resetAllData,
    confirmDose,
    confirmMainButtonDose,
    triggerDemoAlarm,
  } = useDoseManager();

  const { width } = useWindowDimensions();
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [memoryModalVisible, setMemoryModalVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [cluster, setCluster] = useState({ width: 0, height: 0 });

  const onClusterLayout = (e: LayoutChangeEvent) => {
    const { width: w, height: h } = e.nativeEvent.layout;
    setCluster({ width: w, height: h });
  };

  const hasAlarm = activeAlarm !== null;
  const [alarmReady, setAlarmReady] = useState(false);

  // When an alarm becomes active, close every other modal first and only
  // present the alarm after the dismiss animation has finished. (If nothing
  // was open there's nothing to wait for.)
  useEffect(() => {
    if (!hasAlarm) {
      setAlarmReady(false);
      return;
    }
    const anyOpen = addModalVisible || memoryModalVisible || settingsVisible;
    setAddModalVisible(false);
    setMemoryModalVisible(false);
    setSettingsVisible(false);
    if (!anyOpen) {
      setAlarmReady(true);
      return;
    }
    const timer = setTimeout(() => setAlarmReady(true), MODAL_DISMISS_MS);
    return () => clearTimeout(timer);
    // Only the null → alarm transition matters; the modal flags are read as
    // they were at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasAlarm]);

  // While an alarm is pending/showing, don't let a tap open another modal
  // (it would collide with the alarm's presentation).
  const openModal = (open: () => void) => {
    if (hasAlarm) return;
    open();
  };

  const dialFamily = () => {
    if (familyPhone) Linking.openURL(`tel:${familyPhone}`).catch(() => {});
  };

  const callFamily = () => {
    if (hasAlarm) return;
    if (!familyPhone) {
      setSettingsVisible(true);
      return;
    }
    dialFamily();
  };

  const doseCardText = nextPendingPill
    ? `${nextPendingPill.time} · ${nextPendingPill.name}`
    : nextTomorrowPill
      ? `Завтра ${nextTomorrowPill.time} · ${nextTomorrowPill.name}`
      : 'На сегодня всё принято';

  // Circle diameters are fixed (never shrink below 190/210) — only the
  // spacing between them flexes, overlapping (negative margin) instead of
  // shrinking further when the screen is too small for the normal 8px gap.
  const topSize = TOP_CIRCLE_SIZE;
  const bottomSize = BOTTOM_CIRCLE_SIZE;

  const clusterWidth = cluster.width || width - 32;
  const idealRowWidth = bottomSize * 2 + GAP;
  const halfGapMargin =
    idealRowWidth > clusterWidth ? (clusterWidth - idealRowWidth) / 2 : GAP / 2;

  let verticalGap = GAP;
  if (cluster.height > 0) {
    const idealColumnHeight = topSize + GAP + bottomSize;
    if (idealColumnHeight > cluster.height) {
      verticalGap = GAP - (idealColumnHeight - cluster.height);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.root}>
        <Pressable
          onPress={() => openModal(() => setSettingsVisible(true))}
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
          <Text
            style={styles.cardValue}
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {doseCardText}
          </Text>
          <Text style={styles.cardCounter}>
            Сегодня: принято {todayCounts.taken} из {todayCounts.total}
          </Text>
        </View>

        <View style={styles.cluster} onLayout={onClusterLayout}>
          <View style={{ marginBottom: verticalGap }}>
            <CircleButton
              icon="checkmark-circle-outline"
              label="Принял(а)"
              backgroundColor={colors.green}
              size={topSize}
              onPress={confirmMainButtonDose}
            />
          </View>

          <View style={styles.bottomRow}>
            <View style={{ marginHorizontal: halfGapMargin }}>
              <CircleButton
                icon="bulb-outline"
                label="Память"
                backgroundColor={colors.blue}
                size={bottomSize}
                onPress={() => openModal(() => setMemoryModalVisible(true))}
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
          onPress={() => openModal(() => setAddModalVisible(true))}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Добавить лекарство"
        >
          <Text style={styles.addButtonText}>+ Добавить лекарство</Text>
        </Pressable>
      </View>

      {banner && (
        <View
          pointerEvents="none"
          style={[
            styles.banner,
            banner.tone === 'success' ? styles.bannerSuccess : styles.bannerInfo,
          ]}
        >
          <Text
            style={[
              styles.bannerText,
              banner.tone === 'info' && styles.bannerTextInfo,
            ]}
          >
            {banner.text}
          </Text>
        </View>
      )}

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

      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        familyPhone={familyPhone}
        onSaveFamilyPhone={saveFamilyPhone}
        pills={pills}
        onDeletePill={deletePill}
        onResetData={resetAllData}
      />

      {activeAlarm && alarmReady && (
        <AlarmScreen
          pill={activeAlarm.pill}
          escalated={activeAlarm.escalated}
          familyPhone={familyPhone}
          onConfirm={() => confirmDose(activeAlarm.pill)}
          onCall={dialFamily}
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
    paddingVertical: 8,
    paddingHorizontal: 18,
    marginBottom: 12,
    justifyContent: 'center',
  },
  cardLabel: {
    fontSize: 22,
    lineHeight: 26,
    color: colors.text,
    marginBottom: 0,
  },
  cardValue: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '700',
    color: colors.text,
  },
  cardCounter: {
    fontSize: 22,
    lineHeight: 26,
    color: colors.text,
    marginTop: 2,
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
    fontSize: 22,
    fontWeight: '600',
    color: colors.blue,
  },
  banner: {
    position: 'absolute',
    top: 64,
    left: 16,
    right: 16,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  bannerSuccess: {
    backgroundColor: colors.green,
  },
  bannerInfo: {
    backgroundColor: colors.panel,
  },
  bannerText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.onButton,
    textAlign: 'center',
  },
  bannerTextInfo: {
    color: colors.text,
  },
});
