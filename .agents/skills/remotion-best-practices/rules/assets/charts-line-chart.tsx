/**
 * Line Chart Component for Remotion
 *
 * Animated line chart that draws itself over time using SVG path animations.
 * Supports multiple data series, customizable colors, and smooth interpolation.
 *
 * Usage:
 *   <LineChart
 *     data={[{ label: 'Jan', value: 30 }, { label: 'Feb', value: 55 }]}
 *     width={600}
 *     height={350}
 *     color="#4f46e5"
 *     durationInFrames={60}
 *   />
 */

import React, { useMemo } from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';

interface DataPoint {
  label: string;
  value: number;
}

interface LineChartProps {
  data: DataPoint[];
  width?: number;
  height?: number;
  color?: string;
  fillColor?: string;
  strokeWidth?: number;
  durationInFrames?: number;
  showDots?: boolean;
  showGrid?: boolean;
  showLabels?: boolean;
  paddingX?: number;
  paddingY?: number;
}

export const LineChart: React.FC<LineChartProps> = ({
  data,
  width = 600,
  height = 350,
  color = '#4f46e5',
  fillColor = 'rgba(79, 70, 229, 0.15)',
  strokeWidth = 3,
  durationInFrames = 60,
  showDots = true,
  showGrid = true,
  showLabels = true,
  paddingX = 48,
  paddingY = 32,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Animate the line drawing progress from 0 to 1
  const drawProgress = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  // Fade in labels after the line finishes drawing
  const labelOpacity = interpolate(
    frame,
    [durationInFrames * 0.7, durationInFrames],
    [0, 1],
    { extrapolateRight: 'clamp' }
  );

  const chartWidth = width - paddingX * 2;
  const chartHeight = height - paddingY * 2;

  const maxValue = useMemo(() => Math.max(...data.map((d) => d.value), 0), [data]);
  const minValue = useMemo(() => Math.min(...data.map((d) => d.value), 0), [data]);
  const valueRange = maxValue - minValue || 1;

  // Map data points to SVG coordinates
  const points = useMemo(
    () =>
      data.map((d, i) => ({
        x: paddingX + (i / (data.length - 1)) * chartWidth,
        y: paddingY + chartHeight - ((d.value - minValue) / valueRange) * chartHeight,
        label: d.label,
        value: d.value,
      })),
    [data, chartWidth, chartHeight, paddingX, paddingY, minValue, valueRange]
  );

  // Build SVG polyline points string
  const polylinePoints = points.map((p) => `${p.x},${p.y}`).join(' ');

  // Build closed fill area path
  const fillPath = [
    `M ${points[0].x},${paddingY + chartHeight}`,
    ...points.map((p) => `L ${p.x},${p.y}`),
    `L ${points[points.length - 1].x},${paddingY + chartHeight}`,
    'Z',
  ].join(' ');

  // Grid line Y positions (4 horizontal lines)
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
    y: paddingY + chartHeight * (1 - t),
    label: Math.round(minValue + valueRange * t),
  }));

  // SVG stroke-dasharray trick to animate line drawing
  // We approximate total path length via point distances
  const totalLength = useMemo(() => {
    let len = 0;
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      len += Math.sqrt(dx * dx + dy * dy);
    }
    return len;
  }, [points]);

  const dashOffset = totalLength * (1 - drawProgress);

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      {/* Grid lines */}
      {showGrid &&
        gridLines.map((gl, i) => (
          <g key={i}>
            <line
              x1={paddingX}
              y1={gl.y}
              x2={paddingX + chartWidth}
              y2={gl.y}
              stroke="rgba(255,255,255,0.12)"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <text
              x={paddingX - 8}
              y={gl.y + 4}
              textAnchor="end"
              fill="rgba(255,255,255,0.45)"
              fontSize={11}
              fontFamily="Inter, sans-serif"
            >
              {gl.label}
            </text>
          </g>
        ))}

      {/* Fill area beneath the line */}
      <path d={fillPath} fill={fillColor} opacity={drawProgress} />

      {/* Animated line */}
      <polyline
        points={polylinePoints}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={totalLength}
        strokeDashoffset={dashOffset}
      />

      {/* Data point dots */}
      {showDots &&
        points.map((p, i) => {
          const dotProgress = interpolate(
            frame,
            [durationInFrames * (i / points.length), durationInFrames * (i / points.length) + 8],
            [0, 1],
            { extrapolateRight: 'clamp', easing: Easing.out(Easing.back(2)) }
          );
          return (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={5 * dotProgress}
              fill="white"
              stroke={color}
              strokeWidth={2}
            />
          );
        })}

      {/* X-axis labels */}
      {showLabels &&
        points.map((p, i) => (
          <text
            key={i}
            x={p.x}
            y={paddingY + chartHeight + 20}
            textAnchor="middle"
            fill="rgba(255,255,255,0.6)"
            fontSize={12}
            fontFamily="Inter, sans-serif"
            opacity={labelOpacity}
          >
            {p.label}
          </text>
        ))}
    </svg>
  );
};
