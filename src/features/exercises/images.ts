import type { ImageSourcePropType } from 'react-native';

import { liftImages, placeholderImage } from '../../../assets/exercises';
import type { MuscleGroup } from '../../data/types';
import { initials } from './labels';

export type ExerciseArtInput = {
  slug: string | null;
  ownerId: string | null;
  name: string;
  muscleGroup: MuscleGroup;
};

export type ArtCatalog<Source = ImageSourcePropType> = {
  lifts: Readonly<Record<string, Source>>;
  placeholder: Source;
};

export type ExerciseArt<Source = ImageSourcePropType> =
  | { kind: 'image'; source: Source }
  | { kind: 'monogram'; initials: string };

const bundled: ArtCatalog = { lifts: liftImages, placeholder: placeholderImage };

export function resolveExerciseArt<Source = ImageSourcePropType>(
  exercise: ExerciseArtInput,
  catalog?: ArtCatalog<Source>,
): ExerciseArt<Source> {
  const chosen = catalog ?? (bundled as ArtCatalog<Source>);
  if (exercise.ownerId == null && exercise.slug != null) {
    const lift = chosen.lifts[exercise.slug];
    if (lift) return { kind: 'image', source: lift };
    return { kind: 'image', source: chosen.placeholder };
  }
  return { kind: 'monogram', initials: initials(exercise.name) };
}
