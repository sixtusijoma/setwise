import type { Cardio, Exercise, Workout } from '../../data/types';
import { timed, type Track } from '../exercises/tracks';
import { formatDayLabel, formatSessionLength } from '../../lib/dates';
import { formatPace, showsPace } from '../../lib/pace';
import {
  distanceUnit,
  formatDistance,
  formatDuration,
  formatVolume,
  formatWeight,
  weightUnit,
  type UnitSystem,
} from '../../lib/units';
import {
  cardioMinutes,
  formatVolumeDelta,
  formatWorkoutDelta,
  type DayMark,
  type WeekDelta,
  type WeekRecord,
  type WeekTotals,
} from '../../lib/week';
import { activityMeta } from '../cardio/activities';
import { workoutSetCount, workoutVolumeKg } from '../history/records';
import { defaultTitle } from '../workout/draft';

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const MARK: Record<DayMark, string> = {
  rest: 'rest',
  strength: 'strength',
  cardio: 'cardio',
  both: 'strength and cardio',
  future: 'upcoming',
};

export type TileCopy = {
  label: string;
  value: string;
  unit?: string;
  delta?: string;
  deltaTone: 'positive' | 'neutral';
};

export function formatTodayOverline(date: Date): string {
  return `${WEEKDAYS[date.getDay()]} · ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

export function dayA11y(date: Date, mark: DayMark, today: boolean): string {
  return `${WEEKDAYS[date.getDay()]}${today ? ', today' : ''}, ${MARK[mark]}`;
}

function tone(positive: boolean): TileCopy['deltaTone'] {
  return positive ? 'positive' : 'neutral';
}

function paceFootnote(totals: WeekTotals, system: UnitSystem): string | undefined {
  if (totals.pacedDistanceM <= 0 || totals.pacedDurationS <= 0) return undefined;
  const pace = formatPace(totals.pacedDistanceM, totals.pacedDurationS);
  if (!pace) return undefined;
  if (system === 'metric') return `avg ${pace.perMile} /mi · ${pace.perKm} /km`;
  return `avg ${pace.perMile} /mi`;
}

export function summaryTiles(
  current: WeekTotals,
  delta: WeekDelta,
  system: UnitSystem,
): TileCopy[] {
  const workouts = formatWorkoutDelta(delta.workouts);
  const volume = formatVolumeDelta(delta.volumePercent, current.volumeKg);
  const sessions =
    current.cardioSessions === 1 ? '1 session' : `${current.cardioSessions} sessions`;
  return [
    {
      label: 'Workouts',
      value: String(current.workouts),
      delta: workouts.text,
      deltaTone: tone(workouts.positive),
    },
    {
      label: 'Volume',
      value: formatVolume(current.volumeKg, system),
      unit: weightUnit(system),
      delta: volume.text,
      deltaTone: tone(volume.positive),
    },
    {
      label: 'Cardio',
      value: String(cardioMinutes(current.cardioSeconds)),
      unit: 'min',
      delta: sessions,
      deltaTone: 'neutral',
    },
    {
      label: 'Distance',
      value: formatDistance(current.distanceM, system),
      unit: distanceUnit(system),
      delta: paceFootnote(current, system),
      deltaTone: 'neutral',
    },
  ];
}

export function recordCopy(
  record: WeekRecord,
  extra: number,
  system: UnitSystem,
  track: Track = 'weight',
): { title: string; body: string } {
  const reps = timed(track) ? formatDuration(record.reps) : `${record.reps}`;
  const load =
    record.weightKg > 0
      ? `${formatWeight(record.weightKg, system)} ${weightUnit(system)} × ${reps}`
      : timed(track)
        ? reps
        : `${record.reps} reps`;
  const more = extra > 0 ? ` · ${extra} more` : '';
  const estimate =
    record.e1rmKg != null && record.weightKg > 0 && !timed(track)
      ? `\nEst. 1RM ${formatWeight(record.e1rmKg, system)} ${weightUnit(system)}`
      : '';
  return {
    title: extra > 0 ? 'New records' : 'New record',
    body: `${record.name} ${load}${more}${estimate}`,
  };
}

export function strengthTitle(workout: Workout): string {
  return workout.title?.trim() || defaultTitle(new Date(workout.startedAt));
}

export function strengthMeta(
  workout: Workout,
  catalog: Map<string, Exercise>,
  system: UnitSystem,
  now: Date,
): string {
  const seconds = Math.max(0, (Date.parse(workout.endedAt) - Date.parse(workout.startedAt)) / 1000);
  const volume = `${formatVolume(workoutVolumeKg(workout, catalog), system)} ${weightUnit(system)}`;
  const sets = workoutSetCount(workout);
  const setLabel = sets === 1 ? '1 set' : `${sets} sets`;
  const day = formatDayLabel(new Date(workout.startedAt), now);
  return `${day} · ${formatSessionLength(seconds)} · ${setLabel} · ${volume}`;
}

export function cardioTitle(session: Cardio): string {
  return activityMeta(session.activity).label;
}

export function cardioMeta(
  session: Cardio,
  system: UnitSystem,
  now: Date,
): { line: string; pace: string | null } {
  const bits = [formatDayLabel(new Date(session.startedAt), now)];
  if (session.distanceM) {
    bits.push(`${formatDistance(session.distanceM, system)} ${distanceUnit(system)}`);
  }
  bits.push(formatDuration(session.durationS));
  const pace =
    session.distanceM && showsPace(session.activity, session.distanceM)
      ? formatPace(session.distanceM, session.durationS)
      : null;
  if (!pace) return { line: bits.join(' · '), pace: null };
  const shown =
    system === 'metric' ? `${pace.perMile} /mi · ${pace.perKm} /km` : `${pace.perMile} /mi`;
  return { line: bits.join(' · '), pace: shown };
}
