/**
 * Text Animations - Slide
 *
 * Reusable slide-in/slide-out text animation components for Remotion.
 * Supports sliding from all four directions with configurable easing and spring physics.
 */

import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

type SlideDirection = 'left' | 'right' | 'up' | 'down';

interface SlideInTextProps {
  text: string;
  direction?: SlideDirection;
  delay?: number;
  durationInFrames?: number;
  fontSize?: number;
  fontWeight?: React.CSSProperties['fontWeight'];
  color?: string;
  damping?: number;
  stiffness?: number;
  mass?: number;
}

/**
 * SlideInText — animates text sliding in from a given direction using spring physics.
 */
export const SlideInText: React.FC<SlideInTextProps> = ({
  text,
  direction = 'left',
  delay = 0,
  fontSize = 64,
  fontWeight = 700,
  color = '#ffffff',
  damping = 14,
  stiffness = 120,
  mass = 1,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({
    frame: frame - delay,
    fps,
    config: { damping, stiffness, mass },
    durationInFrames: 40,
  });

  const offset = interpolate(progress, [0, 1], [120, 0]);

  const translateStyle: React.CSSProperties = {
    transform:
      direction === 'left'
        ? `translateX(${-offset}px)`
        : direction === 'right'
          ? `translateX(${offset}px)`
          : direction === 'up'
            ? `translateY(${-offset}px)`
            : `translateY(${offset}px)`,
    opacity: interpolate(progress, [0, 0.3], [0, 1], {
      extrapolateRight: 'clamp',
    }),
  };

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
      }}
    >
      <span
        style={{
          fontSize,
          fontWeight,
          color,
          fontFamily: 'sans-serif',
          letterSpacing: '-0.02em',
          ...translateStyle,
        }}
      >
        {text}
      </span>
    </AbsoluteFill>
  );
};

interface SlideInWordsProps {
  words: string[];
  direction?: SlideDirection;
  staggerFrames?: number;
  fontSize?: number;
  color?: string;
}

/**
 * SlideInWords — slides each word in sequentially with a configurable stagger.
 */
export const SlideInWords: React.FC<SlideInWordsProps> = ({
  words,
  direction = 'up',
  staggerFrames = 6,
  fontSize = 64,
  color = '#ffffff',
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        gap: 16,
        overflow: 'hidden',
      }}
    >
      {words.map((word, i) => {
        const delay = i * staggerFrames;
        const progress = spring({
          frame: frame - delay,
          fps,
          config: { damping: 16, stiffness: 140, mass: 0.9 },
          durationInFrames: 35,
        });

        const offset = interpolate(progress, [0, 1], [50, 0]);
        const opacity = interpolate(progress, [0, 0.4], [0, 1], {
          extrapolateRight: 'clamp',
        });

        const transform =
          direction === 'up'
            ? `translateY(${offset}px)`
            : direction === 'down'
              ? `translateY(${-offset}px)`
              : direction === 'left'
                ? `translateX(${-offset}px)`
                : `translateX(${offset}px)`;

        return (
          <span
            key={i}
            style={{
              fontSize,
              fontWeight: 700,
              color,
              fontFamily: 'sans-serif',
              transform,
              opacity,
              display: 'inline-block',
            }}
          >
            {word}
          </span>
        );
      })}
    </AbsoluteFill>
  );
};
