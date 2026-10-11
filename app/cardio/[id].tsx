import { useLocalSearchParams } from 'expo-router';

import { CardioDetail } from '../../src/features/cardio/CardioDetail';

export default function CardioDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const sessionId = Array.isArray(id) ? (id[0] ?? '') : (id ?? '');
  return <CardioDetail id={sessionId} />;
}
