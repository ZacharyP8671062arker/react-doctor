/**
 * Remotion Donut Chart Component
 * Animated donut/ring chart with configurable segments, labels, and center content.
 * Follows remotion-best-practices for deterministic, frame-based animations.
 */

import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from "remotion";

interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  /** Outer radius in px */
  radius?: number;
  /** Thickness of the ring as a fraction of radius (0–1) */
  thickness?: number;
  /** Frame at which animation starts */
  startFrame?: number;
  /** Duration of the draw animation in frames */
  durationFrames?: number;
  /** Text displayed in the center of the donut */
  centerLabel?: string;
  /** Sub-text displayed below centerLabel */
  centerSubLabel?: string;
  showLegend?: boolean;
}

const polarToCartesian = (
  cx: number,
  cy: number,
  r: number,
  angleDeg: number
): { x: number; y: number } => {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

const describeArc = (
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number
): string => {
  // Clamp to avoid full-circle SVG path bugs
  const clampedEnd = Math.min(endAngle, startAngle + 359.999);
  const o1 = polarToCartesian(cx, cy, outerR, startAngle);
  const o2 = polarToCartesian(cx, cy, outerR, clampedEnd);
  const i1 = polarToCartesian(cx, cy, innerR, clampedEnd);
  const i2 = polarToCartesian(cx, cy, innerR, startAngle);
  const largeArc = clampedEnd - startAngle > 180 ? 1 : 0;
  return [
    `M ${o1.x} ${o1.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${o2.x} ${o2.y}`,
    `L ${i1.x} ${i1.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${i2.x} ${i2.y}`,
    "Z",
  ].join(" ");
};

export const DonutChart: React.FC<DonutChartProps> = ({
  segments,
  radius = 160,
  thickness = 0.38,
  startFrame = 0,
  durationFrames = 45,
  centerLabel,
  centerSubLabel,
  showLegend = true,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const progress = interpolate(
    frame,
    [startFrame, startFrame + durationFrames],
    [0, 1],
    { clamp: true, easing: Easing.out(Easing.cubic) }
  );

  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const innerRadius = radius * (1 - thickness);
  const cx = width / 2;
  const cy = height / 2;

  let currentAngle = 0;

  return (
    <div style={{ width, height, position: "relative", fontFamily: "sans-serif" }}>
      <svg width={width} height={height}>
        {segments.map((seg, i) => {
          const segAngle = (seg.value / total) * 360;
          const drawAngle = segAngle * progress;
          const path = describeArc(cx, cy, radius, innerRadius, currentAngle, currentAngle + drawAngle);
          const slice = (
            <path
              key={i}
              d={path}
              fill={seg.color}
              opacity={0.92}
            />
          );
          currentAngle += segAngle;
          return slice;
        })}

        {/* Center text */}
        {centerLabel && (
          <>
            <text
              x={cx}
              y={cy - (centerSubLabel ? 14 : 0)}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={radius * 0.28}
              fontWeight="700"
              fill="#1a1a2e"
              opacity={progress}
            >
              {centerLabel}
            </text>
            {centerSubLabel && (
              <text
                x={cx}
                y={cy + radius * 0.18}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={radius * 0.13}
                fill="#555"
                opacity={progress}
              >
                {centerSubLabel}
              </text>
            )}
          </>
        )}
      </svg>

      {/* Legend */}
      {showLegend && (
        <div
          style={{
            position: "absolute",
            bottom: 32,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: 24,
            opacity: progress,
          }}
        >
          {segments.map((seg, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 3,
                  backgroundColor: seg.color,
                }}
              />
              <span style={{ fontSize: 16, color: "#333" }}>
                {seg.label} ({((seg.value / total) * 100).toFixed(1)}%)
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
