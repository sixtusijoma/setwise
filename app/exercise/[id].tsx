import { useLocalSearchParams } from 'expo-router';

import { ExerciseProgress } from '../../src/features/progress/ExerciseProgress';

export default function ExerciseProgressScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const exerciseId = Array.isArray(id) ? id[0] : id;
  return <ExerciseProgress id={exerciseId ?? ''} />;
}
