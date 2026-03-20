'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface ServiceItem {
  name: string;
  type: string;
  ownerTeam: string;
  id: string;
}

interface SearchBarProps {
  onSelect: (name: string) => void;
  selected?: string;
}

const TEAM_COLORS: Record<string, string> = {
  'sportsbook-celsius': 'bg-blue-500/20 text-blue-300',
  'casino-platform': 'bg-purple-500/20 text-purple-300',
  'sportsbook-50kent': 'bg-sky-500/20 text-sky-300',
  'marketing-features': 'bg-pink-500/20 text-pink-300',
  'casino-features': 'bg-violet-500/20 text-violet-300',
  'services-it': 'bg-green-500/20 text-green-300',
  'platform': 'bg-amber-500/20 text-amber-300',
  'sportsbook-core': 'bg-cyan-500/20 text-cyan-300',
  'retail': 'bg-orange-500/20 text-orange-300',
  'payments': 'bg-emerald-500/20 text-emerald-300',
  'frontend': 'bg-rose-500/20 text-rose-300',
  'marketing-core': 'bg-fuchsia-500/20 text-fuchsia-300',
  'data-warehouse': 'bg-teal-500/20 text-teal-300',
  'ops-devops': 'bg-red-500/20 text-red-300',
  'reporting': 'bg-indigo-500/20 text-indigo-300',
};

export default function SearchBar({ onSelect, selected }: SearchBarProps) {
  const [query, setQuery] = useState(selected || '');
  const [results, setResults] = useState<ServiceItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>(null);

  // Keyboard shortcut: / to focus search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    try {
      const res = await fetch(`/api/services?q=${encodeURIComponent(q)}`);
      const data: ServiceItem[] = await res.json();
      setResults(data);
      setIsOpen(data.length > 0);
      setHighlightIndex(-1);
    } catch {
      setResults([]);
    }
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 150);
  };

  const handleSelect = (name: string) => {
    setQuery(name);
    setIsOpen(false);
    onSelect(name);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && highlightIndex >= 0) {
      e.preventDefault();
      handleSelect(results[highlightIndex].name);
    }
  };

  return (
    <div className="relative w-full max-w-xl">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={e => { results.length > 0 && setIsOpen(true); e.currentTarget.style.borderColor = 'rgba(34, 211, 238, 0.4)'; e.currentTarget.style.boxShadow = '0 0 20px rgba(34, 211, 238, 0.1)'; }}
          onBlur={e => { e.currentTarget.style.borderColor = 'rgba(34, 211, 238, 0.15)'; e.currentTarget.style.boxShadow = 'none'; }}
          placeholder="Search services, charts, tools..."
          className="w-full px-4 py-3 pl-10 rounded-lg transition-all text-cyan-50 placeholder-slate-500 focus:outline-none"
          style={{
            background: 'rgba(6, 18, 32, 0.8)',
            border: '1px solid rgba(34, 211, 238, 0.15)',
          }}
        />
        <svg
          className="absolute left-3 top-3.5 w-4 h-4 text-zinc-500"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <kbd className="absolute right-3 top-3 px-1.5 py-0.5 text-xs text-zinc-500 bg-zinc-700 rounded border border-zinc-600">
          /
        </kbd>
      </div>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 rounded-lg shadow-2xl max-h-80 overflow-y-auto"
          style={{ background: 'rgba(6, 18, 32, 0.95)', border: '1px solid rgba(34, 211, 238, 0.15)', backdropFilter: 'blur(16px)' }}>
          {results.map((item, i) => (
            <button
              key={item.id}
              onClick={() => handleSelect(item.name)}
              className={`w-full px-4 py-2.5 flex items-center justify-between text-left transition-colors
                ${i === highlightIndex ? 'bg-cyan-500/10' : 'hover:bg-white/5'}
                ${i === 0 ? 'rounded-t-lg' : ''}
                ${i === results.length - 1 ? 'rounded-b-lg' : ''}`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-600 text-zinc-300 font-mono">
                  {item.type === 'deployment' ? 'deploy' : item.type === 'helm-chart' ? 'helm' : 'svc'}
                </span>
                <span className="text-zinc-100">{item.name}</span>
              </div>
              {item.ownerTeam && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${TEAM_COLORS[item.ownerTeam] || 'bg-zinc-600 text-zinc-300'}`}>
                  {item.ownerTeam}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
