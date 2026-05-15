/**
 * Remotion Best Practices: Fade Text Animation
 *
 * Demonstrates smooth fade-in/fade-out text animations using Remotion's
 * interpolate and useCurrentFrame hooks. Supports staggered multi-line
 * text reveals and configurable easing curves.
 */

import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  Easing,
  AbsoluteFill,
} from 'remotion';

interface FadeTextProps {
  text: string;
  startFrame?: number;
  durationInFrames?: number;
  fontSize?: number;
  color?: string;
  fadeOutAtEnd?: boolean;
}

/**
 * Single line fade-in (and optionally fade-out) text component.
 */
export const FadeText: React.FC<FadeTextProps> = ({
  text,
  startFrame = 0,
  durationInFrames = 30,
  fontSize = 64,
  color = '#ffffff',
  fadeOutAtEnd = false,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames: totalFrames } = useVideoConfig();

  const fadeInOpacity = interpolate(
    frame,
    [startFrame, startFrame + durationInFrames],
    [0, 1],
    {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
      easing: Easing.out(Easing.cubic),
    }
  );

  const fadeOutOpacity = fadeOutAtEnd
    ? interpolate(
        frame,
        [totalFrames - durationInFrames, totalFrames],
        [1, 0],
        {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.in(Easing.cubic),
        }
      )
    : 1;

  const opacity = Math.min(fadeInOpacity, fadeOutOpacity);

  return (
    <span
      style={{
        fontSize,
        color,
        opacity,
        display: 'inline-block',
        fontFamily: 'Inter, sans-serif',
        fontWeight: 700,
        letterSpacing: '-0.02em',
      }}
    >
      {text}
    </span>
  );
};

interface StaggeredFadeTextProps {
  lines: string[];
  staggerFrames?: number;
  fadeDuration?: number;
  fontSize?: number;
  color?: string;
  lineHeight?: number;
}

/**
 * Staggered multi-line fade-in text component.
 * Each line fades in sequentially with a configurable delay between lines.
 */
export const StaggeredFadeText: React.FC<StaggeredFadeTextProps> = ({
  lines,
  staggerFrames = 10,
  fadeDuration = 20,
  fontSize = 48,
  color = '#ffffff',
  lineHeight = 1.4,
}) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'column',
        gap: fontSize * (lineHeight - 1),
        padding: '0 80px',
      }}
    >
      {lines.map((line, index) => {
        const startFrame = index * staggerFrames;
        const opacity = interpolate(
          frame,
          [startFrame, startFrame + fadeDuration],
          [0, 1],
          {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.out(Easing.quad),
          }
        );

        const translateY = interpolate(
          frame,
          [startFrame, startFrame + fadeDuration],
          [20, 0],
          {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
            easing: Easing.out(Easing.quad),
          }
        );

        return (
          <div
            key={index}
            style={{
              opacity,
              transform: `translateY(${translateY}px)`,
              fontSize,
              color,
              fontFamily: 'Inter, sans-serif',
              fontWeight: 600,
              textAlign: 'center',
              lineHeight,
            }}
          >
            {line}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};
