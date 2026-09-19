import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from './theme';

type ShapeKind = 'circle' | 'square' | 'triangle' | 'diamond';

type ShapeDef = { id: number; color: string; kind: ShapeKind; label: string };

const SHAPES: ShapeDef[] = [
  { id: 0, color: colors.green, kind: 'circle', label: 'круг' },
  { id: 1, color: colors.blue, kind: 'square', label: 'квадрат' },
  { id: 2, color: colors.amber, kind: 'triangle', label: 'треугольник' },
  { id: 3, color: colors.text, kind: 'diamond', label: 'ромб' },
];

const SHOW_MS = 600;
const GAP_MS = 350;

function randomSequence(): number[] {
  const length = Math.random() < 0.5 ? 3 : 4;
  return Array.from({ length }, () => Math.floor(Math.random() * SHAPES.length));
}

function Shape({ kind, color, size = 72 }: { kind: ShapeKind; color: string; size?: number }) {
  if (kind === 'circle') {
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    );
  }
  if (kind === 'square') {
    return <View style={{ width: size, height: size, borderRadius: 10, backgroundColor: color }} />;
  }
  if (kind === 'triangle') {
    const half = size / 2;
    return (
      <View
        style={{
          width: 0,
          height: 0,
          borderLeftWidth: half,
          borderRightWidth: half,
          borderBottomWidth: size,
          borderLeftColor: 'transparent',
          borderRightColor: 'transparent',
          borderBottomColor: color,
        }}
      />
    );
  }
  const side = size * 0.72;
  return (
    <View
      style={{
        width: side,
        height: side,
        backgroundColor: color,
        borderRadius: 8,
        transform: [{ rotate: '45deg' }],
      }}
    />
  );
}

type MemoryGameModalProps = {
  visible: boolean;
  onClose: () => void;
};

export function MemoryGameModal({ visible, onClose }: MemoryGameModalProps) {
  const [sequence, setSequence] = useState<number[]>([]);
  const [phase, setPhase] = useState<'showing' | 'input' | 'success'>('showing');
  const [step, setStep] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const startRound = () => {
    clearTimers();
    const seq = randomSequence();
    setSequence(seq);
    setStep(0);
    setPhase('showing');
    setActiveIndex(null);
    seq.forEach((shapeIndex, i) => {
      const onAt = i * (SHOW_MS + GAP_MS);
      timers.current.push(setTimeout(() => setActiveIndex(shapeIndex), onAt));
      timers.current.push(setTimeout(() => setActiveIndex(null), onAt + SHOW_MS));
    });
    const totalTime = seq.length * (SHOW_MS + GAP_MS);
    timers.current.push(setTimeout(() => setPhase('input'), totalTime + 200));
  };

  useEffect(() => {
    if (visible) startRound();
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleTilePress = (index: number) => {
    if (phase !== 'input') return;
    if (index !== sequence[step]) return; // wrong tap: quietly ignored, no failure state
    setActiveIndex(index);
    timers.current.push(setTimeout(() => setActiveIndex(null), 300));
    if (step + 1 === sequence.length) {
      setPhase('success');
    } else {
      setStep(step + 1);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <Text style={styles.title}>Память</Text>
          <Text style={styles.instructions}>
            {phase === 'showing' && 'Запоминайте порядок фигур…'}
            {phase === 'input' && 'Теперь повторите тот же порядок'}
            {phase === 'success' && 'Отлично! Вы всё вспомнили верно 🎉'}
          </Text>

          <View style={styles.grid}>
            {SHAPES.map((shape, index) => (
              <Pressable
                key={shape.id}
                onPress={() => handleTilePress(index)}
                accessibilityRole="button"
                accessibilityLabel={shape.label}
                style={({ pressed }) => [
                  styles.tile,
                  activeIndex === index && styles.tileActive,
                  pressed && styles.tilePressed,
                ]}
              >
                <Shape kind={shape.kind} color={shape.color} />
              </Pressable>
            ))}
          </View>

          {phase === 'success' && (
            <Pressable style={styles.playAgainButton} onPress={startRound}>
              <Text style={styles.playAgainText}>Играть ещё раз</Text>
            </Pressable>
          )}

          <Pressable style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Закрыть</Text>
          </Pressable>
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
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 12,
  },
  instructions: {
    fontSize: 22,
    color: colors.text,
    textAlign: 'center',
    marginBottom: 28,
    minHeight: 60,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 292,
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  tile: {
    width: 130,
    height: 130,
    borderRadius: 18,
    backgroundColor: colors.panel,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  tileActive: {
    borderColor: colors.text,
    borderWidth: 4,
  },
  tilePressed: {
    opacity: 0.8,
  },
  playAgainButton: {
    backgroundColor: colors.green,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 28,
    marginBottom: 16,
  },
  playAgainText: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.onButton,
  },
  closeButton: {
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  closeButtonText: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
});
