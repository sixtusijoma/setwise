import * as Notifications from 'expo-notifications';

import { usePrefs } from '../../theme/prefs';
import { useDraft } from './draft';

const ID = 'setwise.rest';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Mirrors the draft's rest timer as one local notification while the Profile alert is on. */
export function installRestAlert() {
  useDraft.subscribe(({ draft }, prev) => {
    const endsAt = draft?.restEndsAt ?? 0;
    const prior = prev.draft?.restEndsAt ?? 0;
    if (endsAt === prior || !usePrefs.getState().restAlert) return;
    // Scheduling under the same id replaces the pending alert, so +30s just moves it.
    if (endsAt > Date.now()) {
      void Notifications.scheduleNotificationAsync({
        identifier: ID,
        content: { title: 'Rest is over', body: 'Time for your next set.', sound: true },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: endsAt },
      });
    } else if (prior > Date.now()) {
      void Notifications.cancelScheduledNotificationAsync(ID);
    }
  });
}
