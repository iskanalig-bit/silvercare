import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CircleButton } from './CircleButton';
import { colors } from './theme';

export function MainScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Мои лекарства</Text>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>Следующий приём:</Text>
          <Text style={styles.cardValue}>09:00, Аспирин</Text>
        </View>

        <View style={[styles.circleRow, styles.alignStart]}>
          <CircleButton
            icon="✅"
            label="Принял(а)"
            backgroundColor={colors.green}
            onPress={() => {}}
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
            onPress={() => {}}
          />
        </View>

        <View style={styles.addButton}>
          <Text style={styles.addButtonText}>+ Добавить лекарство</Text>
        </View>

        <Text style={styles.counter}>Сегодня: принято 0 из 0</Text>
      </ScrollView>
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
