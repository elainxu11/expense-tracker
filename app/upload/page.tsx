'use client';

import { useState, useEffect, useRef } from 'react';
import { Upload } from 'lucide-react';
import { ParsedTransaction, Transaction, Category, DEFAULT_CATEGORIES, CheckingRow, VendorRule } from '@/lib/types';
import { applyVendorRules } from '@/lib/vendorRules';
import { checkCSVFormat } from '@/lib/csvFormatCheck';

const DRAFT_KEY = 'upload_session_draft';

const CARD_TYPES = [
  { value: 'amex', label: 'American Express' },
  { value: 'capital-one', label: 'Capital One Venture X' },
  { value: 'discover', label: 'Discover' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'wells-fargo', label: 'Wells Fargo Autograph' },
  { value: 'bofa', label: 'Bank of America' },
  { value: 'personal-checking', label: 'BofA Personal Checking' },
  { value: 'efuture-checking', label: 'BofA eFuture Checking' },
  { value: 'other', label: 'Other / Miscellaneous' },
];

const CHECKING_TYPES = new Set(['personal-checking', 'efuture-checking']);

interface SessionDraft {
  step: 'upload' | 'categorize';
  selectedCard: string;
  transactions: ParsedTransaction[];
  categorized: Transaction[];
  currentIndex: number;
  corrections: Record<string, Category>;
  savedAt: string;
}

function loadDraft(): SessionDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveDraft(draft: SessionDraft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {}
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {}
}

export default function UploadPage() {
  const [step, setStep] = useState<'select' | 'upload' | 'categorize' | 'complete' | 'resume' | 'checking-review' | 'checking-categorize'>(
    'select'
  );
  const [selectedCard, setSelectedCard] = useState<string>('');
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [categorized, setCategorized] = useState<Transaction[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [checkingRows, setCheckingRows] = useState<CheckingRow[]>([]);
  const [checkingExpenseIndex, setCheckingExpenseIndex] = useState(0);
  const [checkingOverrides, setCheckingOverrides] = useState<Record<number, { description: string; category: string; deductible: boolean; ignored?: boolean }>>({});
  const [checkingCurrentDesc, setCheckingCurrentDesc] = useState('');
  const [suggestedCategory, setSuggestedCategory] = useState<Category | null>(null);
  const correctionsRef = useRef<Record<string, Category>>({});
  const deductibleRef = useRef<Record<string, boolean>>({});
  const loadGenRef = useRef(0);
  const categorizingRef = useRef(false);
  // Always points to the latest handleCategorize, preventing stale closures in the keydown listener
  const handleCategorizeRef = useRef<((category: Category) => Promise<void>) | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [draft, setDraft] = useState<SessionDraft | null>(null);
  const [deductible, setDeductible] = useState(false);
  const [hoveredCat, setHoveredCat] = useState<string | null>(null);
  const [formatWarning, setFormatWarning] = useState<string>('');
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [vendorRules, setVendorRules] = useState<VendorRule[]>([]);

  // On mount, check for a saved draft and load categories from settings
  useEffect(() => {
    const saved = loadDraft();
    if (saved && saved.transactions.length > 0) {
      setDraft(saved);
      setStep('resume');
    }
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d) => { if (d.categories?.length) setCategories(d.categories); })
      .catch(() => {});
    fetch('/api/vendor-rules')
      .then((r) => r.json())
      .then((d) => { if (d.rules) setVendorRules(d.rules); })
      .catch(() => {});
  }, []);

  // Auto-save draft whenever categorization state changes
  useEffect(() => {
    if (step !== 'categorize' && step !== 'upload') return;
    saveDraft({
      step,
      selectedCard,
      transactions,
      categorized,
      currentIndex,
      corrections: correctionsRef.current,
      savedAt: new Date().toISOString(),
    });
  }, [step, selectedCard, transactions, categorized, currentIndex]);

  useEffect(() => {
    if (step !== 'categorize' || !suggestedCategory) return;
    const capturedSuggestion = suggestedCategory;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        // preventDefault stops the browser from also firing a click on the focused button,
        // which would double-call handleCategorize and skip every other transaction.
        e.preventDefault();
        handleCategorizeRef.current?.(capturedSuggestion);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [step, suggestedCategory]);

  const checkingExpenseHandleRef = useRef<((category: Category) => void) | null>(null);
  useEffect(() => {
    if (step !== 'checking-categorize' || !suggestedCategory) return;
    const capturedSuggestion = suggestedCategory;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        checkingExpenseHandleRef.current?.(capturedSuggestion);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [step, suggestedCategory]);

  const loadCheckingExpenseSuggestion = async (desc: string) => {
    const gen = ++loadGenRef.current;
    setSuggestedCategory(null);
    try {
      const response = await fetch('/api/suggest-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchant: desc }),
      });
      if (response.ok && gen === loadGenRef.current) {
        const data = await response.json();
        setSuggestedCategory(data.category);
      }
    } catch {
      if (gen === loadGenRef.current) setSuggestedCategory('Bills');
    }
  };

  const handleResumeDraft = async () => {
    if (!draft) return;
    setSelectedCard(draft.selectedCard);
    setTransactions(draft.transactions);
    setCategorized(draft.categorized);
    setCurrentIndex(draft.currentIndex);
    correctionsRef.current = draft.corrections;
    setDraft(null);
    setStep(draft.step);
    if (draft.step === 'categorize' && draft.transactions[draft.currentIndex]) {
      await loadSuggestedCategory(draft.transactions[draft.currentIndex]);
    }
  };

  const handleDiscardDraft = () => {
    clearDraft();
    setDraft(null);
    setStep('select');
  };

  const handleCardSelect = (cardType: string) => {
    setSelectedCard(cardType);
    setStep('upload');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError('');
    setFormatWarning('');

    try {
      const text = await file.text();

      const fmt = checkCSVFormat(text, selectedCard);
      if (!fmt.ok) setFormatWarning(fmt.message ?? 'CSV format may have changed.');

      if (CHECKING_TYPES.has(selectedCard)) {
        const response = await fetch('/api/parse-csv', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ csv: text, cardType: selectedCard }),
        });
        if (!response.ok) throw new Error('Failed to parse CSV');
        const data = await response.json();
        if (!data.rows || data.rows.length === 0) throw new Error('No transactions found in CSV');
        setCheckingRows(data.rows);
        setStep('checking-review');
        return;
      }

      const response = await fetch('/api/parse-csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: text, cardType: selectedCard }),
      });

      if (!response.ok) throw new Error('Failed to parse CSV');
      const data = await response.json();
      setTransactions(data.transactions);
      setStep('categorize');
      setCurrentIndex(0);

      if (data.transactions.length > 0) {
        await loadSuggestedCategory(data.transactions[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV');
    } finally {
      setLoading(false);
    }
  };

  const loadSuggestedCategory = async (transaction: ParsedTransaction) => {
    const gen = ++loadGenRef.current;

    if (transaction.type === 'credit') {
      setSuggestedCategory(null); // user must explicitly pick which expense category this offsets
      return;
    }
    const normalizedMerchant = applyVendorRules(transaction.merchant, vendorRules);
    const key = normalizedMerchant.toLowerCase();
    const localCorrection = correctionsRef.current[key];
    setDeductible(deductibleRef.current[key] ?? false);
    if (localCorrection) {
      setSuggestedCategory(localCorrection);
      return;
    }
    try {
      const response = await fetch('/api/suggest-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchant: normalizedMerchant, sourceCategory: transaction.sourceCategory }),
      });
      if (response.ok && gen === loadGenRef.current) {
        const data = await response.json();
        setSuggestedCategory(data.category);
        if (data.deductible && !deductibleRef.current[key]) {
          deductibleRef.current[key] = true;
          setDeductible(true);
        }
      }
    } catch {
      if (gen === loadGenRef.current) setSuggestedCategory('Shopping');
    }
  };

  const saveSessionToHistory = async (allCategorized: Transaction[]) => {
    setLoading(true);
    const expenseCount = allCategorized.filter((t) => t.type === 'expense' && !t.ignored).length;
    const creditCount = allCategorized.filter((t) => t.type === 'credit' && !t.ignored).length;
    const totalAmount = allCategorized
      .filter((t) => t.type === 'expense' && !t.ignored)
      .reduce((sum, t) => sum + t.amount, 0);
    const cardLabel = CARD_TYPES.find((c) => c.value === selectedCard)?.label ?? selectedCard;
    try {
      const response = await fetch('/api/upload-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          card: selectedCard,
          cardLabel,
          transactions: allCategorized,
          expenseCount,
          creditCount,
          totalAmount,
        }),
      });
      if (!response.ok) throw new Error('Failed to save to history');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      categorizingRef.current = false;
      setLoading(false);
      return;
    }

    // Batch-save all accumulated merchant mappings now that categorization is complete.
    // Doing this once at the end avoids rapid-fire Sheets API calls that hit the per-minute write quota.
    const corrections = correctionsRef.current;
    const deductibles = deductibleRef.current;
    const merchantsSeen = new Set([...Object.keys(corrections), ...Object.keys(deductibles)]);
    if (merchantsSeen.size > 0) {
      const saves = [...merchantsSeen].map((merchant) =>
        fetch('/api/save-merchant-mapping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            merchant,
            ...(corrections[merchant] && { category: corrections[merchant] }),
            ...(deductibles[merchant] && { deductible: true }),
          }),
        }).catch(() => {})
      );
      await Promise.allSettled(saves);
    }

    setLoading(false);
    clearDraft();
    setStep('complete');
  };

  const handleCategorize = async (category: Category) => {
    if (categorizingRef.current) return;
    categorizingRef.current = true;
    const indexAtStart = currentIndex;
    const tx = transactions[indexAtStart];
    const normalizedMerchant = applyVendorRules(tx.merchant, vendorRules);

    const hasCategoryOverride = suggestedCategory && category !== suggestedCategory && tx.type !== 'credit';
    const hasDeductible = deductible && tx.type !== 'credit';

    if (hasCategoryOverride) {
      correctionsRef.current = { ...correctionsRef.current, [normalizedMerchant.toLowerCase()]: category };
    }
    if (hasDeductible) {
      deductibleRef.current[normalizedMerchant.toLowerCase()] = true;
    }

    const categorized_tx: Transaction = {
      id: `${Date.now()}-${indexAtStart}`,
      ...tx,
      merchant: normalizedMerchant,
      category: tx.type === 'credit' ? 'Reimbursements' : category,
      ...(tx.type === 'credit' ? { refundCategory: category } : {}),
      month: tx.date.split('-')[1],
      year: tx.date.split('-')[0],
      deductible,
    };

    const allCategorized = [...categorized, categorized_tx];
    setCategorized(allCategorized);
    setDeductible(false);

    if (indexAtStart < transactions.length - 1) {
      setCurrentIndex(indexAtStart + 1);
      categorizingRef.current = false;
      await loadSuggestedCategory(transactions[indexAtStart + 1]);
    } else {
      await saveSessionToHistory(allCategorized);
    }
  };

  const handleSkipRefundCategory = async () => {
    if (categorizingRef.current) return;
    categorizingRef.current = true;
    const indexAtStart = currentIndex;
    const tx = transactions[indexAtStart];
    const normalizedMerchant = applyVendorRules(tx.merchant, vendorRules);

    const categorized_tx: Transaction = {
      id: `${Date.now()}-${indexAtStart}`,
      ...tx,
      merchant: normalizedMerchant,
      category: 'Reimbursements',
      month: tx.date.split('-')[1],
      year: tx.date.split('-')[0],
      deductible: false,
    };

    const allCategorized = [...categorized, categorized_tx];
    setCategorized(allCategorized);
    setDeductible(false);

    if (indexAtStart < transactions.length - 1) {
      setCurrentIndex(indexAtStart + 1);
      categorizingRef.current = false;
      await loadSuggestedCategory(transactions[indexAtStart + 1]);
    } else {
      await saveSessionToHistory(allCategorized);
    }
  };

  const handleIgnore = async () => {
    if (categorizingRef.current) return;
    categorizingRef.current = true;
    const indexAtStart = currentIndex;
    const tx = transactions[indexAtStart];
    const normalizedMerchant = applyVendorRules(tx.merchant, vendorRules);

    const categorized_tx: Transaction = {
      id: `${Date.now()}-${indexAtStart}`,
      ...tx,
      merchant: normalizedMerchant,
      category: suggestedCategory ?? categories[0] ?? 'Bills',
      month: tx.date.split('-')[1],
      year: tx.date.split('-')[0],
      deductible: false,
      ignored: true,
    };

    const allCategorized = [...categorized, categorized_tx];
    setCategorized(allCategorized);
    setDeductible(false);

    if (indexAtStart < transactions.length - 1) {
      setCurrentIndex(indexAtStart + 1);
      categorizingRef.current = false;
      await loadSuggestedCategory(transactions[indexAtStart + 1]);
    } else {
      await saveSessionToHistory(allCategorized);
    }
  };

  // Sync ref after every render so the keydown listener always calls the latest version
  useEffect(() => {
    handleCategorizeRef.current = handleCategorize;
  });

  if (step === 'resume' && draft) {
    const remaining = draft.transactions.length - draft.currentIndex;
    const cardLabel = CARD_TYPES.find((c) => c.value === draft.selectedCard)?.label ?? draft.selectedCard;
    const savedDate = new Date(draft.savedAt).toLocaleString();
    return (
      <div className="space-y-6">
        <h1 className="text-4xl font-bold text-slate-900">Resume Upload</h1>
        <div className="bg-amber-50 border-4 border-amber-400 rounded-2xl p-8 space-y-4">
          <p className="text-2xl font-bold text-amber-900">You have an upload in progress</p>
          <div className="text-lg text-amber-800 space-y-1">
            <p><span className="font-bold">Card:</span> {cardLabel}</p>
            <p><span className="font-bold">Progress:</span> {draft.categorized.length} of {draft.transactions.length} categorized ({remaining} remaining)</p>
            <p><span className="font-bold">Last saved:</span> {savedDate}</p>
          </div>
        </div>
        <div className="flex gap-4">
          <button
            onClick={handleResumeDraft}
            className="flex-1 px-8 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold text-xl"
          >
            Resume Where I Left Off
          </button>
          <button
            onClick={handleDiscardDraft}
            className="px-8 py-4 bg-white text-slate-700 border-4 border-slate-300 rounded-xl hover:bg-slate-50 font-bold text-xl"
          >
            Start Fresh
          </button>
        </div>
      </div>
    );
  }

  if (step === 'select') {
    return (
      <div className="space-y-6">
        <h1 className="text-4xl font-bold text-slate-900">Upload Statement</h1>
        <p className="text-xl text-slate-700">Select your credit card to upload a statement</p>
        <div className="grid grid-cols-2 gap-6">
          {CARD_TYPES.map((card) => (
            <button
              key={card.value}
              onClick={() => handleCardSelect(card.value)}
              className="p-6 border-4 border-blue-400 rounded-xl hover:bg-blue-100 hover:border-blue-600 transition text-left bg-blue-50 shadow-lg"
            >
              <div className="font-bold text-2xl text-blue-900">{card.label}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (step === 'upload') {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setStep('select')}
            className="px-4 py-2 rounded-lg border-2 border-slate-300 bg-white text-slate-700 font-semibold text-sm hover:bg-slate-50 transition"
          >
            ← Back
          </button>
          <h1 className="text-4xl font-bold text-slate-900">Upload CSV</h1>
        </div>
        <p className="text-xl text-slate-700">
          Upload your {CARD_TYPES.find((c) => c.value === selectedCard)?.label} statement
        </p>
        <div className="border-4 border-dashed border-blue-400 rounded-2xl p-16 text-center bg-blue-50">
          <Upload className="w-16 h-16 text-blue-600 mx-auto mb-4" />
          <p className="text-2xl font-bold text-blue-900 mb-6">Drag and drop your CSV file here</p>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="hidden"
            id="csv-upload"
          />
          <label
            htmlFor="csv-upload"
            className="inline-block px-8 py-4 bg-blue-600 text-white rounded-xl cursor-pointer hover:bg-blue-700 font-bold text-lg"
          >
            Choose File
          </label>
        </div>
        {formatWarning && (
          <div className="p-4 bg-amber-50 text-amber-900 rounded-xl border-2 border-amber-400 font-semibold text-sm">
            Format check failed — {formatWarning} The file will still be parsed, but results may be incorrect.
          </div>
        )}
        {error && <div className="p-6 bg-red-100 text-red-900 rounded-xl border-4 border-red-300 font-semibold text-lg">{error}</div>}
        {loading && <div className="p-6 bg-blue-100 text-blue-900 rounded-xl border-4 border-blue-300 font-semibold text-lg">Parsing CSV...</div>}
      </div>
    );
  }

  const handleGoBack = async () => {
    if (currentIndex === 0) return;
    const prevIndex = currentIndex - 1;
    setCategorized((prev) => prev.slice(0, -1));
    setCurrentIndex(prevIndex);
    await loadSuggestedCategory(transactions[prevIndex]);
  };

  if (step === 'categorize') {
    const tx = transactions[currentIndex];
    const isCredit = tx.type === 'credit';

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold text-slate-900">Categorize Transactions</h1>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
              Progress auto-saved
            </span>
            <p className="text-2xl font-bold text-blue-600 bg-blue-100 px-4 py-2 rounded-lg">
              {currentIndex + 1} of {transactions.length}
            </p>
          </div>
        </div>

        <div className={`rounded-xl p-8 border-4 space-y-6 ${isCredit ? 'bg-green-50 border-green-300' : 'bg-blue-50 border-blue-300'}`}>
          {isCredit && (
            <div className="inline-block px-3 py-1 bg-green-200 text-green-800 rounded-full text-sm font-bold">
              + Credit / Reimbursement
            </div>
          )}
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-lg font-bold text-slate-700">Date</p>
              <p className="text-2xl font-bold text-slate-900">{tx.date}</p>
            </div>
            <div>
              <p className="text-lg font-bold text-slate-700">Amount</p>
              <p className={`text-2xl font-bold ${isCredit ? 'text-green-700' : 'text-slate-900'}`}>
                {isCredit ? '+' : '-'}${tx.amount.toFixed(2)}
              </p>
            </div>
            <div className="col-span-2">
              <p className="text-lg font-bold text-slate-700">Merchant</p>
              <p className="text-3xl font-bold text-slate-900">{applyVendorRules(tx.merchant, vendorRules)}</p>
              {applyVendorRules(tx.merchant, vendorRules) !== tx.merchant && (
                <p className="text-xs text-slate-400 mt-0.5">Original: {tx.merchant}</p>
              )}
              {tx.address && (
                <a
                  href={`https://www.google.com/search?q=${encodeURIComponent(`${tx.merchant} ${tx.address}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-1 text-base font-semibold text-blue-600 hover:underline"
                >
                  {tx.address} ↗
                </a>
              )}
            </div>
            <div>
              <p className="text-lg font-bold text-slate-700">Card</p>
              <p className="text-xl font-semibold text-slate-800">
                {CARD_TYPES.find((c) => c.value === tx.card)?.label ?? tx.card}
              </p>
            </div>
            {tx.sourceCategory && (
              <div>
                <p className="text-lg font-bold text-slate-700">Bank Category</p>
                <p className="text-xl font-semibold text-slate-800">{tx.sourceCategory}</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <p className="text-sm font-bold text-slate-600 uppercase tracking-wide">Tax Status:</p>
          <div className="flex rounded-lg border-2 border-slate-200 overflow-hidden text-sm font-bold">
            <button
              onClick={() => setDeductible(false)}
              className={`px-4 py-2 transition ${!deductible ? 'bg-slate-200 text-slate-800' : 'bg-white text-slate-400 hover:bg-slate-50'}`}
            >
              Not Deductible
            </button>
            <button
              onClick={() => setDeductible(true)}
              className={`px-4 py-2 transition ${deductible ? 'bg-green-500 text-white' : 'bg-white text-slate-400 hover:bg-slate-50'}`}
            >
              Tax Deductible
            </button>
          </div>
        </div>

        {isCredit ? (
          <div className="space-y-3">
            <p className="text-sm font-bold text-green-700 uppercase tracking-wide">Which expense category does this credit apply to?</p>
            <div className="grid grid-cols-3 gap-1.5">
              {categories.map((cat) => {
                const isHighlighted = hoveredCat === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => handleCategorize(cat as Category)}
                    onMouseEnter={() => setHoveredCat(cat)}
                    onMouseLeave={() => setHoveredCat(null)}
                    className={`px-2 py-1.5 rounded-lg border-2 transition font-semibold text-xs text-left focus:outline-none ${
                      isHighlighted
                        ? 'bg-green-100 border-green-500 text-green-900'
                        : 'bg-white border-gray-200 text-slate-800 hover:bg-gray-100 hover:border-green-400'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
            <div className="border-t border-slate-200 pt-3 flex items-center gap-4">
              <button
                onClick={handleSkipRefundCategory}
                className="px-5 py-2 rounded-lg border-2 border-slate-300 bg-white text-slate-500 font-semibold text-sm hover:bg-slate-100 hover:border-slate-400 hover:text-slate-700 transition"
              >
                General refund — no specific category
              </button>
              <button
                onClick={handleIgnore}
                className="px-4 py-2 rounded-lg border-2 border-red-200 bg-white text-red-400 font-semibold text-sm hover:bg-red-50 hover:text-red-600 transition"
              >
                Ignore
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-sm font-bold text-slate-600 uppercase tracking-wide">Select Category:</p>
              <div className="grid grid-cols-3 gap-1.5">
                {categories.map((cat) => {
                  const isHighlighted = hoveredCat === cat || (!hoveredCat && suggestedCategory === cat);
                  return (
                    <button
                      key={cat}
                      onClick={() => handleCategorize(cat as Category)}
                      onMouseEnter={() => setHoveredCat(cat)}
                      onMouseLeave={() => setHoveredCat(null)}
                      className={`px-2 py-1.5 rounded-lg border-2 transition font-semibold text-xs text-left focus:outline-none ${
                        isHighlighted
                          ? 'bg-green-100 border-green-500 text-green-900'
                          : 'bg-white border-gray-200 text-slate-800 hover:bg-gray-100 hover:border-blue-400'
                      }`}
                    >
                      {cat}{isHighlighted && <span className="ml-1 text-green-600">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-slate-200 pt-4">
              <button
                onClick={handleIgnore}
                className="px-5 py-2 rounded-lg border-2 border-slate-300 bg-white text-slate-500 font-semibold text-sm hover:bg-slate-100 hover:border-slate-400 hover:text-slate-700 transition"
                title="Skip this transaction — it won't appear in dashboards or Google Sheets"
              >
                Ignore transaction
              </button>
              <p className="mt-1.5 text-xs text-slate-400">Hidden from dashboards and Sheets. You can un-ignore later from History.</p>
            </div>
          </>
        )}

        {currentIndex > 0 && (
          <button
            onClick={handleGoBack}
            className="px-4 py-2 rounded-lg border-2 border-slate-300 bg-white text-slate-700 font-semibold text-sm hover:bg-slate-50 transition"
          >
            ← Back to previous transaction
          </button>
        )}
      </div>
    );
  }

  if (step === 'checking-categorize') {
    const expenses = checkingRows.filter((r) => r.rowType === 'expense');
    const expense = expenses[checkingExpenseIndex];

    const handlePickCategory = (category: Category) => {
      const newOverrides = {
        ...checkingOverrides,
        [checkingExpenseIndex]: { description: checkingCurrentDesc.trim() || expense.description, category, deductible },
      };
      setCheckingOverrides(newOverrides);
      setDeductible(false);

      const nextIndex = checkingExpenseIndex + 1;
      if (nextIndex < expenses.length) {
        const nextExpense = expenses[nextIndex];
        const nextDesc = newOverrides[nextIndex]?.description ?? nextExpense.merchantName ?? nextExpense.description;
        setCheckingExpenseIndex(nextIndex);
        setCheckingCurrentDesc(nextDesc);
        setSuggestedCategory(null);
        loadCheckingExpenseSuggestion(nextDesc);
      } else {
        saveCheckingToHistory(newOverrides);
      }
    };

    const saveCheckingToHistory = async (overrides: Record<number, { description: string; category: string; deductible: boolean; ignored?: boolean }>) => {
      setLoading(true);
      setError('');
      try {
        // Apply overrides to expense rows
        const expenseIndices: number[] = [];
        checkingRows.forEach((r, i) => { if (r.rowType === 'expense') expenseIndices.push(i); });
        const finalRows = checkingRows.map((r, i) => {
          const expIdx = expenseIndices.indexOf(i);
          if (expIdx === -1 || !overrides[expIdx]) return r;
          return { ...r, description: overrides[expIdx].description, suggestedCategory: overrides[expIdx].category, deductible: overrides[expIdx].deductible };
        });

        // Build typed payloads
        const incomeEntries = finalRows
          .filter((r) => r.rowType === 'income_w2' || r.rowType === 'income_efuture')
          .map((r, i) => ({
            id: `${Date.now()}-inc-${i}`,
            date: r.date,
            source: r.rowType === 'income_w2' ? 'W2' as const : 'Efuture' as const,
            amount: r.amount,
            month: r.month,
            year: r.year,
            description: r.description,
          }));

        // Credits (tax refunds, reimbursements) go into income, not transactions
        const creditEntries = finalRows
          .filter((r) => r.rowType === 'credit')
          .map((r, i) => ({
            id: `${Date.now()}-cred-${i}`,
            date: r.date,
            source: 'Credit' as const,
            amount: r.amount,
            month: r.month,
            year: r.year,
            description: r.description,
          }));

        const incomeRows = [...incomeEntries, ...creditEntries];

        const savingsRows = finalRows
          .filter((r) => r.rowType === 'savings')
          .map((r, i) => ({
            id: `${Date.now()}-sav-${i}`,
            date: r.date,
            institution: r.institution ?? 'Unknown',
            entryType: 'hy-savings' as const,
            amount: r.amount,
            month: r.month,
            year: r.year,
          }));

        const investmentTransactions = finalRows
          .filter((r) => r.rowType === 'investment')
          .map((r, i) => ({
            id: `${Date.now()}-inv-${i}`,
            date: r.date,
            merchant: r.institution ?? r.description,
            amount: r.amount,
            card: selectedCard,
            category: 'Investments' as Category,
            month: r.month,
            year: r.year,
            type: 'expense' as const,
            deductible: false,
          }));

        let expIdx = 0;
        const expenseTransactions = finalRows
          .filter((r) => r.rowType === 'expense')
          .map((r, i) => {
            const override = overrides[expIdx];
            const txDeductible = override?.deductible ?? false;
            const txIgnored = override?.ignored ?? false;
            expIdx++;
            return {
              id: `${Date.now()}-tx-${i}`,
              date: r.date,
              merchant: r.description || r.merchantName,
              amount: r.amount,
              card: selectedCard,
              category: r.suggestedCategory ?? 'Bills',
              month: r.month,
              year: r.year,
              type: 'expense' as const,
              deductible: txDeductible,
              ...(txIgnored && { ignored: true }),
            };
          });

        const transactions = [...expenseTransactions, ...investmentTransactions] as Transaction[];
        const expenseCount = transactions.filter((t) => !t.ignored).length;
        const creditCount = creditEntries.length;
        const totalAmount = transactions.filter((t) => !t.ignored).reduce((s, t) => s + t.amount, 0);
        const cardLabel = CARD_TYPES.find((c) => c.value === selectedCard)?.label ?? selectedCard;

        const response = await fetch('/api/upload-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            card: selectedCard,
            cardLabel,
            transactions,
            expenseCount,
            creditCount,
            totalAmount,
            sessionType: 'checking',
            incomeRows,
            savingsRows,
          }),
        });
        if (!response.ok) throw new Error('Failed to save to history');
        clearDraft();
        setStep('complete');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save');
      } finally {
        setLoading(false);
      }
    };

    const handleCheckingIgnore = () => {
      const newOverrides = {
        ...checkingOverrides,
        [checkingExpenseIndex]: { description: checkingCurrentDesc.trim() || expense.description, category: suggestedCategory ?? 'Bills', deductible: false, ignored: true },
      };
      setCheckingOverrides(newOverrides);
      setDeductible(false);

      const nextIndex = checkingExpenseIndex + 1;
      if (nextIndex < expenses.length) {
        const nextExpense = expenses[nextIndex];
        const nextDesc = newOverrides[nextIndex]?.description ?? nextExpense.merchantName ?? nextExpense.description;
        setCheckingExpenseIndex(nextIndex);
        setCheckingCurrentDesc(nextDesc);
        setSuggestedCategory(null);
        loadCheckingExpenseSuggestion(nextDesc);
      } else {
        saveCheckingToHistory(newOverrides);
      }
    };

    checkingExpenseHandleRef.current = handlePickCategory;

    if (!expense) return null;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold text-slate-900">Categorize Expenses</h1>
          <p className="text-2xl font-bold text-blue-600 bg-blue-100 px-4 py-2 rounded-lg">
            {checkingExpenseIndex + 1} of {expenses.length}
          </p>
        </div>

        <div className="rounded-xl p-8 border-4 bg-red-50 border-red-200 space-y-5">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wide">Date</p>
              <p className="text-2xl font-bold text-slate-900">{expense.date}</p>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wide">Amount</p>
              <p className="text-2xl font-bold text-red-800">−${expense.amount.toFixed(2)}</p>
            </div>
            <div className="col-span-2">
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-1">Bank Description</p>
              <p className="text-xs text-slate-400 font-mono bg-slate-100 rounded px-2 py-1 truncate">{expense.description}</p>
            </div>
          </div>

          <div>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-wide mb-1">Your Label</p>
            <input
              type="text"
              value={checkingCurrentDesc}
              onChange={(e) => setCheckingCurrentDesc(e.target.value)}
              onBlur={() => { if (checkingCurrentDesc.trim()) loadCheckingExpenseSuggestion(checkingCurrentDesc.trim()); }}
              placeholder="e.g. January Rent, Grocery run, etc."
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 focus:border-blue-400 focus:outline-none text-lg font-semibold text-slate-900 bg-white"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <p className="text-sm font-bold text-slate-600 uppercase tracking-wide">Tax Status:</p>
          <div className="flex rounded-lg border-2 border-slate-200 overflow-hidden text-sm font-bold">
            <button
              onClick={() => setDeductible(false)}
              className={`px-4 py-2 transition ${!deductible ? 'bg-slate-200 text-slate-800' : 'bg-white text-slate-400 hover:bg-slate-50'}`}
            >
              Not Deductible
            </button>
            <button
              onClick={() => setDeductible(true)}
              className={`px-4 py-2 transition ${deductible ? 'bg-green-500 text-white' : 'bg-white text-slate-400 hover:bg-slate-50'}`}
            >
              Tax Deductible
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-bold text-slate-600 uppercase tracking-wide">Select Category:</p>
          <div className="grid grid-cols-3 gap-1.5">
            {categories.map((cat) => {
              const isHighlighted = hoveredCat === cat || (!hoveredCat && suggestedCategory === cat);
              return (
                <button
                  key={cat}
                  onClick={() => handlePickCategory(cat as Category)}
                  onMouseEnter={() => setHoveredCat(cat)}
                  onMouseLeave={() => setHoveredCat(null)}
                  className={`px-2 py-1.5 rounded-lg border-2 transition font-semibold text-xs text-left focus:outline-none ${
                    isHighlighted
                      ? 'bg-green-100 border-green-500 text-green-900'
                      : 'bg-white border-gray-200 text-slate-800 hover:bg-gray-100 hover:border-blue-400'
                  }`}
                >
                  {cat}{isHighlighted && <span className="ml-1 text-green-600">✓</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="border-t border-slate-200 pt-4">
          <button
            onClick={handleCheckingIgnore}
            className="px-5 py-2 rounded-lg border-2 border-slate-300 bg-white text-slate-500 font-semibold text-sm hover:bg-slate-100 hover:border-slate-400 hover:text-slate-700 transition"
            title="Skip this expense — it won't appear in dashboards or Google Sheets"
          >
            Ignore transaction
          </button>
          <p className="mt-1.5 text-xs text-slate-400">Hidden from dashboards and Sheets. You can un-ignore later from History.</p>
        </div>

        {checkingExpenseIndex > 0 && (
          <button
            onClick={() => {
              const prevIndex = checkingExpenseIndex - 1;
              setCheckingExpenseIndex(prevIndex);
              setCheckingCurrentDesc(checkingOverrides[prevIndex]?.description ?? expenses[prevIndex].merchantName ?? expenses[prevIndex].description);
              setSuggestedCategory((checkingOverrides[prevIndex]?.category as Category) ?? null);
              setDeductible(checkingOverrides[prevIndex]?.deductible ?? false);
            }}
            className="px-4 py-2 rounded-lg border-2 border-slate-300 bg-white text-slate-700 font-semibold text-sm hover:bg-slate-50"
          >
            ← Back to previous expense
          </button>
        )}

        {error && <div className="p-4 bg-red-100 text-red-900 rounded-xl border-2 border-red-300 font-semibold">{error}</div>}
        {loading && <div className="p-4 bg-blue-100 text-blue-900 rounded-xl border-2 border-blue-300 font-semibold">Saving to Sheets...</div>}
      </div>
    );
  }

  if (step === 'checking-review') {
    const income = checkingRows.filter((r) => r.rowType === 'income_w2' || r.rowType === 'income_efuture');
    const savings = checkingRows.filter((r) => r.rowType === 'savings');
    const investments = checkingRows.filter((r) => r.rowType === 'investment');
    const expenses = checkingRows.filter((r) => r.rowType === 'expense');
    const credits = checkingRows.filter((r) => r.rowType === 'credit');
    const totalIncome = income.reduce((s, r) => s + r.amount, 0);
    const totalSavings = savings.reduce((s, r) => s + r.amount, 0);
    const totalInvestments = investments.reduce((s, r) => s + r.amount, 0);

    const handleReviewContinue = () => {
      if (expenses.length > 0) {
        setCheckingExpenseIndex(0);
        setCheckingOverrides({});
        setCheckingCurrentDesc(expenses[0].merchantName ?? expenses[0].description);
        loadCheckingExpenseSuggestion(expenses[0].merchantName ?? expenses[0].description);
        setStep('checking-categorize');
      } else {
        // No expenses — save directly to history with no overrides
        saveCheckingToHistoryNoExpenses();
      }
    };

    const saveCheckingToHistoryNoExpenses = async () => {
      setLoading(true);
      setError('');
      try {
        const incomeRows = checkingRows
          .filter((r) => r.rowType === 'income_w2' || r.rowType === 'income_efuture')
          .map((r, i) => ({
            id: `${Date.now()}-inc-${i}`,
            date: r.date,
            source: r.rowType === 'income_w2' ? 'W2' : 'Efuture',
            amount: r.amount,
            month: r.month,
            year: r.year,
            description: r.description,
          }));
        const savingsRows = checkingRows
          .filter((r) => r.rowType === 'savings')
          .map((r, i) => ({
            id: `${Date.now()}-sav-${i}`,
            date: r.date,
            institution: r.institution ?? 'Unknown',
            entryType: 'hy-savings' as const,
            amount: r.amount,
            month: r.month,
            year: r.year,
          }));
        const investmentTransactions = checkingRows
          .filter((r) => r.rowType === 'investment')
          .map((r, i) => ({
            id: `${Date.now()}-inv-${i}`,
            date: r.date,
            merchant: r.institution ?? r.description,
            amount: r.amount,
            card: selectedCard,
            category: 'Investments' as Category,
            month: r.month,
            year: r.year,
            type: 'expense' as const,
            deductible: false,
          }));
        // Credits (tax refunds, reimbursements) go into incomeRows, not transactions
        const creditEntries = checkingRows
          .filter((r) => r.rowType === 'credit')
          .map((r, i) => ({
            id: `${Date.now()}-cred-${i}`,
            date: r.date,
            source: 'Credit' as const,
            amount: r.amount,
            month: r.month,
            year: r.year,
            description: r.description,
          }));
        const allIncomeRows = [...incomeRows, ...creditEntries];
        const cardLabel = CARD_TYPES.find((c) => c.value === selectedCard)?.label ?? selectedCard;
        const response = await fetch('/api/upload-history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            card: selectedCard, cardLabel,
            transactions: investmentTransactions,
            expenseCount: investmentTransactions.length, creditCount: creditEntries.length,
            totalAmount: investmentTransactions.reduce((s, t) => s + t.amount, 0),
            sessionType: 'checking', incomeRows: allIncomeRows, savingsRows,
          }),
        });
        if (!response.ok) throw new Error('Failed to save to history');
        clearDraft();
        setStep('complete');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save');
      } finally {
        setLoading(false);
      }
    };

    const ReviewSection = ({ title, rows, color, amountLabel }: {
      title: string;
      rows: CheckingRow[];
      color: string;
      amountLabel?: string;
    }) => rows.length === 0 ? null : (
      <div className={`rounded-xl border-2 p-5 ${color}`}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-lg">{title}</h3>
          <span className="font-bold text-lg">{amountLabel ?? `$${rows.reduce((s, r) => s + r.amount, 0).toFixed(2)}`}</span>
        </div>
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <div>
                <span className="text-slate-500 mr-2">{r.date}</span>
                <span className="truncate">{r.institution ?? r.description.slice(0, 50)}</span>
              </div>
              <span className="font-semibold ml-3 shrink-0">${r.amount.toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>
    );

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold text-slate-900">Review Checking Statement</h1>
          <p className="text-lg font-semibold text-slate-600">{CARD_TYPES.find((c) => c.value === selectedCard)?.label}</p>
        </div>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-blue-700">Income</p>
            <p className="text-3xl font-bold text-blue-900">${totalIncome.toFixed(2)}</p>
            <p className="text-xs text-blue-600">{income.length} entries</p>
          </div>
          <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-emerald-700">HY Savings</p>
            <p className="text-3xl font-bold text-emerald-900">${totalSavings.toFixed(2)}</p>
            <p className="text-xs text-emerald-600">{savings.length} transfers</p>
          </div>
          <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-purple-700">Investments</p>
            <p className="text-3xl font-bold text-purple-900">${totalInvestments.toFixed(2)}</p>
            <p className="text-xs text-purple-600">{investments.length} transfers</p>
          </div>
        </div>

        <div className="space-y-4">
          <ReviewSection title="Income" rows={income} color="bg-blue-50 border-blue-200 text-blue-900" />
          <ReviewSection title="HY Savings Transfers" rows={savings} color="bg-emerald-50 border-emerald-200 text-emerald-900" />
          <ReviewSection title="Investment Transfers" rows={investments} color="bg-purple-50 border-purple-200 text-purple-900" />
          <ReviewSection title="Expenses" rows={expenses} color="bg-red-50 border-red-200 text-red-900" />
          <ReviewSection title="Credits / Reimbursements" rows={credits} color="bg-green-50 border-green-200 text-green-900" />
        </div>

        {error && <div className="p-4 bg-red-100 text-red-900 rounded-xl border-2 border-red-300 font-semibold">{error}</div>}

        <div className="flex gap-4">
          <button
            onClick={handleReviewContinue}
            disabled={loading}
            className="flex-1 px-8 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold text-xl disabled:opacity-50"
          >
            {loading ? 'Saving to History...' : expenses.length > 0 ? `Categorize ${expenses.length} Expense${expenses.length > 1 ? 's' : ''} →` : 'Save to History →'}
          </button>
          <button
            onClick={() => { setStep('upload'); setCheckingRows([]); }}
            className="px-8 py-4 bg-white text-slate-700 border-4 border-slate-300 rounded-xl hover:bg-slate-50 font-bold text-lg"
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  const creditCount = categorized.filter((t) => t.type === 'credit').length;
  const expenseCount = categorized.length - creditCount;

  // For checking sessions, build a summary from the parsed rows (categorized is always empty for them)
  const isCheckingSession = CHECKING_TYPES.has(selectedCard);
  const checkingSummaryParts: string[] = [];
  if (isCheckingSession) {
    const incCnt = checkingRows.filter((r) => r.rowType === 'income_w2' || r.rowType === 'income_efuture').length;
    const credCnt = checkingRows.filter((r) => r.rowType === 'credit').length;
    const savCnt = checkingRows.filter((r) => r.rowType === 'savings').length;
    const invCnt = checkingRows.filter((r) => r.rowType === 'investment').length;
    const expCnt = checkingRows.filter((r) => r.rowType === 'expense').length;
    if (incCnt > 0) checkingSummaryParts.push(`${incCnt} income`);
    if (savCnt > 0) checkingSummaryParts.push(`${savCnt} savings`);
    if (invCnt > 0) checkingSummaryParts.push(`${invCnt} investments`);
    if (expCnt > 0) checkingSummaryParts.push(`${expCnt} expenses`);
    if (credCnt > 0) checkingSummaryParts.push(`${credCnt} credits`);
  }

  return (
    <div className="space-y-8 text-center">
      <div className="bg-green-50 rounded-2xl p-12 border-4 border-green-300">
        <h1 className="text-5xl font-bold text-green-900 mb-4">✓ Saved to History!</h1>
        <p className="text-2xl font-bold text-green-800">
          {isCheckingSession
            ? checkingSummaryParts.join(' · ')
            : `${expenseCount} expenses · ${creditCount} credits`}
        </p>
        <p className="text-lg text-green-700 mt-3">Go to History to review and commit to Google Sheets when ready.</p>
      </div>
      <div className="flex justify-center gap-4">
        <a
          href="/history"
          className="px-10 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold text-xl"
        >
          Go to History →
        </a>
        <button
          onClick={() => {
            clearDraft();
            setStep('select');
            setSelectedCard('');
            setTransactions([]);
            setCategorized([]);
            setCurrentIndex(0);
          }}
          className="px-10 py-4 bg-white text-slate-700 border-4 border-slate-300 rounded-xl hover:bg-slate-50 font-bold text-xl"
        >
          Upload Another
        </button>
      </div>
    </div>
  );
}
