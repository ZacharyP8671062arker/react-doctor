/**
 * Area Chart component for Remotion animations.
 * Renders an animated area/filled line chart with smooth interpolation.
 *
 * Usage:
 *   <AreaChart
 *     data={[{ label: 'Jan', value: 120 }, ...]}
 *     width={800}
 *     height={400}
 *     color="#6366f1"
 *     fillOpacity={0.3}
 *     durationInFrames={60}
 *   />
 */

import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';

interface DataPoint {
  label: string;
  value: number;
}

interface AreaChartProps {
  data: DataPoint[];
  width?: number;
  height?: number;
  color?: string;
  fillOpacity?: number;
  strokeWidth?: number;
  durationInFrames?: number;
  showDots?: boolean;
  showGrid?: boolean;
  paddingX?: number;
  paddingY?: number;
}

export const AreaChart: React.FC<AreaChartProps> = ({
  data,
  width = 800,
  height = 400,
  color = '#6366f1',
  fillOpacity = 0.25,
  strokeWidth = 3,
  durationInFrames = 60,
  showDots = true,
  showGrid = true,
  paddingX = 60,
  paddingY = 40,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const minValue = Math.min(...data.map((d) => d.value));
  const maxValue = Math.max(...data.map((d) => d.value));
  const valueRange = maxValue - minValue || 1;

  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;

  // Animate draw progress from 0 to 1
  const progress = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  const getX = (index: number) =>
    paddingX + (index / (data.length - 1)) * chartWidth;

  const getY = (value: number) =>
    paddingY + chartHeight - ((value - minValue) / valueRange) * chartHeight;

  // Build SVG path for the line, clipped by progress
  const visibleCount = Math.max(2, Math.ceil(progress * (data.length - 1)) + 1);
  const visibleData = data.slice(0, visibleCount);

  // Interpolate the last point position based on sub-step progress
  const lastIndex = visibleCount - 1;
  const subProgress =
    progress * (data.length - 1) - Math.floor(progress * (data.length - 1));

  const points = visibleData.map((d, i) => {
    if (i === lastIndex && lastIndex < data.length - 1 && subProgress > 0) {
      const nextD = data[lastIndex];
      const currD = data[lastIndex - 1] ?? d;
      const interpValue = interpolate(subProgress, [0, 1], [currD.value, nextD.value]);
      return { x: getX(i - 1 + subProgress), y: getY(interpValue) };
    }
    return { x: getX(i), y: getY(d.value) };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(' ');

  const areaPath =
    linePath +
    ` L ${points[points.length - 1].x.toFixed(2)},${(paddingY + chartHeight).toFixed(2)}` +
    ` L ${points[0].x.toFixed(2)},${(paddingY + chartHeight).toFixed(2)} Z`;

  const gridLines = 4;

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      {/* Grid lines */}
      {showGrid &&
        Array.from({ length: gridLines + 1 }).map((_, i) => {
          const y = paddingY + (i / gridLines) * chartHeight;
          const val = maxValue - (i / gridLines) * valueRange;
          return (
            <g key={i}>
              <line
                x1={paddingX}
                y1={y}
                x2={paddingX + chartWidth}
                y2={y}
                stroke="rgba(255,255,255,0.1)"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <text
                x={paddingX - 8}
                y={y + 4}
                textAnchor="end"
                fontSize={12}
                fill="rgba(255,255,255,0.5)"
              >
                {Math.round(val)}
              </text>
            </g>
          );
        })}

      {/* X-axis labels */}
      {data.map((d, i) => (
        <text
          key={i}
          x={getX(i)}
          y={paddingY + chartHeight + 20}
          textAnchor="middle"
          fontSize={12}
          fill="rgba(255,255,255,0.5)"
        >
          {d.label}
        </text>
      ))}

      {/* Filled area */}
      <path d={areaPath} fill={color} fillOpacity={fillOpacity} />

      {/* Line stroke */}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Data dots */}
      {showDots &&
        points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={4}
            fill={color}
            stroke="white"
            strokeWidth={1.5}
          />
        ))}
    </svg>
  );
};
