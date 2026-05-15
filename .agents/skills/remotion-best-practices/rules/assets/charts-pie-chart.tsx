/**
 * Pie Chart Component for Remotion
 *
 * Animates a pie/donut chart with per-slice reveal animations.
 * Each slice fans in sequentially using interpolate and spring.
 */

import React from "react";
import { useCurrentFrame, useVideoConfig, interpolate, spring } from "remotion";

interface PieSlice {
  label: string;
  value: number;
  color: string;
}

interface PieChartProps {
  data: PieSlice[];
  /** Outer radius in px */
  radius?: number;
  /** Inner radius for donut effect (0 = solid pie) */
  innerRadius?: number;
  /** Frame at which the animation begins */
  startFrame?: number;
  /** Frames each slice takes to animate in */
  sliceDuration?: number;
  /** Gap between each slice's animation start */
  sliceStagger?: number;
  showLabels?: boolean;
}

const polarToCartesian = (
  cx: number,
  cy: number,
  r: number,
  angleDeg: number
) => {
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
  const clampedEnd = Math.min(endAngle, startAngle + 359.99);
  const outerStart = polarToCartesian(cx, cy, outerR, clampedEnd);
  const outerEnd = polarToCartesian(cx, cy, outerR, startAngle);
  const innerStart = polarToCartesian(cx, cy, innerR, clampedEnd);
  const innerEnd = polarToCartesian(cx, cy, innerR, startAngle);
  const largeArc = clampedEnd - startAngle > 180 ? 1 : 0;

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 0 ${outerEnd.x} ${outerEnd.y}`,
    innerR > 0
      ? [
          `L ${innerEnd.x} ${innerEnd.y}`,
          `A ${innerR} ${innerR} 0 ${largeArc} 1 ${innerStart.x} ${innerStart.y}`,
          "Z",
        ].join(" ")
      : `L ${cx} ${cy} Z`,
  ].join(" ");
};

export const PieChart: React.FC<PieChartProps> = ({
  data,
  radius = 180,
  innerRadius = 70,
  startFrame = 0,
  sliceDuration = 20,
  sliceStagger = 8,
  showLabels = true,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const total = data.reduce((sum, d) => sum + d.value, 0);
  const cx = radius + 20;
  const cy = radius + 20;
  const size = (radius + 20) * 2;

  let cumulativeAngle = 0;

  return (
    <svg width={size} height={size} style={{ overflow: "visible" }}>
      {data.map((slice, i) => {
        const sliceAngle = (slice.value / total) * 360;
        const sliceStart = cumulativeAngle;
        const sliceEnd = cumulativeAngle + sliceAngle;
        cumulativeAngle += sliceAngle;

        const animStart = startFrame + i * sliceStagger;
        const progress = spring({
          frame: frame - animStart,
          fps,
          config: { damping: 200, stiffness: 80, mass: 0.5 },
          durationInFrames: sliceDuration,
        });

        const animatedEnd = interpolate(progress, [0, 1], [sliceStart, sliceEnd]);
        const midAngle = sliceStart + (sliceEnd - sliceStart) / 2;
        const labelR = (radius + innerRadius) / 2;
        const labelPos = polarToCartesian(cx, cy, labelR, midAngle);

        const labelOpacity = interpolate(progress, [0.6, 1], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });

        const path =
          progress > 0
            ? describeArc(cx, cy, radius, innerRadius, sliceStart, animatedEnd)
            : "";

        return (
          <g key={slice.label}>
            {path && (
              <path
                d={path}
                fill={slice.color}
                stroke="#fff"
                strokeWidth={2}
              />
            )}
            {showLabels && progress > 0.6 && (
              <text
                x={labelPos.x}
                y={labelPos.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#fff"
                fontSize={13}
                fontWeight={700}
                opacity={labelOpacity}
              >
                {Math.round((slice.value / total) * 100)}%
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
};
