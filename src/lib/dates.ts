const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function localDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Monday 00:00 in the local time zone. Sunday belongs to the week that just ended. */
export function startOfIsoWeek(date: Date): Date {
  const start = localDay(date);
  const day = start.getDay();
  const delta = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + delta);
  return start;
}

export function weekKey(date: Date): string {
  const start = startOfIsoWeek(date);
  const month = String(start.getMonth() + 1).padStart(2, '0');
  const day = String(start.getDate()).padStart(2, '0');
  return `${start.getFullYear()}-${month}-${day}`;
}

export function formatWeekTitle(start: Date, now = new Date()): string {
  if (weekKey(start) === weekKey(now)) return 'This week';
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  const left = `${MONTHS[start.getMonth()]} ${start.getDate()}`;
  const sameMonth =
    start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  const right = sameMonth ? String(end.getDate()) : `${MONTHS[end.getMonth()]} ${end.getDate()}`;
  if (start.getFullYear() !== end.getFullYear()) {
    return `${left}, ${start.getFullYear()} – ${MONTHS[end.getMonth()]} ${end.getDate()}, ${end.getFullYear()}`;
  }
  return `${left} – ${right}`;
}

/** Today, Yesterday, or a short weekday. The week heading tells you which week. */
export function formatDayLabel(date: Date, now = new Date()): string {
  const diff = Math.round((localDay(date).getTime() - localDay(now).getTime()) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  return WEEKDAYS[date.getDay()] ?? 'Day';
}

export function formatDateTime(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  const hours = date.getHours();
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const hour12 = hours % 12 || 12;
  const time = `${hour12}:${minutes} ${suffix}`;
  const diff = Math.round((localDay(date).getTime() - localDay(now).getTime()) / 86_400_000);
  const day =
    diff === 0
      ? 'Today'
      : diff === -1
        ? 'Yesterday'
        : `${WEEKDAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
  return `${day}, ${time}`;
}

/** Journal length: "58 min", "1 h 12 min". */
export function formatSessionLength(totalSeconds: number): string {
  const total = Math.max(0, Math.round(totalSeconds));
  let hours = Math.floor(total / 3600);
  let minutes = Math.round((total % 3600) / 60);
  if (minutes === 60) {
    hours += 1;
    minutes = 0;
  }
  if (hours === 0 && minutes === 0) return total > 0 ? '1 min' : '0 min';
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}
