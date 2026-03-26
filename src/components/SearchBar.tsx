'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

interface SearchItem {
  name: string;
  type: string;
  ownerTeam: string;
  environment: string;
  id: string;
  noLimits?: boolean;
  latestTag?: boolean;
  noLivenessProbe?: boolean;
  singleReplica?: boolean;
}

interface FilterOptions {
  teams: string[];
  environments: string[];
}

interface SearchBarProps {
  onSelect: (name: string) => void;
  selected?: string;
  onOpenGuide?: () => void;
}

const ENV_DOT: Record<string, string> = {
  production: '#ef4444', staging: '#eab308', qa: '#f97316',
  dev: '#22c55e', unknown: '#71717a',
};

const RISK_CHIPS = [
  { label: 'No limits',     token: 'risk:nolimits',  color: 'rgba(239,68,68,0.15)',   text: '#fca5a5', border: 'rgba(239,68,68,0.3)' },
  { label: ':latest tag',   token: 'risk:latest',    color: 'rgba(239,68,68,0.15)',   text: '#fca5a5', border: 'rgba(239,68,68,0.3)' },
  { label: 'No probe',      token: 'risk:noprobe',   color: 'rgba(251,191,36,0.15)',  text: '#fde047', border: 'rgba(251,191,36,0.3)' },
  { label: 'Single replica',token: 'risk:single',    color: 'rgba(251,191,36,0.15)',  text: '#fde047', border: 'rgba(251,191,36,0.3)' },
];

export default function SearchBar({ onSelect, selected, onOpenGuide }: SearchBarProps) {
  const [query, setQuery]                   = useState(selected || '');
  const [results, setResults]               = useState<SearchItem[]>([]);
  const [filterOpts, setFilterOpts]         = useState<FilterOptions>({ teams: [], environments: [] });
  const [isOpen, setIsOpen]                 = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [showBuilder, setShowBuilder]       = useState(false);
  const inputRef    = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const builderRef  = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/services?q=__filters__')
      .then(r => r.json())
      .then(setFilterOpts)
      .catch(() => {});
  }, []);

  // Close builder on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (builderRef.current && !builderRef.current.contains(e.target as Node)) {
        setShowBuilder(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== inputRef.current) {
        e.preventDefault(); inputRef.current?.focus();
      }
      if (e.key === 'Escape') { setIsOpen(false); setShowBuilder(false); inputRef.current?.blur(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const search = useCallback(async (q: string): Promise<void> => {
    if (!q.trim()) { setResults([]); setIsOpen(false); return; }
    try {
      const res  = await fetch(`/api/services?q=${encodeURIComponent(q)}`);
      const data: SearchItem[] = await res.json();
      setResults(data);
      setIsOpen(data.length > 0);
      setHighlightIndex(-1);
    } catch { setResults([]); }
  }, []);

  const handleChange = (value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 150);
  };

  const handleSelect = (name: string) => {
    setQuery(name); setIsOpen(false); setShowBuilder(false); onSelect(name);
  };

  // Add a token to the query, avoiding duplicates of the same filter type
  const addToken = (token: string) => {
    const [key] = token.split(':');
    const existing = query.split(' ').filter(t => !t.startsWith(`${key}:`)).join(' ').trim();
    const newQuery = existing ? `${existing} ${token} ` : `${token} `;
    setQuery(newQuery);
    setShowBuilder(false);  // close builder so dropdown is visible
    search(newQuery).then(() => setIsOpen(true));
    inputRef.current?.focus();
  };

  // Remove a token chip
  const removeToken = (token: string) => {
    const [key] = token.split(':');
    const newQuery = query.split(' ').filter(t => !t.startsWith(`${key}:`)).join(' ').trim();
    setQuery(newQuery);
    if (newQuery.trim()) {
      search(newQuery).then(() => setIsOpen(true));
    } else {
      setResults([]);
      setIsOpen(false);
    }
  };

  const clearAll = () => { setQuery(''); setResults([]); setIsOpen(false); };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setHighlightIndex(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHighlightIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && highlightIndex >= 0) { e.preventDefault(); handleSelect(results[highlightIndex].name); }
  };

  // Parse active tokens from query
  const activeTokens = query.split(' ').filter(t => t.includes(':') && t.split(':')[1]);
  const hasQuery     = query.trim().length > 0;

  return (
    <div className="relative w-full max-w-2xl" ref={builderRef}>

      {/* Input row */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => handleChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={e => {
              if (results.length > 0) setIsOpen(true);
              e.currentTarget.style.borderColor = 'rgba(34,211,238,0.4)';
              e.currentTarget.style.boxShadow   = '0 0 20px rgba(34,211,238,0.08)';
            }}
            onBlur={e => {
              setTimeout(() => setIsOpen(false), 150);
              e.currentTarget.style.borderColor = 'rgba(34,211,238,0.15)';
              e.currentTarget.style.boxShadow   = 'none';
            }}
            placeholder="Search… or use filters →"
            className="w-full px-4 py-2.5 pl-9 pr-20 rounded-lg transition-all text-cyan-50 placeholder-slate-600 focus:outline-none text-sm"
            style={{ background: 'rgba(6,18,32,0.8)', border: '1px solid rgba(34,211,238,0.15)' }}
          />
          <svg className="absolute left-3 top-2.5 w-4 h-4 text-zinc-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {/* Active token chips inside input row */}
          <div className="absolute right-2 top-1.5 flex items-center gap-1">
            {hasQuery && (
              <button onClick={clearAll} className="text-zinc-500 hover:text-zinc-300 transition-colors text-xs px-1">✕</button>
            )}
            {!hasQuery && (
              <kbd className="px-1.5 py-0.5 text-xs text-zinc-500 bg-zinc-800 rounded border border-zinc-700">/</kbd>
            )}
          </div>
        </div>

        {/* Query builder toggle */}
        <button
          onClick={() => setShowBuilder(b => !b)}
          className="flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all shrink-0 whitespace-nowrap"
          style={{
            background: showBuilder ? 'rgba(34,211,238,0.12)' : 'rgba(255,255,255,0.04)',
            border:     `1px solid ${showBuilder ? 'rgba(34,211,238,0.3)' : 'rgba(255,255,255,0.08)'}`,
            color:      showBuilder ? '#22d3ee' : '#71717a',
          }}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
          Filters
          {activeTokens.length > 0 && (
            <span className="w-4 h-4 rounded-full bg-cyan-500 text-black text-[9px] font-black flex items-center justify-center">
              {activeTokens.length}
            </span>
          )}
        </button>

        {/* ? Guide button — next to filters */}
        {onOpenGuide && (
          <button
            onClick={onOpenGuide}
            className="w-9 h-9 flex items-center justify-center rounded-lg text-xs font-bold transition-all shrink-0"
            style={{ color: '#22d3ee', background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.15)' }}
            title="Mission Briefing"
          >
            ?
          </button>
        )}
      </div>

      {/* Active token chips below input */}
      {activeTokens.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {activeTokens.map(t => {
            const [key, val] = t.split(':');
            const isRisk = key === 'risk';
            const isEnv  = key === 'env';
            return (
              <span key={t}
                className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-mono"
                style={{
                  background: isRisk ? 'rgba(239,68,68,0.12)' : isEnv ? `${ENV_DOT[val] || '#71717a'}20` : 'rgba(34,211,238,0.1)',
                  color:      isRisk ? '#fca5a5' : isEnv ? (ENV_DOT[val] || '#a1a1aa') : '#67e8f9',
                  border:     `1px solid ${isRisk ? 'rgba(239,68,68,0.25)' : isEnv ? `${ENV_DOT[val] || '#71717a'}40` : 'rgba(34,211,238,0.2)'}`,
                }}
              >
                {isEnv && <span className="w-1.5 h-1.5 rounded-full" style={{ background: ENV_DOT[val] || '#71717a' }} />}
                <span className="text-zinc-400">{key}:</span>{val}
                <button onClick={() => removeToken(t)} className="ml-0.5 opacity-50 hover:opacity-100 transition-opacity">✕</button>
              </span>
            );
          })}
          <button onClick={clearAll} className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors px-1">
            clear all
          </button>
        </div>
      )}

      {/* Query Builder Panel */}
      {showBuilder && (
        <div
          className="absolute z-50 w-full mt-2 rounded-xl shadow-2xl p-4 space-y-4"
          style={{ background: 'rgba(6,18,32,0.98)', border: '1px solid rgba(34,211,238,0.15)', backdropFilter: 'blur(24px)', top: '100%' }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Query Builder</span>
            <span className="text-[11px] text-zinc-600 font-mono">click chips to add to search</span>
          </div>

          {/* Environment filter */}
          {filterOpts.environments.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Environment</p>
              <div className="flex flex-wrap gap-2">
                {filterOpts.environments.map(env => {
                  const active = query.includes(`env:${env}`);
                  return (
                    <button key={env}
                      onClick={() => active ? removeToken(`env:${env}`) : addToken(`env:${env}`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                      style={{
                        background: active ? `${ENV_DOT[env] || '#71717a'}25` : 'rgba(255,255,255,0.04)',
                        border:     `1px solid ${active ? (ENV_DOT[env] || '#71717a') : 'rgba(255,255,255,0.1)'}`,
                        color:      active ? (ENV_DOT[env] || '#a1a1aa') : '#a1a1aa',
                        transform:  active ? 'scale(1.04)' : 'scale(1)',
                      }}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ background: ENV_DOT[env] || '#71717a' }} />
                      {env}
                      {active && <span className="ml-0.5 text-[10px]">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Team filter */}
          {filterOpts.teams.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Team</p>
              <div className="flex flex-wrap gap-2">
                {filterOpts.teams.map(team => {
                  const active = query.includes(`team:${team}`);
                  return (
                    <button key={team}
                      onClick={() => active ? removeToken(`team:${team}`) : addToken(`team:${team}`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                      style={{
                        background: active ? 'rgba(34,211,238,0.12)' : 'rgba(255,255,255,0.04)',
                        border:     `1px solid ${active ? 'rgba(34,211,238,0.35)' : 'rgba(255,255,255,0.1)'}`,
                        color:      active ? '#67e8f9' : '#a1a1aa',
                        transform:  active ? 'scale(1.04)' : 'scale(1)',
                      }}
                    >
                      {team}
                      {active && <span className="ml-0.5 text-[10px]">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Risk filter */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Risk flags</p>
            <div className="flex flex-wrap gap-2">
              {RISK_CHIPS.map(chip => {
                const active = query.includes(chip.token);
                return (
                  <button key={chip.token}
                    onClick={() => active ? removeToken(chip.token) : addToken(chip.token)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                    style={{
                      background: active ? chip.color : 'rgba(255,255,255,0.04)',
                      border:     `1px solid ${active ? chip.border : 'rgba(255,255,255,0.1)'}`,
                      color:      active ? chip.text : '#a1a1aa',
                      transform:  active ? 'scale(1.04)' : 'scale(1)',
                    }}
                  >
                    {chip.label}
                    {active && <span className="ml-0.5 text-[10px]">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Example queries */}
          <div className="pt-2 border-t border-white/5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Example queries</p>
            <div className="flex flex-wrap gap-2">
              {[
                'team:payments env:production',
                'risk:nolimits risk:latest',
                'env:dev risk:noprobe',
                'fraud',
                'team:ops risk:single',
              ].map(ex => (
                <button key={ex}
                  onClick={() => { const q = ex + ' '; setQuery(q); setShowBuilder(false); search(q).then(() => setIsOpen(true)); }}
                  className="text-[11px] px-2.5 py-1 rounded-lg font-mono transition-all hover:bg-white/8"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#71717a' }}
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Search results dropdown */}
      {isOpen && results.length > 0 && !showBuilder && (
        <div className="absolute z-50 w-full mt-1 rounded-lg shadow-2xl max-h-[420px] overflow-y-auto"
          style={{ background: 'rgba(6,18,32,0.97)', border: '1px solid rgba(34,211,238,0.15)', backdropFilter: 'blur(16px)' }}>
          <div className="px-3 py-1.5 border-b border-white/5 flex items-center justify-between">
            <span className="text-[10px] text-zinc-500">{results.length} result{results.length !== 1 ? 's' : ''}</span>
            {activeTokens.length > 0 && (
              <span className="text-[10px] text-cyan-400/60">filtered by {activeTokens.join(', ')}</span>
            )}
          </div>
          {results.map((item, i) => (
            <button
              key={item.id}
              onClick={() => handleSelect(item.name)}
              className={`w-full px-4 py-2.5 flex items-center justify-between text-left transition-colors border-b border-white/5 last:border-0
                ${i === highlightIndex ? 'bg-cyan-500/10' : 'hover:bg-white/5'}
                ${i === 0 ? 'rounded-t-lg' : ''} ${i === results.length - 1 ? 'rounded-b-lg' : ''}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs px-1.5 py-0.5 rounded font-mono shrink-0"
                  style={{
                    background: item.type === 'deployment' ? 'rgba(34,211,238,0.12)' : 'rgba(139,92,246,0.15)',
                    color:      item.type === 'deployment' ? '#22d3ee' : '#c084fc',
                  }}>
                  {item.type === 'deployment' ? 'deploy' : 'helm'}
                </span>
                {item.environment && item.environment !== 'unknown' && (
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: ENV_DOT[item.environment] || '#71717a' }} />
                )}
                <span className="text-sm text-zinc-100 truncate">{item.name}</span>
                <div className="flex gap-1 shrink-0">
                  {item.latestTag       && <span className="text-[9px] px-1 py-0.5 rounded bg-red-500/20 text-red-300">:latest</span>}
                  {item.noLimits        && <span className="text-[9px] px-1 py-0.5 rounded bg-red-500/20 text-red-300">no limits</span>}
                  {item.noLivenessProbe && <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-300">no probe</span>}
                  {item.singleReplica   && <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-300">1 replica</span>}
                </div>
              </div>
              <div className="shrink-0 ml-2">
                {item.ownerTeam
                  ? <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-700 text-zinc-300">{item.ownerTeam}</span>
                  : <span className="text-xs text-red-400/70">no team</span>
                }
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}