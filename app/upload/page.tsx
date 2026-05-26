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
        body: JSON.stringify({ merchant: transaction.merchant }),
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
        <h1 className="text-3xl font-bold text-slate-900">Upload Statement</h1>
        <p className="text-slate-600">Select your credit card to upload a statement</p>
        <div className="grid grid-cols-2 gap-4">
          {CARD_TYPES.map((card) => (
            <button
              key={card.value}
              onClick={() => handleCardSelect(card.value)}
              className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 transition text-left"
            >
              <div className="font-medium text-slate-900">{card.label}</div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (step === 'upload') {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-slate-900">Upload CSV</h1>
        <p className="text-slate-600">
          Upload your {CARD_TYPES.find((c) => c.value === selectedCard)?.label} statement
        </p>
        <div className="border-2 border-dashed border-slate-300 rounded-lg p-12 text-center">
          <Upload className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600 mb-4">Drag and drop your CSV file here</p>
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="hidden"
            id="csv-upload"
          />
          <label
            htmlFor="csv-upload"
            className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700"
          >
            Choose File
          </label>
        </div>
        {error && <div className="p-4 bg-red-50 text-red-700 rounded-lg">{error}</div>}
        {loading && <div className="p-4 bg-blue-50 text-blue-700 rounded-lg">Parsing CSV...</div>}
      </div>
    );
  }

  if (step === 'categorize') {
    const tx = transactions[currentIndex];
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-slate-900">Categorize Transactions</h1>
          <p className="text-slate-600">
            {currentIndex + 1} of {transactions.length}
          </p>
        </div>

        <div className="bg-white rounded-lg p-6 border border-slate-200 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-slate-600">Date</p>
              <p className="font-medium text-slate-900">{tx.date}</p>
            </div>
            <div>
              <p className="text-sm text-slate-600">Amount</p>
              <p className="font-medium text-slate-900">${tx.amount.toFixed(2)}</p>
            </div>
            <div className="col-span-2">
              <p className="text-sm text-slate-600">Merchant</p>
              <p className="font-medium text-slate-900 text-lg">{tx.merchant}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-700">Select Category:</p>
          <div className="grid grid-cols-2 gap-2">
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
                className={`p-3 rounded-lg border transition ${
                  suggestedCategory === cat
                    ? 'bg-blue-50 border-blue-300'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <p className="text-sm font-medium text-slate-900">{cat}</p>
                {suggestedCategory === cat && (
                  <p className="text-xs text-blue-600">Recommended</p>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-center">
      <h1 className="text-3xl font-bold text-slate-900">Upload Complete!</h1>
      <p className="text-slate-600 text-lg">
        {categorized.length} transactions categorized and saved
      </p>
      <button
        onClick={() => {
          setStep('select');
          setSelectedCard('');
          setCsvFile(null);
          setTransactions([]);
          setCategorized([]);
          setCurrentIndex(0);
        }}
        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Upload Another Statement
      </button>
    </div>
  );
}
