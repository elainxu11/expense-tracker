'use client';

import { useRouter, usePathname } from 'next/navigation';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

interface Props {
  selectedMonth: string;
  selectedYear: string;
  availableYears: string[];
  isYTD: boolean;
}

export default function MonthYearPicker({ selectedMonth, selectedYear, availableYears, isYTD }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  const update = (month: string, year: string) => {
    router.push(`${pathname}?month=${month}&year=${year}&ytd=false`);
  };

  const toggleYTD = () => {
    if (isYTD) {
      router.push(`${pathname}?month=${selectedMonth}&year=${selectedYear}&ytd=false`);
    } else {
      router.push(`${pathname}?ytd=true&year=${selectedYear}`);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <select
        value={isYTD ? '' : selectedMonth}
        onChange={(e) => update(e.target.value, selectedYear)}
        className="px-3 py-2 rounded-lg border-2 border-slate-200 bg-white font-semibold text-slate-800 focus:outline-none focus:border-blue-400"
      >
        {isYTD && <option value="" disabled>--</option>}
        {MONTH_NAMES.map((name, i) => {
          const val = String(i + 1).padStart(2, '0');
          return <option key={val} value={val}>{name}</option>;
        })}
      </select>
      <select
        value={selectedYear}
        onChange={(e) => isYTD
          ? router.push(`${pathname}?ytd=true&year=${e.target.value}`)
          : update(selectedMonth, e.target.value)
        }
        className="px-3 py-2 rounded-lg border-2 border-slate-200 bg-white font-semibold text-slate-800 focus:outline-none focus:border-blue-400"
      >
        {availableYears.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
      <button
        onClick={toggleYTD}
        className={`px-3 py-2 rounded-lg border-2 font-semibold text-sm transition ${
          isYTD
            ? 'bg-blue-600 border-blue-600 text-white'
            : 'bg-white border-slate-200 text-slate-700 hover:border-blue-400'
        }`}
      >
        Year to Date
      </button>
    </div>
  );
}
