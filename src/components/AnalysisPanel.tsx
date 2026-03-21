'use client';

import { useEffect, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';

interface AnalysisPanelProps {
  name: string;
}

// Count risk indicators in the content
function countRisks(content: string) {
  const critical = (content.match(/🔴/g) || []).length;
  const warnings = (content.match(/🟡/g) || []).length;
  return { critical, warnings };
}

// Which stages have completed streaming
function getCompletedStages(content: string) {
  return {
    purpose:      content.includes('## Purpose'),
    risks:        content.includes('## Risks'),
    improvements: content.includes('## Improvements'),
    security:     content.includes('## Security'),
    dependencies: content.includes('## Dependencies'),
  };
}

export default function AnalysisPanel({ name }: AnalysisPanelProps) {
  const [content, setContent]     = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function analyze() {
      setContent('');
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/analyze/${encodeURIComponent(name)}`, { method: 'POST' });
        if (!res.ok) throw new Error(await res.text());

        const reader = res.body?.getReader();
        if (!reader) throw new Error('No reader');

        const decoder = new TextDecoder();
        let accumulated = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done || cancelled) break;
          accumulated += decoder.decode(value, { stream: true });
          setContent(accumulated);
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Analysis failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    analyze();
    return () => { cancelled = true; };
  }, [name, retryCount]);

  const stages = getCompletedStages(content);
  const { critical, warnings } = countRisks(content);
  const allDone = !loading && content.length > 0;

  const stageList = [
    { key: 'purpose',      label: 'Purpose' },
    { key: 'risks',        label: 'Risks' },
    { key: 'improvements', label: 'Improvements' },
    { key: 'security',     label: 'Security' },
    { key: 'dependencies', label: 'Dependencies' },
  ] as const;

  return (
    <div className="glass-panel flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-cyan-400">AI Analysis</h3>
          {allDone && critical > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">
              {critical} critical
            </span>
          )}
          {allDone && warnings > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">
              {warnings} warnings
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Stage progress pills */}
          <div className="hidden sm:flex items-center gap-1">
            {stageList.map(s => (
              <span
                key={s.key}
                className="text-[10px] px-1.5 py-0.5 rounded transition-all duration-300"
                style={{
                  background: stages[s.key] ? 'rgba(34,211,238,0.12)' : 'rgba(255,255,255,0.04)',
                  color:      stages[s.key] ? '#22d3ee' : '#52525b',
                  border:     `1px solid ${stages[s.key] ? 'rgba(34,211,238,0.2)' : 'transparent'}`,
                }}
              >
                {s.label}
              </span>
            ))}
          </div>
          {loading && (
            <span className="flex items-center gap-1.5 text-xs text-blue-400">
              <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
              Analyzing...
            </span>
          )}
          {allDone && (
            <button
              onClick={() => { setContent(''); setRetryCount(c => c + 1); }}
              className="text-[10px] px-2 py-0.5 rounded text-zinc-500 hover:text-zinc-300 border border-white/5 hover:border-white/10 transition-all"
            >
              Refresh
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 min-h-0">
        {error ? (
          <div>
            <p className="text-red-400 text-sm mb-2 font-mono">{error}</p>
            <button
              onClick={() => { setError(null); setContent(''); setRetryCount(c => c + 1); }}
              className="text-xs px-3 py-1 bg-zinc-700 text-zinc-300 rounded hover:bg-zinc-600 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : content ? (
          <div className="analysis-content prose prose-invert prose-sm max-w-none">
            <ReactMarkdown
              components={{
                h2: ({ children }) => (
                  <h2 className="text-xs font-bold uppercase tracking-widest text-cyan-400/70 mt-5 mb-2 first:mt-0 border-b border-white/5 pb-1">
                    {children}
                  </h2>
                ),
                p: ({ children }) => (
                  <p className="text-sm text-zinc-300 leading-relaxed mb-2">{children}</p>
                ),
                ul: ({ children }) => (
                  <ul className="space-y-1 mb-3">{children}</ul>
                ),
                li: ({ children }) => (
                  <li className="text-sm text-zinc-300 flex gap-2">
                    <span className="text-cyan-500 mt-0.5 shrink-0">›</span>
                    <span>{children}</span>
                  </li>
                ),
                strong: ({ children }) => (
                  <strong className="text-zinc-100 font-semibold">{children}</strong>
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        ) : loading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-3 bg-zinc-800 rounded w-1/4 mb-4" />
            <div className="h-3 bg-zinc-800 rounded w-full" />
            <div className="h-3 bg-zinc-800 rounded w-5/6" />
            <div className="h-3 bg-zinc-800 rounded w-3/4" />
            <div className="h-3 bg-zinc-800 rounded w-1/4 mt-6 mb-4" />
            <div className="h-3 bg-zinc-800 rounded w-full" />
            <div className="h-3 bg-zinc-800 rounded w-4/5" />
          </div>
        ) : null}
      </div>
    </div>
  );
}