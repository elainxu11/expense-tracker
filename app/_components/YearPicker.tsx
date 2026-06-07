'use client';

import { useRouter, usePathname } from 'next/navigation';

interface Props {
  selectedYear: string;
  availableYears: string[];
}

export default function YearPicker({ selectedYear, availableYears }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <select
      value={selectedYear}
      onChange={(e) => router.push(`${pathname}?year=${e.target.value}`)}
      className="px-3 py-2 rounded-lg border-2 border-slate-200 bg-white font-semibold text-slate-800 focus:outline-none focus:border-blue-400"
    >
      {availableYears.map((y) => (
        <option key={y} value={y}>{y}</option>
      ))}
    </select>
  );
}