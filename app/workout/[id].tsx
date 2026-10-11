import { useLocalSearchParams } from 'expo-router';

import { WorkoutDetail } from '../../src/features/history/WorkoutDetail';

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const workoutId = Array.isArray(id) ? (id[0] ?? '') : (id ?? '');
  return <WorkoutDetail id={workoutId} />;
}
