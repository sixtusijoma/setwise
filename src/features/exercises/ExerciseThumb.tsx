import { Image } from 'react-native';

import { Thumb } from '../../ui';
import { resolveExerciseArt, type ExerciseArtInput } from './images';

const THUMB_CROP = 1.55;

export function ExerciseThumb({
  exercise,
  size = 48,
}: {
  exercise: ExerciseArtInput;
  size?: 48 | 36 | 28;
}) {
  const art = resolveExerciseArt(exercise);
  if (art.kind === 'monogram') return <Thumb size={size} initials={art.initials} />;
  const zoom = size * THUMB_CROP;
  return (
    <Thumb
      size={size}
      icon={
        <Image
          accessible={false}
          source={art.source}
          resizeMode="cover"
          accessibilityIgnoresInvertColors
          style={{ width: zoom, height: zoom }}
        />
      }
    />
  );
}
