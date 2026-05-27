'use client';

import { useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Sector } from 'recharts';

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#f97316', '#84cc16', '#ec4899', '#14b8a6',
  '#6366f1', '#a855f7', '#fb923c', '#4ade80', '#facc15',
];

interface Props {
  data: { name: string; value: number }[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ActiveSlice(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <Sector
      cx={cx}
      cy={cy}
      innerRadius={innerRadius}
      outerRadius={outerRadius + 8}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
    />
  );
}

export default function CategoryPieChart({ data }: Props) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

  if (data.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border-2 border-slate-200 p-6 shadow-sm">
      <h2 className="text-xl font-bold text-slate-900 mb-4">Spending by Category</h2>
      <ResponsiveContainer width="100%" height={320}>
        <PieChart style={{ outline: 'none' }}>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            outerRadius={110}
            activeIndex={activeIndex}
            activeShape={ActiveSlice}
            onMouseEnter={(_, index) => setActiveIndex(index)}
            onMouseLeave={() => setActiveIndex(undefined)}
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            labelLine={false}
            style={{ outline: 'none' }}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
