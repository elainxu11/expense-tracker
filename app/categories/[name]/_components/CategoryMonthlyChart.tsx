'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Transaction } from '@/lib/types';

interface Props {
  txs: Transaction[];
  category: string;
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function CategoryMonthlyChart({ txs, category }: Props) {
  const monthTotals: Record<string, number> = {};
  for (const tx of txs) {
    if (tx.type === 'expense') {
      const key = `${tx.year}-${tx.month}`;
      monthTotals[key] = (monthTotals[key] || 0) + tx.amount;
    } else if (tx.type === 'credit' && tx.refundCategory) {
      // Deduct in the month the credit arrived
      const key = `${tx.year}-${tx.month}`;
      monthTotals[key] = (monthTotals[key] || 0) - tx.amount;
    }
  }

  const keys = Object.keys(monthTotals).sort();
  if (keys.length === 0) return null;
  const hasNegative = Object.values(monthTotals).some((v) => v < 0);

  const [sy, sm] = keys[0].split('-').map(Number);
  const [ey, em] = keys[keys.length - 1].split('-').map(Number);

  const data: { label: string; total: number }[] = [];
  let y = sy, m = sm;
  while (y < ey || (y === ey && m <= em)) {
    const key = `${y}-${String(m).padStart(2, '0')}`;
    data.push({
      label: `${MONTH_ABBR[m - 1]} '${String(y).slice(-2)}`,
      total: Math.round((monthTotals[key] || 0) * 100) / 100,
    });
    m++;
    if (m > 12) { m = 1; y++; }
  }

  const chartHeight = Math.max(160, data.length * 44 + 20);

  return (
    <div className="bg-white rounded-xl border-2 border-slate-200 shadow-sm p-6">
      <h2 className="text-xl font-bold text-slate-900 mb-6">
        Monthly Net Spending — {category}
      </h2>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 24, left: 8, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
          <XAxis
            type="number"
            domain={hasNegative ? ['auto', 'auto'] : [0, 'auto']}
            tickFormatter={(v) => `$${v}`}
            tick={{ fontSize: 12, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            tick={{ fontSize: 12, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
            width={56}
          />
          <Tooltip
            cursor={false}
            formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Net Spent']}
            contentStyle={{
              borderRadius: '0.75rem',
              border: '2px solid #e2e8f0',
              fontSize: '0.875rem',
            }}
          />
          <Bar dataKey="total" fill="#3b82f6" radius={[0, 4, 4, 0]} maxBarSize={28} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
