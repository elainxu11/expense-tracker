'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

const CARD_LABELS: Record<string, string> = {
  amex: 'American Express',
  'capital-one': 'Capital One Venture X',
  discover: 'Discover',
  venmo: 'Venmo',
  'wells-fargo': 'Wells Fargo Autograph',
  bofa: 'Bank of America',
  other: 'Other',
};

const CARD_COLORS: Record<string, string> = {
  amex: '#3b82f6',
  'capital-one': '#8b5cf6',
  discover: '#f59e0b',
  venmo: '#10b981',
  'wells-fargo': '#ef4444',
  bofa: '#f97316',
  other: '#94a3b8',
};

const FALLBACK_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#f97316', '#94a3b8'];

export interface ChartDatum {
  label: string;
  [card: string]: number | string;
}

interface Props {
  data: ChartDatum[];
  cards: string[];
}

export default function MerchantSpendingChart({ data, cards }: Props) {
  if (data.length === 0) return null;

  const barHeight = 38;
  const legendOffset = cards.length > 1 ? 40 : 0;
  const chartHeight = Math.max(160, data.length * barHeight + 48 + legendOffset);

  return (
    <div className="bg-white rounded-xl border-2 border-slate-200 p-6 shadow-sm">
      <h2 className="text-xl font-bold text-slate-900 mb-4">Monthly Spending</h2>
      <div style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 32, left: 4, bottom: legendOffset }}
            barCategoryGap="28%"
          >
            <XAxis
              type="number"
              tickFormatter={(v: number) => `$${v}`}
              tick={{ fontSize: 12, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="label"
              tick={{ fontSize: 12, fill: '#475569' }}
              width={72}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value, name) => [
                typeof value === 'number' ? `$${value.toFixed(2)}` : String(value),
                CARD_LABELS[String(name)] ?? String(name),
              ]}
              cursor={{ fill: '#f1f5f9' }}
              contentStyle={{ fontSize: 13, borderRadius: 8, border: '1px solid #e2e8f0' }}
            />
            {cards.length > 1 && (
              <Legend
                verticalAlign="bottom"
                formatter={(value: string) => CARD_LABELS[value] ?? value}
                wrapperStyle={{ fontSize: 12, paddingTop: 12 }}
              />
            )}
            {cards.map((card, i) => (
              <Bar
                key={card}
                dataKey={card}
                stackId="a"
                fill={CARD_COLORS[card] ?? FALLBACK_COLORS[i % FALLBACK_COLORS.length]}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}