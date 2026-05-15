/**
 * Gauge Chart Component for Remotion
 *
 * Renders an animated semi-circular gauge chart that fills from 0 to a target
 * value over the course of the animation. Useful for displaying percentages,
 * scores, or any bounded metric.
 *
 * Usage:
 *   <GaugeChart value={75} label="Performance" color="#4F46E5" />
 */

import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";

interface GaugeChartProps {
  /** Target value (0–max) */
  value: number;
  /** Maximum value of the gauge (default: 100) */
  max?: number;
  /** Label displayed below the gauge needle value */
  label?: string;
  /** Primary fill color of the arc */
  color?: string;
  /** Background arc color */
  trackColor?: string;
  /** Stroke width of the arcs */
  strokeWidth?: number;
  /** Frame at which the animation starts */
  startFrame?: number;
  /** Duration of the fill animation in frames */
  durationFrames?: number;
}

/** Converts polar coordinates to SVG cartesian x/y */
function polarToCartesian(
  cx: number,
  cy: number,
  r: number,
  angleDeg: number
): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
}

/** Builds an SVG arc path for a semi-circle gauge (180° sweep) */
function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number
): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle > 180 ? 1 : 0;
  return [
    `M ${start.x} ${start.y}`,
    `A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`,
  ].join(" ");
}

export const GaugeChart: React.FC<GaugeChartProps> = ({
  value,
  max = 100,
  label = "",
  color = "#4F46E5",
  trackColor = "#E5E7EB",
  strokeWidth = 18,
  startFrame = 0,
  durationFrames = 60,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // Animate value from 0 → target over durationFrames
  const animatedValue = interpolate(
    frame,
    [startFrame, startFrame + durationFrames],
    [0, value],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.out(Easing.cubic),
    }
  );

  // Gauge spans from 180° (left) to 0° (right) — a 180° semi-circle
  const GAUGE_START = 180;
  const GAUGE_END = 0;
  const totalAngle = 180; // degrees

  const cx = width / 2;
  const cy = height * 0.58;
  const radius = Math.min(width, height) * 0.32;

  // Sweep angle for the filled portion
  const fillAngle = (animatedValue / max) * totalAngle;
  const fillEndAngle = GAUGE_START - fillAngle;

  // Track arc (full semi-circle)
  const trackPath = describeArc(cx, cy, radius, GAUGE_END, GAUGE_START);
  // Fill arc (animated portion)
  const fillPath =
    fillAngle > 0
      ? describeArc(cx, cy, radius, fillEndAngle, GAUGE_START)
      : "";

  // Needle angle: starts at -90° (left) and rotates clockwise
  const needleRotation = -90 + fillAngle;
  const needleLength = radius * 0.85;
  const needleTip = polarToCartesian(cx, cy, needleLength, needleRotation + 90);

  // Fade-in the entire chart
  const opacity = interpolate(frame, [startFrame, startFrame + 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const displayValue = Math.round(animatedValue);

  return (
    <svg
      width={width}
      height={height}
      style={{ opacity, position: "absolute", top: 0, left: 0 }}
    >
      {/* Track arc */}
      <path
        d={trackPath}
        fill="none"
        stroke={trackColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />

      {/* Filled arc */}
      {fillPath && (
        <path
          d={fillPath}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      )}

      {/* Needle */}
      <line
        x1={cx}
        y1={cy}
        x2={needleTip.x}
        y2={needleTip.y}
        stroke="#1F2937"
        strokeWidth={4}
        strokeLinecap="round"
      />
      <circle cx={cx} cy={cy} r={10} fill="#1F2937" />

      {/* Numeric value */}
      <text
        x={cx}
        y={cy - radius * 0.25}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={radius * 0.28}
        fontWeight="700"
        fill="#111827"
        fontFamily="Inter, sans-serif"
      >
        {displayValue}
      </text>

      {/* Label */}
      {label && (
        <text
          x={cx}
          y={cy + radius * 0.15}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={radius * 0.13}
          fill="#6B7280"
          fontFamily="Inter, sans-serif"
        >
          {label}
        </text>
      )}

      {/* Min / Max labels */}
      <text
        x={cx - radius - strokeWidth}
        y={cy + 20}
        textAnchor="middle"
        fontSize={radius * 0.1}
        fill="#9CA3AF"
        fontFamily="Inter, sans-serif"
      >
        0
      </text>
      <text
        x={cx + radius + strokeWidth}
        y={cy + 20}
        textAnchor="middle"
        fontSize={radius * 0.1}
        fill="#9CA3AF"
        fontFamily="Inter, sans-serif"
      >
        {max}
      </text>
    </svg>
  );
};
