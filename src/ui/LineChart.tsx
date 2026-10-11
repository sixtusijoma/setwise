import { area, curveMonotoneX, line } from 'd3-shape';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  PanResponder,
  Platform,
  View,
  type GestureResponderEvent,
} from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import { fontFamily } from '../theme/fonts';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

export type ChartDatum = {
  date: string;
  value: number;
  label: string;
};

type Props = {
  points: readonly ChartDatum[];
  accessibilityLabel: string;
  variant?: 'full' | 'spark';
  formatTick?: (value: number) => string;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type Coord = { x: number; y: number };

function niceStep(span: number): number {
  const raw = Math.max(span, 1e-6) / 2;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const residual = raw / magnitude;
  const nice = residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 5 ? 5 : 10;
  return nice * magnitude || 1;
}

function threeTicks(min: number, max: number): [number, number, number] {
  let lo = Math.min(min, max);
  let hi = Math.max(min, max);
  if (!(hi > lo)) {
    const pad = Math.max(Math.abs(hi) * 0.08, 1);
    lo = hi - pad;
    hi += pad;
  }
  let step = niceStep(hi - lo);
  let top = Math.ceil(hi / step) * step;
  let bottom = top - step * 2;
  let guard = 0;
  while (bottom > lo && guard < 8) {
    step *= 2;
    top = Math.ceil(hi / step) * step;
    bottom = top - step * 2;
    guard += 1;
  }
  const clean = (value: number) => {
    const digits = Math.min(4, Math.max(0, -Math.floor(Math.log10(step))));
    const factor = 10 ** digits;
    return Math.round(value * factor) / factor;
  };
  return [clean(bottom), clean(bottom + step), clean(top)];
}

function defaultTick(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1000) return Math.round(value).toLocaleString('en-US');
  if (abs >= 10) return String(Math.round(value));
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function monthTicks(points: readonly ChartDatum[], xs: readonly number[], limit: number) {
  const ticks: { label: string; x: number }[] = [];
  let previous = '';
  const years = new Set<number>();
  for (const point of points) {
    if (!point.date) continue;
    const date = new Date(point.date);
    if (Number.isNaN(date.getTime())) continue;
    years.add(date.getFullYear());
  }
  points.forEach((point, index) => {
    if (!point.date) return;
    const date = new Date(point.date);
    if (Number.isNaN(date.getTime())) return;
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    if (key === previous) return;
    previous = key;
    const month = MONTHS[date.getMonth()] ?? '';
    const label =
      years.size > 1 && (date.getMonth() === 0 || ticks.length === 0)
        ? `${month} '${String(date.getFullYear()).slice(2)}`
        : month;
    ticks.push({ label, x: xs[index] ?? 0 });
  });
  if (ticks.length <= limit) return ticks;
  const step = Math.ceil(ticks.length / limit);
  return ticks.filter((_, index) => index % step === 0);
}

function nearestIndex(x: number, coords: readonly Coord[]): number | null {
  if (coords.length === 0) return null;
  let best = 0;
  let distance = Infinity;
  coords.forEach((point, index) => {
    const delta = Math.abs(point.x - x);
    if (delta < distance) {
      distance = delta;
      best = index;
    }
  });
  return best;
}

export function LineChart({
  points,
  accessibilityLabel,
  variant = 'full',
  formatTick = defaultTick,
}: Props) {
  const { colors, widthClass } = useTheme();
  const spark = variant === 'spark';
  const height = spark ? 24 : widthClass === 'large' ? 220 : 190;
  const [width, setWidth] = useState(spark ? 64 : 0);
  const [active, setActive] = useState<number | null>(null);
  const reduceRef = useRef(false);
  const activeRef = useRef<number | null>(null);
  const hostRef = useRef<View>(null);
  const gradientId = `chart-${useId().replace(/:/g, '')}`;

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) reduceRef.current = enabled;
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      reduceRef.current = enabled;
    });
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  const plotTop = spark ? 3 : 28;
  const plotBottom = spark ? height - 3 : height - 22;
  const plotLeft = spark ? 2 : 2;
  const plotRight = spark ? Math.max(width - 2, plotLeft) : Math.max(width - 52, plotLeft + 1);
  const coords: Coord[] = points.map((point, index) => {
    const x =
      points.length === 1
        ? (plotLeft + plotRight) / 2
        : plotLeft + (index / (points.length - 1)) * (plotRight - plotLeft);
    return { x, y: 0 };
  });
  const values = points.map((point) => point.value).filter((value) => Number.isFinite(value));
  const domain = values.length > 0 ? threeTicks(Math.min(...values), Math.max(...values)) : null;
  const [low = 0, , high = 1] = domain ?? [];
  const span = high - low || 1;
  coords.forEach((coord, index) => {
    const t = ((points[index]?.value ?? low) - low) / span;
    coord.y = plotBottom - Math.min(1, Math.max(0, t)) * (plotBottom - plotTop);
  });

  const coordsRef = useRef(coords);
  const sparkRef = useRef(spark);
  useEffect(() => {
    coordsRef.current = coords;
    sparkRef.current = spark;
  }, [coords, spark]);

  const endScrub = useCallback(() => {
    activeRef.current = null;
    setActive(null);
  }, []);

  const scrub = useCallback((x: number) => {
    const current = coordsRef.current;
    if (sparkRef.current || current.length === 0) return;
    const next = nearestIndex(x, current);
    if (next == null || next === activeRef.current) return;
    activeRef.current = next;
    setActive(next);
    if (Platform.OS !== 'web' && !reduceRef.current) {
      Haptics.selectionAsync().catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    if (spark || Platform.OS !== 'web') return;
    const node = hostRef.current as unknown as HTMLElement | null;
    if (!node || typeof node.addEventListener !== 'function') return;
    node.style.touchAction = 'none';
    const at = (event: PointerEvent) => event.clientX - node.getBoundingClientRect().left;
    const down = (event: PointerEvent) => {
      if (event.button !== 0) return;
      node.setPointerCapture?.(event.pointerId);
      scrub(at(event));
    };
    const move = (event: PointerEvent) => {
      if (event.buttons !== 1) return;
      scrub(at(event));
    };
    node.addEventListener('pointerdown', down);
    node.addEventListener('pointermove', move);
    node.addEventListener('pointerup', endScrub);
    node.addEventListener('pointercancel', endScrub);
    return () => {
      node.removeEventListener('pointerdown', down);
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', endScrub);
      node.removeEventListener('pointercancel', endScrub);
    };
  }, [spark, width, points.length, scrub, endScrub]);

  const pan = useMemo(
    () =>
      // Gesture callbacks run on touch, after render. The ref rule cannot see that.
      // eslint-disable-next-line react-hooks/refs
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event: GestureResponderEvent) => {
          scrub(event.nativeEvent.locationX);
        },
        onPanResponderMove: (event: GestureResponderEvent) => {
          scrub(event.nativeEvent.locationX);
        },
        onPanResponderRelease: endScrub,
        onPanResponderTerminate: endScrub,
      }),
    [scrub, endScrub],
  );

  if (points.length === 0 || width <= 0) {
    return (
      <View
        accessible={!spark && points.length > 0}
        accessibilityRole={spark || points.length === 0 ? undefined : 'image'}
        accessibilityLabel={spark || points.length === 0 ? undefined : accessibilityLabel}
        style={{ height, width: spark ? 64 : undefined }}
        onLayout={(event) => {
          if (!spark) setWidth(event.nativeEvent.layout.width);
        }}
      />
    );
  }

  const curve = line<Coord>()
    .x((point) => point.x)
    .y((point) => point.y)
    .curve(curveMonotoneX);
  const fill = area<Coord>()
    .x((point) => point.x)
    .y0(plotBottom)
    .y1((point) => point.y)
    .curve(curveMonotoneX);
  const linePath = points.length > 1 ? curve(coords) : null;
  const areaPath = points.length > 1 ? fill(coords) : null;
  const months = spark
    ? []
    : monthTicks(
        points,
        coords.map((coord) => coord.x),
        width > 420 ? 6 : 4,
      );
  const grid = !spark && domain ? domain : null;
  const activePoint = active == null ? null : points[active];
  const activeX = active == null ? 0 : (coords[active]?.x ?? 0);
  const tooltipLeft = Math.max(0, Math.min(activeX - 64, Math.max(width - 148, 0)));

  return (
    <View style={{ position: 'relative' }}>
      <View
        ref={hostRef}
        accessible={!spark}
        accessibilityRole={spark ? undefined : 'image'}
        accessibilityLabel={spark ? undefined : accessibilityLabel}
        accessibilityElementsHidden={spark}
        importantForAccessibility={spark ? 'no-hide-descendants' : 'yes'}
        style={{ height, width: spark ? 64 : undefined }}
        onLayout={(event) => {
          const next = event.nativeEvent.layout.width;
          if (next !== width) setWidth(next);
        }}
        {...(spark || Platform.OS === 'web' ? {} : pan.panHandlers)}
      >
        <Svg width={width} height={height} style={{ overflow: 'visible' }}>
          {areaPath && !spark ? (
            <Defs>
              <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.accent} stopOpacity={0.28} />
                <Stop offset="1" stopColor={colors.accent} stopOpacity={0} />
              </LinearGradient>
            </Defs>
          ) : null}
          {grid?.map((tick) => {
            const y = plotBottom - ((tick - low) / span) * (plotBottom - plotTop);
            return (
              <Line
                key={tick}
                x1={plotLeft}
                x2={plotRight}
                y1={y}
                y2={y}
                stroke={colors.hairline}
                strokeWidth={1}
              />
            );
          })}
          {areaPath && !spark ? <Path d={areaPath} fill={`url(#${gradientId})`} /> : null}
          {linePath ? (
            <Path
              d={linePath}
              fill="none"
              stroke={colors.accent}
              strokeWidth={spark ? 1.75 : 2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          {active != null && !spark ? (
            <Line
              x1={activeX}
              x2={activeX}
              y1={plotTop}
              y2={plotBottom}
              stroke={colors.ink3}
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          ) : null}
          {coords.map((coord, index) => {
            const last = index === coords.length - 1;
            const selected = index === active;
            if (spark && !last && points.length > 1) return null;
            const radius = spark ? 2.5 : selected || last ? 5 : 3;
            return (
              <Circle
                key={`${coord.x}-${index}`}
                cx={coord.x}
                cy={coord.y}
                r={radius}
                fill={selected ? colors.bg : colors.accent}
                stroke={selected ? colors.accent : 'none'}
                strokeWidth={selected ? 2 : 0}
              />
            );
          })}
          {grid?.map((tick) => {
            const y = plotBottom - ((tick - low) / span) * (plotBottom - plotTop);
            return (
              <SvgText
                key={`label-${tick}`}
                x={width - 2}
                y={y - 4}
                fill={colors.ink3}
                fontSize={11}
                fontFamily={fontFamily.regular}
                textAnchor="end"
              >
                {formatTick(tick)}
              </SvgText>
            );
          })}
          {months.map((tick, index) => (
            <SvgText
              key={`${tick.label}-${tick.x}`}
              x={tick.x}
              y={height - 4}
              fill={colors.ink3}
              fontSize={11}
              fontFamily={fontFamily.regular}
              textAnchor={index === 0 ? 'start' : index === months.length - 1 ? 'end' : 'middle'}
            >
              {tick.label}
            </SvgText>
          ))}
        </Svg>
      </View>
      {activePoint ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 2,
            left: tooltipLeft,
            backgroundColor: colors.ink,
            borderRadius: 10,
            paddingHorizontal: 10,
            paddingVertical: 4,
          }}
        >
          <Text
            variant="footnote"
            accessibilityLiveRegion="polite"
            style={{ color: colors.bg, fontFamily: fontFamily.semibold }}
          >
            {activePoint.label}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

export function Sparkline({ values }: { values: readonly number[] }) {
  if (values.length === 0) return <View style={{ width: 64, height: 24 }} />;
  return (
    <LineChart
      variant="spark"
      accessibilityLabel=""
      points={values.map((value) => ({ date: '', value, label: '' }))}
    />
  );
}
