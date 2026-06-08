'use client';

import { useState, useEffect } from 'react';
import { VendorRule } from '@/lib/types';

export default function VendorRulesClient() {
  const [rules, setRules] = useState<VendorRule[]>([]);
  const [pattern, setPattern] = useState('');
  const [pattern2, setPattern2] = useState('');
  const [normalized, setNormalized] = useState('');
  const [matchType, setMatchType] = useState<'prefix' | 'contains' | 'contains-all'>('prefix');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/vendor-rules')
      .then((r) => r.json())
      .then((d) => { if (d.rules) setRules(d.rules); })
      .catch(() => {});
  }, []);

  const handleAdd = async () => {
    const pat = pattern.trim();
    const pat2 = pattern2.trim();
    const norm = normalized.trim();
    if (!pat || !norm) return;
    if (matchType === 'contains-all' && !pat2) return;
    const storedPattern = matchType === 'contains-all' ? `${pat}|${pat2}` : pat;
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/vendor-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pattern: storedPattern, normalized: norm, matchType }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setRules((prev) => {
        const existing = prev.findIndex((r) => r.pattern.toLowerCase() === storedPattern.toLowerCase());
        const next = { pattern: storedPattern, normalized: norm, matchType };
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = next;
          return updated;
        }
        return [...prev, next];
      });
      setPattern('');
      setPattern2('');
      setNormalized('');
    } catch {
      setError('Failed to save rule');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (rulePattern: string) => {
    try {
      await fetch('/api/vendor-rules', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pattern: rulePattern }),
      });
      setRules((prev) => prev.filter((r) => r.pattern !== rulePattern));
    } catch {
      setError('Failed to delete rule');
    }
  };

  return (
    <div className="bg-white rounded-xl border-2 border-slate-200 p-6 shadow-sm">
      <h2 className="text-xl font-bold text-slate-900 mb-1">Vendor Normalization Rules</h2>
      <p className="text-sm text-slate-500 mb-4">
        Merge transactions from the same vendor that appear with different suffixes (e.g.{' '}
        <span className="font-mono bg-slate-100 px-1 rounded">EMPOWER* AHMED FOFANA</span> →{' '}
        <span className="font-mono bg-slate-100 px-1 rounded">EMPOWER</span>). Applies on
        your next upload.
      </p>

      <div className="space-y-2 mb-4">
        {rules.length === 0 && (
          <p className="text-sm text-slate-400">No rules yet.</p>
        )}
        {rules.map((rule) => (
          <div key={rule.pattern} className="flex items-center justify-between px-4 py-2.5 bg-slate-50 rounded-lg gap-3">
            <div className="flex items-center gap-2 min-w-0">
              {rule.matchType === 'contains-all' ? (
                <>
                  <span className="font-mono text-sm text-slate-700 truncate">{rule.pattern.split('|')[0]}</span>
                  <span className="text-slate-400 text-xs shrink-0">AND</span>
                  <span className="font-mono text-sm text-slate-700 truncate">{rule.pattern.split('|')[1]}</span>
                  <span className="text-slate-400 text-xs shrink-0">contains all</span>
                </>
              ) : (
                <>
                  <span className="font-mono text-sm text-slate-700 truncate">{rule.pattern}</span>
                  <span className="text-slate-400 text-xs shrink-0">
                    {rule.matchType === 'prefix' ? 'starts with' : 'contains'}
                  </span>
                </>
              )}
              <span className="text-slate-400 shrink-0">→</span>
              <span className="font-semibold text-sm text-slate-900 truncate">{rule.normalized}</span>
            </div>
            <button
              onClick={() => handleDelete(rule.pattern)}
              className="text-sm font-medium text-red-500 hover:text-red-700 shrink-0 transition"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">
              {matchType === 'contains-all' ? 'Word 1' : 'Pattern (what to match)'}
            </label>
            <input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder={matchType === 'contains-all' ? 'e.g. EMPOWER' : 'e.g. EMPOWER*'}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
          {matchType === 'contains-all' && (
            <div className="flex-1">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">
                Word 2
              </label>
              <input
                value={pattern2}
                onChange={(e) => setPattern2(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                placeholder="e.g. AHMED"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
          )}
          <div className="flex-1">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">
              Normalized name
            </label>
            <input
              value={normalized}
              onChange={(e) => setNormalized(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="e.g. EMPOWER"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-400"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">
              Match type
            </label>
            <select
              value={matchType}
              onChange={(e) => {
                setMatchType(e.target.value as 'prefix' | 'contains' | 'contains-all');
                setPattern2('');
              }}
              className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-400 bg-white"
            >
              <option value="prefix">Starts with</option>
              <option value="contains">Contains</option>
              <option value="contains-all">Contains all (AND)</option>
            </select>
          </div>
        </div>
        <button
          onClick={handleAdd}
          disabled={saving || !pattern.trim() || !normalized.trim() || (matchType === 'contains-all' && !pattern2.trim())}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-40 transition"
        >
          Add Rule
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    </div>
  );
}
