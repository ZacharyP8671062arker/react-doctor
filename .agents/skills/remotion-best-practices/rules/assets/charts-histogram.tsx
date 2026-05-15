/**
 * Histogram Chart Component for Remotion
 *
 * Renders an animated histogram with configurable bins, colors, and entrance animations.
 * Useful for visualizing frequency distributions of continuous data.
 *
 * @example
 * <Histogram
 *   data={[1, 2, 2, 3, 3, 3, 4, 4, 5]}
 *   bins={5}
 *   title="Value Distribution"
 *   color="#6366f1"
 * />
 */

import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

interface HistogramProps {
  /** Raw data values to bin */
  data: number[];
  /** Number of bins to divide data into */
  bins?: number;
  /** Chart title */
  title?: string;
  /** Primary bar color */
  color?: string;
  /** Background color */
  backgroundColor?: string;
  /** Delay in frames before animation starts */
  delay?: number;
  /** Duration of the bar grow animation in frames */
  animationDuration?: number;
}

/** Compute histogram bins from raw data */
function computeBins(
  data: number[],
  binCount: number
): { label: string; count: number; rangeStart: number; rangeEnd: number }[] {
  if (data.length === 0) return [];

  const min = Math.min(...data);
  const max = Math.max(...data);
  const binWidth = (max - min) / binCount || 1;

  const bins = Array.from({ length: binCount }, (_, i) => ({
    rangeStart: min + i * binWidth,
    rangeEnd: min + (i + 1) * binWidth,
    label: `${(min + i * binWidth).toFixed(1)}`,
    count: 0,
  }));

  for (const value of data) {
    const idx = Math.min(
      Math.floor((value - min) / binWidth),
      binCount - 1
    );
    bins[idx].count += 1;
  }

  return bins;
}

export const Histogram: React.FC<HistogramProps> = ({
  data,
  bins: binCount = 8,
  title = "Distribution",
  color = "#6366f1",
  backgroundColor = "#0f172a",
  delay = 10,
  animationDuration = 30,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  const bins = computeBins(data, binCount);
  const maxCount = Math.max(...bins.map((b) => b.count), 1);

  const chartPadding = { top: 80, right: 40, bottom: 70, left: 60 };
  const chartWidth = width - chartPadding.left - chartPadding.right;
  const chartHeight = height - chartPadding.top - chartPadding.bottom;

  const barWidth = chartWidth / bins.length;
  const barGap = barWidth * 0.08;

  return (
    <AbsoluteFill style={{ backgroundColor }}>
      {/* Title */}
      <div
        style={{
          position: "absolute",
          top: 24,
          left: chartPadding.left,
          color: "#f8fafc",
          fontSize: 28,
          fontWeight: 700,
          fontFamily: "sans-serif",
          opacity: interpolate(frame, [0, 15], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        {title}
      </div>

      <svg
        width={width}
        height={height}
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        {/* Y-axis gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const y = chartPadding.top + chartHeight * (1 - tick);
          const label = Math.round(tick * maxCount);
          return (
            <g key={tick}>
              <line
                x1={chartPadding.left}
                x2={chartPadding.left + chartWidth}
                y1={y}
                y2={y}
                stroke="#334155"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <text
                x={chartPadding.left - 8}
                y={y + 5}
                textAnchor="end"
                fill="#94a3b8"
                fontSize={13}
                fontFamily="sans-serif"
              >
                {label}
              </text>
            </g>
          );
        })}

        {/* Bars */}
        {bins.map((bin, i) => {
          const barProgress = interpolate(
            frame,
            [delay + i * 3, delay + i * 3 + animationDuration],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );

          const barHeightPx = (bin.count / maxCount) * chartHeight * barProgress;
          const x = chartPadding.left + i * barWidth + barGap / 2;
          const y = chartPadding.top + chartHeight - barHeightPx;
          const w = barWidth - barGap;

          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={w}
                height={barHeightPx}
                fill={color}
                opacity={0.85}
                rx={3}
              />
              {/* Count label above bar */}
              {bin.count > 0 && barProgress > 0.8 && (
                <text
                  x={x + w / 2}
                  y={y - 6}
                  textAnchor="middle"
                  fill="#f1f5f9"
                  fontSize={12}
                  fontFamily="sans-serif"
                  opacity={interpolate(barProgress, [0.8, 1], [0, 1])}
                >
                  {bin.count}
                </text>
              )}
              {/* X-axis bin label */}
              <text
                x={x + w / 2}
                y={chartPadding.top + chartHeight + 20}
                textAnchor="middle"
                fill="#94a3b8"
                fontSize={11}
                fontFamily="sans-serif"
              >
                {bin.label}
              </text>
            </g>
          );
        })}

        {/* X and Y axis lines */}
        <line
          x1={chartPadding.left}
          x2={chartPadding.left + chartWidth}
          y1={chartPadding.top + chartHeight}
          y2={chartPadding.top + chartHeight}
          stroke="#475569"
          strokeWidth={2}
        />
        <line
          x1={chartPadding.left}
          x2={chartPadding.left}
          y1={chartPadding.top}
          y2={chartPadding.top + chartHeight}
          stroke="#475569"
          strokeWidth={2}
        />
      </svg>
    </AbsoluteFill>
  );
};
