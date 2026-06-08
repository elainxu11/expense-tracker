'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  category: string;
  deductible: boolean;
  ignored: boolean;
  date: string;
  categories: string[];
  saving: boolean;
  isCredit?: boolean;
  refundCategory?: string;
  onCategoryChange: (category: string) => void;
  onDeductibleToggle: () => void;
  onIgnore: () => void;
  onDateChange: (date: string, month: string, year: string) => void;
  onRefundCategoryChange?: (cat: string) => void;
}

function toInputDate(dateStr: string): string {
  const slash = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const m = slash[1].padStart(2, '0');
    const d = slash[2].padStart(2, '0');
    return `${slash[3]}-${m}-${d}`;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  return '';
}

export default function TransactionMenu({
  category,
  deductible,
  ignored,
  date,
  categories,
  saving,
  isCredit,
  refundCategory,
  onCategoryChange,
  onDeductibleToggle,
  onIgnore,
  onDateChange,
  onRefundCategoryChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [editingCat, setEditingCat] = useState(false);
  const [editingRefundCat, setEditingRefundCat] = useState(false);
  const [editingDate, setEditingDate] = useState(false);
  const [dateInput, setDateInput] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open && !editingCat && !editingRefundCat && !editingDate) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setEditingCat(false);
        setEditingRefundCat(false);
        setEditingDate(false);
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open, editingCat, editingRefundCat, editingDate]);

  if (saving) {
    return (
      <span className="w-7 flex items-center justify-center text-slate-400 text-xs">···</span>
    );
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={(e) => {
          e.stopPropagation();
          setEditingCat(false);
          setEditingRefundCat(false);
          setEditingDate(false);
          setOpen((o) => !o);
        }}
        className="p-1.5 rounded text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition text-base leading-none"
        title="More options"
      >
        ···
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-30 bg-white border border-slate-200 rounded-lg shadow-lg py-1 w-52">
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              setOpen(false);
              setEditingCat(true);
            }}
            className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
          >
            Edit category
          </button>
          {isCredit && onRefundCategoryChange && (
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                setOpen(false);
                setEditingRefundCat(true);
              }}
              className="w-full text-left px-4 py-2 text-sm text-green-700 hover:bg-green-50 transition"
            >
              Edit reimbursement category
              {refundCategory && (
                <span className="ml-1 text-xs text-green-500">({refundCategory})</span>
              )}
            </button>
          )}
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              setOpen(false);
              setDateInput(toInputDate(date));
              setEditingDate(true);
            }}
            className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
          >
            Edit date
          </button>
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              setOpen(false);
              onDeductibleToggle();
            }}
            className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
          >
            {deductible ? 'Remove business expense' : 'Mark as business expense'}
          </button>
          {!ignored && (
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                setOpen(false);
                onIgnore();
              }}
              className="w-full text-left px-4 py-2 text-sm text-slate-500 hover:bg-slate-50 transition border-t border-slate-100"
            >
              Ignore transaction
            </button>
          )}
        </div>
      )}

      {editingCat && (
        <div className="absolute right-0 top-full mt-1 z-30 bg-white border-2 border-blue-400 rounded-xl shadow-xl p-3 w-72">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
            Category
          </p>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onCategoryChange(cat);
                  setEditingCat(false);
                }}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold transition ${
                  category === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-blue-100 hover:text-blue-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {editingRefundCat && (
        <div className="absolute right-0 top-full mt-1 z-30 bg-white border-2 border-green-400 rounded-xl shadow-xl p-3 w-72">
          <p className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-2">
            Offsets which expense category?
          </p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {categories.map((cat) => (
              <button
                key={cat}
                onMouseDown={(e) => {
                  e.preventDefault();
                  onRefundCategoryChange?.(cat);
                  setEditingRefundCat(false);
                }}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold transition ${
                  refundCategory === cat
                    ? 'bg-green-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-green-100 hover:text-green-800'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              onRefundCategoryChange?.('');
              setEditingRefundCat(false);
            }}
            className="text-xs text-slate-400 hover:text-slate-600 transition"
          >
            Clear — general refund
          </button>
        </div>
      )}

      {editingDate && (
        <div className="absolute right-0 top-full mt-1 z-30 bg-white border-2 border-blue-400 rounded-xl shadow-xl p-4 w-64">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
            Edit Date
          </p>
          <input
            type="date"
            value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:border-blue-400"
          />
          <div className="flex gap-2 mt-3">
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                if (!dateInput) return;
                const [y, m, d] = dateInput.split('-');
                const formatted = `${m}/${d}/${y}`;
                onDateChange(formatted, m, y);
                setEditingDate(false);
              }}
              className="flex-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition"
            >
              Save
            </button>
            <button
              onMouseDown={(e) => {
                e.preventDefault();
                setEditingDate(false);
              }}
              className="flex-1 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-sm font-semibold hover:bg-slate-200 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
