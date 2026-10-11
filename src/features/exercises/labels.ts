import type { Equipment, MuscleGroup, Track } from '../../data/types';

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  quads: 'Quads',
  hamstrings: 'Hamstrings',
  glutes: 'Glutes',
  calves: 'Calves',
  core: 'Core',
  full_body: 'Full body',
};

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  kettlebell: 'Kettlebell',
  cable: 'Cable',
  machine: 'Machine',
  smith: 'Smith',
  ez_bar: 'EZ bar',
  trap_bar: 'Trap bar',
  band: 'Band',
  bodyweight: 'Bodyweight',
  other: 'Other',
};

export const PICKER_GROUPS: {
  value: string;
  label: string;
  muscles: readonly MuscleGroup[] | null;
}[] = [
  { value: 'all', label: 'All', muscles: null },
  { value: 'chest', label: 'Chest', muscles: ['chest'] },
  { value: 'back', label: 'Back', muscles: ['back'] },
  { value: 'shoulders', label: 'Shoulders', muscles: ['shoulders'] },
  { value: 'arms', label: 'Arms', muscles: ['biceps', 'triceps', 'forearms'] },
  { value: 'legs', label: 'Legs', muscles: ['quads', 'hamstrings', 'glutes', 'calves'] },
  { value: 'core', label: 'Core', muscles: ['core'] },
  { value: 'full_body', label: 'Full body', muscles: ['full_body'] },
];

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2);
  return `${words[0][0]}${words[1][0]}`;
}

export const TRACK_LABELS: Record<Track, string> = {
  weight: 'Weight × reps',
  reps: 'Reps only',
  time: 'Timed',
  'weighted-time': 'Weight × time',
  assisted: 'Assisted',
};
