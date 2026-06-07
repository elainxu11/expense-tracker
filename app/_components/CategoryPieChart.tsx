'use client';

import { useMemo, useCallback } from 'react';
import { PieChart, Pie, Tooltip, ResponsiveContainer, Sector } from 'recharts';
import type { PieSectorShapeProps, PieLabelRenderProps } from 'recharts';

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#14b8a6',
  '#6366f1', '#a855f7', '#fb923c', '#4ade80', '#facc15',
];

const RADIAN = Math.PI / 180;
const OUTER_R = 100;
const CHART_H = 420;
const CHART_CY = CHART_H / 2; // fixed: cy="50%"
const LABEL_R = OUTER_R + 40;
const FONT_H = 16;
const MIN_GAP = 3;

interface Props {
  data: { name: string; value: number }[];
}

type LabelLayout = { adjustedY: number; isRight: boolean; midAngle: number };

/**
 * Pre-compute collision-free Y positions for all labels.
 * Y is purely a function of midAngle (and the fixed CHART_CY), so no container
 * width measurement is needed.
 *
 * Algorithm per side:
 *   1. Sort by natural Y (top → bottom).
 *   2. Forward pass: push each label down until it clears the one above.
 *   3. Backward pass: pull each label up until it clears the one below.
 *      This re-centres the cluster toward its natural positions.
 */
function buildLabelLayout(data: { value: number }[]): Map<number, LabelLayout> {
  const total = data.reduce((s, d) => s + d.value, 0);
  let cumAngle = 0; // startAngle=0 (east), CCW — Recharts default

  const items = data.map((d, i) => {
    const sliceDeg = (d.value / total) * 360;
    const midAngle = cumAngle + sliceDeg / 2;
    cumAngle += sliceDeg;
    const rad = -midAngle * RADIAN;
    const naturalY = CHART_CY + LABEL_R * Math.sin(rad);
    const isRight = Math.cos(rad) > 0;
    return { index: i, naturalY, adjustedY: naturalY, isRight, midAngle };
  });

  for (const side of [true, false] as const) {
    const group = items.filter(e => e.isRight === side);
    group.sort((a, b) => a.naturalY - b.naturalY);

    // Forward pass (top → bottom): push down to clear previous label
    for (let i = 1; i < group.length; i++) {
      const floor = group[i - 1].adjustedY + FONT_H + MIN_GAP;
      if (group[i].adjustedY < floor) group[i].adjustedY = floor;
    }

    // Backward pass (bottom → top): pull up to re-centre group
    for (let i = group.length - 2; i >= 0; i--) {
      const ceiling = group[i + 1].adjustedY - FONT_H - MIN_GAP;
      if (group[i].adjustedY > ceiling) group[i].adjustedY = ceiling;
    }
  }

  return new Map(items.map(e => [e.index, { adjustedY: e.adjustedY, isRight: e.isRight, midAngle: e.midAngle }]));
}

function renderSector(props: PieSectorShapeProps, index: number): React.ReactElement {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, isActive } = props;
  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius}
      outerRadius={isActive ? outerRadius + 8 : outerRadius}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={COLORS[index % COLORS.length]}
    />
  );
}

export default function CategoryPieChart({ data }: Props) {
  if (data.length === 0) return null;

  const layout = useMemo(() => buildLabelLayout(data), [data]);

  const renderLabel = useCallback((props: PieLabelRenderProps): React.ReactElement | null => {
    const { cx: propCx, cy: propCy, outerRadius, midAngle: propMidAngle, percent, name, index } = props;
    const pos = layout.get(index as number);
    if (!pos) return null;

    const { adjustedY, isRight } = pos;
    const cxN = propCx as number;
    const cyN = propCy as number;
    const outerR = outerRadius as number;
    const rad = -(propMidAngle as number) * RADIAN;

    const lineStartX = cxN + (outerR + 4) * Math.cos(rad);
    const lineStartY = cyN + (outerR + 4) * Math.sin(rad);
    const anchorX = cxN + LABEL_R * Math.cos(rad);
    // adjustedY was computed using CHART_CY; translate to actual propCy coordinate
    const finalY = adjustedY + (cyN - CHART_CY);

    const color = COLORS[(index as number) % COLORS.length];
    const pct = ((percent ?? 0) * 100).toFixed(0);

    return (
      <g key={`label-${index}`}>
        <line
          x1={lineStartX} y1={lineStartY}
          x2={anchorX}   y2={finalY}
          stroke={color} strokeWidth={1} strokeOpacity={0.6}
        />
        <text
          x={anchorX + (isRight ? 4 : -4)}
          y={finalY}
          textAnchor={isRight ? 'start' : 'end'}
          dominantBaseline="central"
          fill={color}
          fontSize={12}
          fontWeight={500}
        >
          {`${name} ${pct}%`}
        </text>
      </g>
    );
  }, [layout]);

  return (
    <div className="bg-white rounded-xl border-2 border-slate-200 p-6 shadow-sm">
      <h2 className="text-xl font-bold text-slate-900 mb-4">Spending by Category</h2>
      <div className="[&_svg]:outline-none [&_svg_*]:outline-none [&_svg_*:focus]:outline-none">
        <ResponsiveContainer width="100%" height={CHART_H}>
          <PieChart style={{ outline: 'none' }}>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={OUTER_R}
              style={{ outline: 'none' }}
              isAnimationActive={false}
              shape={renderSector}
              label={renderLabel}
              labelLine={false}
            />
            <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
