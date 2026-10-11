export type Searchable = {
  name: string;
  aliases?: readonly string[];
};

export function normalizeSearch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function compact(value: string): string {
  return value.replace(/ /g, '');
}

/** Higher is a closer match. Zero means no match. */
export function searchScore(item: Searchable, query: string): number {
  const q = normalizeSearch(query);
  if (!q) return 1;
  const qCompact = compact(q);
  const name = normalizeSearch(item.name);
  const nameCompact = compact(name);
  let best = 0;
  if (name === q) best = 100;
  else if (name.startsWith(q) || nameCompact.startsWith(qCompact)) best = 80;
  else if (name.includes(q) || nameCompact.includes(qCompact)) best = 50;

  for (const alias of item.aliases ?? []) {
    const normalized = normalizeSearch(alias);
    const aliasCompact = compact(normalized);
    let score = 0;
    if (normalized === q || aliasCompact === qCompact) score = 95;
    else if (normalized.startsWith(q) || aliasCompact.startsWith(qCompact)) score = 75;
    else if (normalized.includes(q) || aliasCompact.includes(qCompact)) score = 45;
    if (score > best) best = score;
  }
  return best;
}

export function searchExercises<T extends Searchable>(items: readonly T[], query: string): T[] {
  const q = normalizeSearch(query);
  if (!q) return [...items];
  return items
    .map((item, index) => ({ item, index, score: searchScore(item, query) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((row) => row.item);
}
