import { describe, expect, test } from '@jest/globals';

import { countWaiting, syncLabel } from './useSyncStatus';

describe('sync status', () => {
  test('labels a quiet cache and a waiting queue', () => {
    expect(syncLabel(0)).toBe('All changes saved');
    expect(syncLabel(1)).toBe('1 waiting');
    expect(syncLabel(3)).toBe('3 waiting');
  });

  test('counts paused and in-flight mutations', () => {
    expect(
      countWaiting([
        { status: 'success' },
        { status: 'pending' },
        { status: 'idle', isPaused: true },
        { status: 'error' },
      ]),
    ).toBe(2);
  });
});
