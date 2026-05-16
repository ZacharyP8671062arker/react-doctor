/**
 * Stacked Bar Chart component for Remotion animations.
 * Renders a stacked bar chart where each bar is composed of multiple segments,
 * with animated entry using spring physics.
 *
 * Usage:
 *   <StackedBarChart
 *     data={[
 *       { label: 'Q1', values: [30, 20, 10], colors: ['#4f8ef7', '#f7a44f', '#4ff7a4'] },
 *       { label: 'Q2', values: [40, 15, 25], colors: ['#4f8ef7', '#f7a44f', '#4ff7a4'] },
 *     ]}
 *     legend={['Product A', 'Product B', 'Product C']}
 *     width={600}
 *     height={400}
 *   />
 */

import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

interface StackedBarDatum {
  /** Category label shown on the x-axis */
  label: string;
  /** Numeric values for each stack segment */
  values: number[];
  /** Fill colors per segment (must match values length) */
  colors: string[];
}

interface StackedBarChartProps {
  data: StackedBarDatum[];
  /** Legend labels for each segment layer */
  legend?: string[];
  width?: number;
  height?: number;
  /** Delay in frames before animation starts */
  startFrame?: number;
  /** Duration in frames for the grow animation */
  animationDuration?: number;
  backgroundColor?: string;
  axisColor?: string;
  labelColor?: string;
  fontSize?: number;
}

export const StackedBarChart: React.FC<StackedBarChartProps> = ({
  data,
  legend,
  width = 640,
  height = 400,
  startFrame = 0,
  animationDuration = 30,
  backgroundColor = 'transparent',
  axisColor = '#555',
  labelColor = '#333',
  fontSize = 13,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const paddingLeft = 50;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 40;
  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Compute max total value across all bars for y-axis scaling
  const maxTotal = Math.max(...data.map((d) => d.values.reduce((a, b) => a + b, 0)));

  const barCount = data.length;
  const barGroupWidth = chartWidth / barCount;
  const barWidth = barGroupWidth * 0.6;
  const barOffset = (barGroupWidth - barWidth) / 2;

  // Spring-based grow progress per bar (staggered)
  const getProgress = (barIndex: number): number => {
    const delay = barIndex * 4; // 4-frame stagger between bars
    return spring({
      frame: frame - startFrame - delay,
      fps,
      config: { damping: 18, stiffness: 120, mass: 1 },
      durationInFrames: animationDuration,
    });
  };

  // Y-axis tick values
  const tickCount = 5;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) =>
    Math.round((maxTotal / tickCount) * i)
  );

  return (
    <svg width={width} height={height} style={{ background: backgroundColor }}>
      {/* Y-axis ticks and gridlines */}
      {ticks.map((tick) => {
        const y = paddingTop + chartHeight - (tick / maxTotal) * chartHeight;
        return (
          <g key={tick}>
            <line
              x1={paddingLeft}
              x2={paddingLeft + chartWidth}
              y1={y}
              y2={y}
              stroke={axisColor}
              strokeOpacity={0.2}
              strokeWidth={1}
            />
            <text
              x={paddingLeft - 6}
              y={y + 4}
              textAnchor="end"
              fill={labelColor}
              fontSize={fontSize - 2}
            >
              {tick}
            </text>
          </g>
        );
      })}

      {/* Bars */}
      {data.map((datum, barIndex) => {
        const progress = getProgress(barIndex);
        const x = paddingLeft + barIndex * barGroupWidth + barOffset;
        let cumulativeValue = 0;

        return (
          <g key={datum.label}>
            {datum.values.map((val, segIndex) => {
              const segHeight = (val / maxTotal) * chartHeight * progress;
              const prevHeight = (cumulativeValue / maxTotal) * chartHeight * progress;
              cumulativeValue += val;
              const segY = paddingTop + chartHeight - prevHeight - segHeight;

              return (
                <rect
                  key={segIndex}
                  x={x}
                  y={segY}
                  width={barWidth}
                  height={segHeight}
                  fill={datum.colors[segIndex] ?? '#888'}
                  rx={segIndex === datum.values.length - 1 ? 3 : 0}
                />
              );
            })}

            {/* X-axis label */}
            <text
              x={x + barWidth / 2}
              y={paddingTop + chartHeight + 18}
              textAnchor="middle"
              fill={labelColor}
              fontSize={fontSize}
            >
              {datum.label}
            </text>
          </g>
        );
      })}

      {/* Axes */}
      <line
        x1={paddingLeft}
        x2={paddingLeft}
        y1={paddingTop}
        y2={paddingTop + chartHeight}
        stroke={axisColor}
        strokeWidth={2}
      />
      <line
        x1={paddingLeft}
        x2={paddingLeft + chartWidth}
        y1={paddingTop + chartHeight}
        y2={paddingTop + chartHeight}
        stroke={axisColor}
        strokeWidth={2}
      />

      {/* Legend */}
      {legend &&
        legend.map((label, i) => {
          // Use colors from the first data item as reference
          const color = data[0]?.colors[i] ?? '#888';
          const legendX = paddingLeft + (chartWidth / legend.length) * i;
          const legendY = height - 8;
          return (
            <g key={label}>
              <rect x={legendX} y={legendY - 10} width={12} height={12} fill={color} rx={2} />
              <text
                x={legendX + 16}
                y={legendY}
                fill={labelColor}
                fontSize={fontSize - 1}
              >
                {label}
              </text>
            </g>
          );
        })}
    </svg>
  );
};
