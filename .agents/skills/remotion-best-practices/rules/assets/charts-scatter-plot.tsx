/**
 * Scatter Plot Chart Component for Remotion
 *
 * Animated scatter plot with entrance animations per data point,
 * optional trend line, and axis labels.
 *
 * Usage:
 *   <ScatterPlot
 *     data={[{ x: 10, y: 20, label: 'A' }, ...]}
 *     width={800}
 *     height={500}
 *     startFrame={0}
 *     durationInFrames={60}
 *   />
 */

import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';

interface DataPoint {
  x: number;
  y: number;
  label?: string;
  color?: string;
}

interface ScatterPlotProps {
  data: DataPoint[];
  width?: number;
  height?: number;
  startFrame?: number;
  durationInFrames?: number;
  xLabel?: string;
  yLabel?: string;
  showTrendLine?: boolean;
  dotRadius?: number;
  accentColor?: string;
  backgroundColor?: string;
  axisColor?: string;
  labelColor?: string;
  fontFamily?: string;
  padding?: { top: number; right: number; bottom: number; left: number };
}

const DEFAULT_PADDING = { top: 24, right: 24, bottom: 48, left: 56 };

function computeTrendLine(data: DataPoint[]): { x1: number; y1: number; x2: number; y2: number } | null {
  const n = data.length;
  if (n < 2) return null;
  const sumX = data.reduce((s, d) => s + d.x, 0);
  const sumY = data.reduce((s, d) => s + d.y, 0);
  const sumXY = data.reduce((s, d) => s + d.x * d.y, 0);
  const sumX2 = data.reduce((s, d) => s + d.x * d.x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  const xMin = Math.min(...data.map((d) => d.x));
  const xMax = Math.max(...data.map((d) => d.x));
  return { x1: xMin, y1: slope * xMin + intercept, x2: xMax, y2: slope * xMax + intercept };
}

export const ScatterPlot: React.FC<ScatterPlotProps> = ({
  data,
  width = 800,
  height = 500,
  startFrame = 0,
  durationInFrames = 60,
  xLabel = 'X Axis',
  yLabel = 'Y Axis',
  showTrendLine = true,
  dotRadius = 8,
  accentColor = '#6366f1',
  backgroundColor = '#0f172a',
  axisColor = '#334155',
  labelColor = '#94a3b8',
  fontFamily = 'Inter, sans-serif',
  padding = DEFAULT_PADDING,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;

  const xValues = data.map((d) => d.x);
  const yValues = data.map((d) => d.y);
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const yMin = Math.min(...yValues);
  const yMax = Math.max(...yValues);
  const xRange = xMax - xMin || 1;
  const yRange = yMax - yMin || 1;

  const toSvgX = (x: number) => padding.left + ((x - xMin) / xRange) * plotWidth;
  const toSvgY = (y: number) => padding.top + plotHeight - ((y - yMin) / yRange) * plotHeight;

  const trendLine = showTrendLine ? computeTrendLine(data) : null;
  const trendProgress = interpolate(frame, [startFrame, startFrame + durationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.ease),
  });

  const tickCount = 5;
  const xTicks = Array.from({ length: tickCount }, (_, i) => xMin + (xRange / (tickCount - 1)) * i);
  const yTicks = Array.from({ length: tickCount }, (_, i) => yMin + (yRange / (tickCount - 1)) * i);

  return (
    <svg width={width} height={height} style={{ background: backgroundColor, borderRadius: 12, fontFamily }}>
      {/* Grid lines */}
      {yTicks.map((tick, i) => (
        <line
          key={`ygrid-${i}`}
          x1={padding.left}
          y1={toSvgY(tick)}
          x2={padding.left + plotWidth}
          y2={toSvgY(tick)}
          stroke={axisColor}
          strokeWidth={1}
          strokeDasharray="4 4"
        />
      ))}
      {xTicks.map((tick, i) => (
        <line
          key={`xgrid-${i}`}
          x1={toSvgX(tick)}
          y1={padding.top}
          x2={toSvgX(tick)}
          y2={padding.top + plotHeight}
          stroke={axisColor}
          strokeWidth={1}
          strokeDasharray="4 4"
        />
      ))}

      {/* Axes */}
      <line x1={padding.left} y1={padding.top} x2={padding.left} y2={padding.top + plotHeight} stroke={axisColor} strokeWidth={2} />
      <line x1={padding.left} y1={padding.top + plotHeight} x2={padding.left + plotWidth} y2={padding.top + plotHeight} stroke={axisColor} strokeWidth={2} />

      {/* Tick labels */}
      {xTicks.map((tick, i) => (
        <text key={`xlabel-${i}`} x={toSvgX(tick)} y={padding.top + plotHeight + 18} textAnchor="middle" fill={labelColor} fontSize={11}>
          {tick.toFixed(1)}
        </text>
      ))}
      {yTicks.map((tick, i) => (
        <text key={`ylabel-${i}`} x={padding.left - 8} y={toSvgY(tick) + 4} textAnchor="end" fill={labelColor} fontSize={11}>
          {tick.toFixed(1)}
        </text>
      ))}

      {/* Axis labels */}
      <text x={padding.left + plotWidth / 2} y={height - 6} textAnchor="middle" fill={labelColor} fontSize={13} fontWeight="600">
        {xLabel}
      </text>
      <text
        x={14}
        y={padding.top + plotHeight / 2}
        textAnchor="middle"
        fill={labelColor}
        fontSize={13}
        fontWeight="600"
        transform={`rotate(-90, 14, ${padding.top + plotHeight / 2})`}
      >
        {yLabel}
      </text>

      {/* Trend line */}
      {trendLine && (
        <line
          x1={toSvgX(trendLine.x1)}
          y1={toSvgY(trendLine.y1)}
          x2={interpolate(trendProgress, [0, 1], [toSvgX(trendLine.x1), toSvgX(trendLine.x2)])}
          y2={interpolate(trendProgress, [0, 1], [toSvgY(trendLine.y1), toSvgY(trendLine.y2)])}
          stroke={accentColor}
          strokeWidth={2}
          strokeDasharray="6 3"
          opacity={0.6}
        />
      )}

      {/* Data points */}
      {data.map((point, i) => {
        const pointDelay = startFrame + (i / data.length) * (durationInFrames * 0.7);
        const pointProgress = interpolate(frame, [pointDelay, pointDelay + durationInFrames * 0.3], [0, 1], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
          easing: Easing.out(Easing.back(1.5)),
        });
        const cx = toSvgX(point.x);
        const cy = toSvgY(point.y);
        const r = dotRadius * pointProgress;
        const color = point.color ?? accentColor;

        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r={r + 4} fill={color} opacity={0.15} />
            <circle cx={cx} cy={cy} r={r} fill={color} opacity={pointProgress} />
            {point.label && pointProgress > 0.8 && (
              <text x={cx} y={cy - dotRadius - 4} textAnchor="middle" fill={labelColor} fontSize={10} opacity={(pointProgress - 0.8) / 0.2}>
                {point.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
};
