import {
  Activity,
  Bike,
  ChevronsUp,
  Footprints,
  HeartPulse,
  Mountain,
  Sailboat,
  Waves,
  type LucideIcon,
} from 'lucide-react-native';

import type { CardioActivity } from '../../data/types';

export const ACTIVITIES: { id: CardioActivity; label: string; icon: LucideIcon }[] = [
  { id: 'run', label: 'Run', icon: Footprints },
  { id: 'walk', label: 'Walk', icon: Footprints },
  { id: 'hike', label: 'Hike', icon: Mountain },
  { id: 'cycle', label: 'Cycle', icon: Bike },
  { id: 'row', label: 'Row', icon: Sailboat },
  { id: 'elliptical', label: 'Elliptical', icon: Activity },
  { id: 'stairs', label: 'Stairs', icon: ChevronsUp },
  { id: 'swim', label: 'Swim', icon: Waves },
  { id: 'other', label: 'Other', icon: HeartPulse },
];

export function activityMeta(id: CardioActivity) {
  return ACTIVITIES.find((item) => item.id === id) ?? ACTIVITIES[ACTIVITIES.length - 1]!;
}
