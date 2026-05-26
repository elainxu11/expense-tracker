'use client';

import { useState } from 'react';
import { Upload, ChevronRight } from 'lucide-react';
import { ParsedTransaction, Transaction, Category } from '@/lib/types';

const CARD_TYPES = [
  { value: 'amex', label: 'American Express' },
  { value: 'capital-one', label: 'Capital One Venture X' },
  { value: 'discover', label: 'Discover' },
  { value: 'venmo', label: 'Venmo' },
  { value: 'bofa', label: 'Bank of America' },
  { value: 'other', label: 'Other / Miscellaneous' },
];

export default function UploadPage() {
  const [step, setStep] = useState<'select' | 'upload' | 'categorize' | 'complete'>(
    'select'
  );
  const [selectedCard, setSelectedCard] = useState<string>('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [transactions, setTransactions] = useState<ParsedTransaction[]>([]);
  const [categorized, setCategorized] = useState<Transaction[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [suggestedCategory, setSuggestedCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const handleCardSelect = (cardType: string) => {
    setSelectedCard(cardType);
    setStep('upload');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    setLoading(true);
    setError('');

    try {
      const text = await file.text();
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
    try {
      const response = await fetch('/api/suggest-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchant: transaction.merchant, amexCategory: transaction.amexCategory }),
      });
      if (response.ok) {
        const data = await response.json();
        setSuggestedCategory(data.category);
      }
    } catch {
      setSuggestedCategory('Shopping');
    }
  };

  const handleCategorize = async (category: Category) => {
    const tx = transactions[currentIndex];
    const categorized_tx: Transaction = {
      id: `${Date.now()}-${currentIndex}`,
      ...tx,
      category,
      month: new Date(tx.date).toLocaleString('default', { month: '2-digit' }),
      year: new Date(tx.date).getFullYear().toString(),
    };

    setCategorized([...categorized, categorized_tx]);

    if (currentIndex < transactions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      await loadSuggestedCategory(transactions[currentIndex + 1]);
    } else {
      setStep('complete');
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/save-transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions: categorized }),
      });

      if (!response.ok) throw new Error('Failed to save transactions');
      setStep('complete');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

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
        <h1 className="text-4xl font-bold text-slate-900">Upload CSV</h1>
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
        {error && <div className="p-6 bg-red-100 text-red-900 rounded-xl border-4 border-red-300 font-semibold text-lg">{error}</div>}
        {loading && <div className="p-6 bg-blue-100 text-blue-900 rounded-xl border-4 border-blue-300 font-semibold text-lg">Parsing CSV...</div>}
      </div>
    );
  }

  if (step === 'categorize') {
    const tx = transactions[currentIndex];
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-bold text-slate-900">Categorize Transactions</h1>
          <p className="text-2xl font-bold text-blue-600 bg-blue-100 px-4 py-2 rounded-lg">
            {currentIndex + 1} of {transactions.length}
          </p>
        </div>

        <div className="bg-blue-50 rounded-xl p-8 border-4 border-blue-300 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <p className="text-lg font-bold text-slate-700">Date</p>
              <p className="text-2xl font-bold text-slate-900">{tx.date}</p>
            </div>
            <div>
              <p className="text-lg font-bold text-slate-700">Amount</p>
              <p className="text-2xl font-bold text-slate-900">${tx.amount.toFixed(2)}</p>
            </div>
            <div className="col-span-2">
              <p className="text-lg font-bold text-slate-700">Merchant</p>
              <p className="text-3xl font-bold text-slate-900">{tx.merchant}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-xl font-bold text-slate-900">Select Category:</p>
          <div className="grid grid-cols-2 gap-3">
            {[
              'Bills',
              'Food & Drinks',
              'Groceries',
              'Unnecessary Purchases',
              'Entertainment',
              'Essentials',
              'Shopping',
              'Transport',
              'Travel',
              'Gifts',
              'Investments',
              'Health & Wellness',
              'Efuture',
              'Subscriptions',
            ].map((cat) => (
              <button
                key={cat}
                onClick={() => handleCategorize(cat as Category)}
                className={`p-4 rounded-lg border-3 transition font-semibold text-lg ${
                  suggestedCategory === cat
                    ? 'bg-green-100 border-green-500 text-green-900'
                    : 'bg-white border-gray-300 text-slate-900 hover:bg-gray-100 hover:border-blue-400'
                }`}
              >
                <p>{cat}</p>
                {suggestedCategory === cat && (
                  <p className="text-xs font-bold text-green-700 mt-1">✓ Recommended</p>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 text-center">
      <div className="bg-green-50 rounded-2xl p-12 border-4 border-green-300">
        <h1 className="text-5xl font-bold text-green-900 mb-4">✓ Upload Complete!</h1>
        <p className="text-2xl font-bold text-green-800">
          {categorized.length} transactions categorized and saved
        </p>
      </div>
      <button
        onClick={() => {
          setStep('select');
          setSelectedCard('');
          setTransactions([]);
          setCategorized([]);
          setCurrentIndex(0);
        }}
        className="px-10 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold text-xl"
      >
        Upload Another Statement
      </button>
    </div>
  );
}
