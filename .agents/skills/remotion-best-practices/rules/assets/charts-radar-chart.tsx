/**
 * Radar / Spider Chart for Remotion
 *
 * Renders an animated radar chart that draws each axis and fills the polygon
 * progressively using Remotion's `interpolate` and `useCurrentFrame`.
 *
 * Usage:
 *   <RadarChart
 *     data={[
 *       { label: 'Speed',     value: 80 },
 *       { label: 'Strength',  value: 60 },
 *       { label: 'Agility',   value: 90 },
 *       { label: 'Endurance', value: 70 },
 *       { label: 'IQ',        value: 85 },
 *     ]}
 *     size={400}
 *     color="#6366f1"
 *     durationInFrames={60}
 *   />
 */

import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, Easing } from 'remotion';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RadarDataPoint {
  label: string;
  /** Normalised value in the range [0, 100] */
  value: number;
}

export interface RadarChartProps {
  data: RadarDataPoint[];
  /** Overall canvas size (square). Defaults to 500. */
  size?: number;
  /** Primary fill / stroke colour. Defaults to '#6366f1'. */
  color?: string;
  /** How many frames the draw-on animation takes. Defaults to 60. */
  durationInFrames?: number;
  /** Number of concentric grid rings. Defaults to 4. */
  rings?: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert polar coordinates to Cartesian, with 0° pointing straight up. */
function polar(cx: number, cy: number, r: number, angleRad: number): [number, number] {
  return [
    cx + r * Math.sin(angleRad),
    cy - r * Math.cos(angleRad),
  ];
}

/** Build an SVG polygon `points` string from an array of [x, y] pairs. */
function pointsAttr(pts: [number, number][]): string {
  return pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const RadarChart: React.FC<RadarChartProps> = ({
  data,
  size = 500,
  color = '#6366f1',
  durationInFrames = 60,
  rings = 4,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const n = data.length;
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.38; // leave room for labels
  const angleStep = (2 * Math.PI) / n;

  // Animation progress 0 → 1
  const progress = interpolate(frame, [0, durationInFrames], [0, 1], {
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

  // Fade-in for labels
  const labelOpacity = interpolate(frame, [durationInFrames * 0.6, durationInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Grid ring polygons
  const gridRings = Array.from({ length: rings }, (_, i) => {
    const r = maxR * ((i + 1) / rings);
    const pts = Array.from({ length: n }, (_, j) => polar(cx, cy, r, j * angleStep));
    return <polygon key={i} points={pointsAttr(pts)} fill="none" stroke="#e2e8f0" strokeWidth={1} />;
  });

  // Axis lines
  const axes = data.map((_, i) => {
    const [x, y] = polar(cx, cy, maxR, i * angleStep);
    return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#cbd5e1" strokeWidth={1} />;
  });

  // Animated data polygon — scale each spoke by `progress`
  const dataPoints = data.map((d, i) => {
    const r = maxR * (d.value / 100) * progress;
    return polar(cx, cy, r, i * angleStep);
  });

  // Labels
  const labels = data.map((d, i) => {
    const labelR = maxR + 22;
    const [lx, ly] = polar(cx, cy, labelR, i * angleStep);
    return (
      <text
        key={i}
        x={lx}
        y={ly}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={13}
        fontFamily="Inter, sans-serif"
        fill="#475569"
        opacity={labelOpacity}
      >
        {d.label}
      </text>
    );
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Grid */}
      {gridRings}
      {axes}

      {/* Data polygon */}
      <polygon
        points={pointsAttr(dataPoints as [number, number][])}
        fill={color}
        fillOpacity={0.25}
        stroke={color}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />

      {/* Data point dots */}
      {dataPoints.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={4} fill={color} />
      ))}

      {/* Labels */}
      {labels}
    </svg>
  );
};

export default RadarChart;
