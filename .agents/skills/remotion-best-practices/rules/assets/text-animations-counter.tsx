/**
 * Remotion Best Practices: Animated Counter Component
 *
 * Demonstrates smooth number counting animations using Remotion's
 * interpolate and useCurrentFrame hooks with spring physics.
 */

import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
} from 'remotion';

interface AnimatedCounterProps {
  /** The starting value of the counter */
  from?: number;
  /** The ending value of the counter */
  to: number;
  /** Frame at which the animation starts */
  delay?: number;
  /** Duration of the animation in frames */
  duration?: number;
  /** Optional prefix (e.g. '$', '€') */
  prefix?: string;
  /** Optional suffix (e.g. '%', 'K') */
  suffix?: string;
  /** Number of decimal places to display */
  decimals?: number;
  /** Font size in pixels */
  fontSize?: number;
  /** Text color */
  color?: string;
  /** Use spring physics instead of linear easing */
  useSpring?: boolean;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  from = 0,
  to,
  delay = 0,
  duration = 60,
  prefix = '',
  suffix = '',
  decimals = 0,
  fontSize = 80,
  color = '#ffffff',
  useSpring = false,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Calculate progress using either spring or interpolation
  const progress = useSpring
    ? spring({
        frame: frame - delay,
        fps,
        config: {
          damping: 12,
          stiffness: 80,
          mass: 1,
        },
        durationInFrames: duration,
      })
    : interpolate(
        frame,
        [delay, delay + duration],
        [0, 1],
        {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.out(Easing.cubic),
        }
      );

  const currentValue = from + (to - from) * progress;

  // Format the number with locale-aware separators
  const formattedValue = currentValue.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  // Fade in at the start
  const opacity = interpolate(frame, [delay, delay + 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <div
      style={{
        fontFamily: 'Inter, sans-serif',
        fontSize,
        fontWeight: 700,
        color,
        opacity,
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '-0.02em',
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'baseline',
        gap: 4,
      }}
    >
      {prefix && (
        <span style={{ fontSize: fontSize * 0.6, opacity: 0.8 }}>{prefix}</span>
      )}
      <span>{formattedValue}</span>
      {suffix && (
        <span style={{ fontSize: fontSize * 0.6, opacity: 0.8 }}>{suffix}</span>
      )}
    </div>
  );
};

// Example composition demonstrating the counter
export const CounterExample: React.FC = () => {
  return (
    <div
      style={{
        background: '#0f0f0f',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 48,
      }}
    >
      <AnimatedCounter to={1000000} prefix="$" suffix="+" duration={90} useSpring />
      <AnimatedCounter to={98.6} suffix="%" decimals={1} delay={20} duration={75} color="#4ade80" />
      <AnimatedCounter from={500} to={0} suffix=" ms" delay={40} duration={60} color="#f87171" />
    </div>
  );
};
