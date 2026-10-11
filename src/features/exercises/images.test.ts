import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, test } from '@jest/globals';

import catalog from '../../../assets/exercises/catalog.json';
import library from '../../../data/exercise-library.json';
import type { MuscleGroup } from '../../data/types';
import { resolveExerciseArt, type ArtCatalog } from './images';

const art: ArtCatalog<string> = {
  lifts: Object.fromEntries(catalog.lifts.map((slug) => [slug, slug])),
  placeholder: 'placeholder',
};

type LibraryRow = {
  slug: string;
  name: string;
  muscle_group: MuscleGroup;
};

const lifts = library as LibraryRow[];
const assetDir = path.join(__dirname, '../../../assets/exercises');
const dedicated = new Set<string>(catalog.lifts);

function webpSize(buffer: Buffer): { width: number; height: number } {
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WEBP') {
    throw new Error('Not a webp');
  }
  const chunk = buffer.toString('ascii', 12, 16);
  if (chunk === 'VP8X') {
    return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
  }
  if (chunk === 'VP8 ') {
    const start = 20;
    const sig = buffer.subarray(start + 3, start + 6);
    if (sig[0] !== 0x9d || sig[1] !== 0x01 || sig[2] !== 0x2a) throw new Error('Bad VP8');
    return {
      width: buffer.readUInt16LE(start + 6) & 0x3fff,
      height: buffer.readUInt16LE(start + 8) & 0x3fff,
    };
  }
  if (chunk === 'VP8L') {
    if (buffer[20] !== 0x2f) throw new Error('Bad VP8L');
    const bits = buffer.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  throw new Error(`Unknown webp chunk ${chunk}`);
}

describe('exercise art', () => {
  test('covers every library lift and leaves custom exercises as monograms', () => {
    expect(lifts).toHaveLength(161);
    expect(catalog.lifts.length).toBeGreaterThanOrEqual(40);
    expect(new Set(catalog.lifts).size).toBe(catalog.lifts.length);
    const known = new Set(lifts.map((lift) => lift.slug));
    for (const slug of catalog.lifts) expect(known.has(slug)).toBe(true);

    for (const lift of lifts) {
      const resolved = resolveExerciseArt(
        { slug: lift.slug, ownerId: null, name: lift.name, muscleGroup: lift.muscle_group },
        art,
      );
      expect(resolved.kind).toBe('image');
      if (resolved.kind !== 'image') continue;
      expect(resolved.source).toBe(dedicated.has(lift.slug) ? lift.slug : 'placeholder');
    }

    expect(
      resolveExerciseArt(
        { slug: null, ownerId: 'user', name: 'Landmine Row', muscleGroup: 'back' },
        art,
      ),
    ).toEqual({ kind: 'monogram', initials: 'LR' });

    expect(
      resolveExerciseArt(
        { slug: 'back-squat', ownerId: 'user', name: 'My Squat', muscleGroup: 'quads' },
        art,
      ),
    ).toEqual({ kind: 'monogram', initials: 'MS' });
  });

  test('a library lift with no dedicated image renders the placeholder, never another lift', () => {
    const bare = lifts.filter((lift) => !dedicated.has(lift.slug));
    expect(bare.length).toBeGreaterThan(0);
    for (const lift of bare) {
      const resolved = resolveExerciseArt(
        { slug: lift.slug, ownerId: null, name: lift.name, muscleGroup: lift.muscle_group },
        art,
      );
      expect(resolved).toEqual({ kind: 'image', source: 'placeholder' });
    }
    const first = resolveExerciseArt(
      { slug: bare[0].slug, ownerId: null, name: bare[0].name, muscleGroup: bare[0].muscle_group },
      art,
    );
    const last = resolveExerciseArt(
      {
        slug: bare[bare.length - 1].slug,
        ownerId: null,
        name: bare[bare.length - 1].name,
        muscleGroup: bare[bare.length - 1].muscle_group,
      },
      art,
    );
    expect(first).toEqual(last);
    expect(dedicated.has('placeholder')).toBe(false);
  });

  test('bundles 384 px webp under 1.5 MB', () => {
    const expected = new Set([...catalog.lifts.map((slug) => `${slug}.webp`), 'placeholder.webp']);
    const onDisk = fs.readdirSync(assetDir).filter((file) => file.endsWith('.webp'));
    expect(new Set(onDisk)).toEqual(expected);
    let total = 0;
    for (const file of onDisk) {
      const buffer = fs.readFileSync(path.join(assetDir, file));
      expect(webpSize(buffer)).toEqual({ width: 384, height: 384 });
      total += buffer.length;
    }
    expect(total).toBeLessThan(1.5 * 1024 * 1024);
  });
});
