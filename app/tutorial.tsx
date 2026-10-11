import { CircleCheck, LayoutList, Play, TrendingUp, type LucideIcon } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { dismiss } from '../src/lib/nav';
import { fontFamily } from '../src/theme/fonts';
import { usePrefs } from '../src/theme/prefs';
import { useTheme } from '../src/theme/ThemeProvider';
import { Button, Screen, Text } from '../src/ui';

const STEPS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Play,
    title: 'Start a workout',
    body: 'Tap Start workout on Today, then add exercises. Minimize it anytime; the bar at the bottom brings you back.',
  },
  {
    icon: CircleCheck,
    title: 'Log your sets',
    body: 'Enter weight and reps, then tap the circle in the DONE column. That marks the set done and starts your rest timer. Set its length in Profile.',
  },
  {
    icon: LayoutList,
    title: 'Reuse with templates',
    body: 'Save any workout as a template from its ⋯ menu, now or later from History. Start the next one from Templates on Today, where built-in Programs live too.',
  },
  {
    icon: TrendingUp,
    title: 'Watch your progress',
    body: 'Progress charts each lift over time, with your best sets and estimated one-rep max.',
  },
];

export default function TutorialScreen() {
  const { colors } = useTheme();
  const [step, setStep] = useState(0);
  const done = () => {
    usePrefs.getState().setTutorialSeen(true);
    dismiss();
  };
  const { icon: Icon, title, body } = STEPS[step];
  const last = step === STEPS.length - 1;

  return (
    <Screen variant="stack" scroll={false}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end', minHeight: 44 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Skip tutorial"
          onPress={done}
          style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}
        >
          <Text variant="body" color="ink2" style={{ fontFamily: fontFamily.semibold }}>
            Skip
          </Text>
        </Pressable>
      </View>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 20 }}>
        <View
          style={{
            width: 120,
            height: 120,
            borderRadius: 32,
            backgroundColor: colors.surface,
            borderWidth: 1,
            borderColor: colors.hairline,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon color={colors.ink} size={52} strokeWidth={1.6} />
        </View>
        <Text variant="title" heading style={{ textAlign: 'center' }}>
          {title}
        </Text>
        <Text variant="body" color="ink2" style={{ textAlign: 'center', maxWidth: 320 }}>
          {body}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
        {STEPS.map((item, index) => (
          <View
            key={item.title}
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: index === step ? colors.accent : colors.hairline,
            }}
          />
        ))}
      </View>
      <Button
        label={last ? 'Get started' : 'Next'}
        onPress={() => (last ? done() : setStep(step + 1))}
      />
    </Screen>
  );
}
