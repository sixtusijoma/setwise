import { router, Tabs, usePathname } from 'expo-router';
import { CalendarDays, CircleUser, Sun, TrendingUp, type LucideIcon } from 'lucide-react-native';
import { useEffect, useSyncExternalStore } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { displayTitle, useDraft } from '../../src/features/workout/draft';
import { installTestBridge } from '../../src/features/workout/bridge';
import { useNow } from '../../src/features/workout/useNow';
import { formatDuration } from '../../src/lib/units';
import { fontFamily } from '../../src/theme/fonts';
import { usePrefs } from '../../src/theme/prefs';
import { useTheme } from '../../src/theme/ThemeProvider';
import { ActiveWorkoutBar, Text } from '../../src/ui';

installTestBridge();

const tabs: { name: string; label: string; icon: LucideIcon }[] = [
  { name: 'index', label: 'Today', icon: Sun },
  { name: 'history', label: 'History', icon: CalendarDays },
  { name: 'progress', label: 'Progress', icon: TrendingUp },
  { name: 'profile', label: 'Profile', icon: CircleUser },
];

type TabBarProps = {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit: (event: { type: 'tabPress'; target: string; canPreventDefault: true }) => {
      defaultPrevented: boolean;
    };
    navigate: (name: string) => void;
  };
};

function TabBar({ state, navigation }: TabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const draft = useDraft((store) => store.draft);
  const now = useNow();
  const showBar = Boolean(draft) && pathname !== '/workout/active';
  const elapsed = draft
    ? formatDuration(Math.max(0, (now - Date.parse(draft.startedAt)) / 1000))
    : '0:00';
  return (
    <View style={{ backgroundColor: colors.bg }}>
      {showBar && draft ? (
        <View style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
          <ActiveWorkoutBar
            title={displayTitle(draft)}
            elapsed={elapsed}
            onResume={() => router.push('/workout/active')}
          />
        </View>
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-around',
          backgroundColor: colors.surface,
          borderTopWidth: 1,
          borderTopColor: colors.hairline,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 10),
        }}
      >
        {state.routes.map((route, index) => {
          const item = tabs.find((tab) => tab.name === route.name);
          if (!item) return null;
          const selected = state.index === index;
          const color = selected ? colors.ink : colors.ink3;
          const Icon = item.icon;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={item.label}
              accessibilityState={{ selected }}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!selected && !event.defaultPrevented) navigation.navigate(route.name);
              }}
              style={{
                width: 72,
                alignItems: 'center',
                gap: 3,
                minHeight: 44,
                justifyContent: 'center',
              }}
            >
              <Icon color={color} size={24} strokeWidth={1.9} />
              <Text
                variant="footnote"
                style={{ color, fontFamily: fontFamily.medium, fontSize: 11, lineHeight: 14 }}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function subscribePrefs(onStoreChange: () => void) {
  if (usePrefs.persist.hasHydrated()) return () => undefined;
  return usePrefs.persist.onFinishHydration(onStoreChange);
}

export default function TabsLayout() {
  const hydrated = useSyncExternalStore(
    subscribePrefs,
    () => usePrefs.persist.hasHydrated(),
    () => false,
  );
  const seen = usePrefs((state) => state.tutorialSeen);
  useEffect(() => {
    if (hydrated && !seen) router.push('/tutorial');
  }, [hydrated, seen]);

  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="history" options={{ title: 'History' }} />
      <Tabs.Screen name="progress" options={{ title: 'Progress' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
