'use client';

import { useEffect, useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';

interface AnalysisPanelProps {
  name: string;
}

export default function AnalysisPanel({ name }: AnalysisPanelProps) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function analyze() {
      setContent('');
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/analyze/${encodeURIComponent(name)}`, {
          method: 'POST',
        });

        if (!res.ok) {
          throw new Error(await res.text());
        }

        const reader = res.body?.getReader();
        if (!reader) throw new Error('No reader');

        const decoder = new TextDecoder();
        let accumulated = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done || cancelled) break;

          accumulated += decoder.decode(value, { stream: true });
          setContent(accumulated);

          // Auto-scroll to bottom
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Analysis failed');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    analyze();
    return () => { cancelled = true; };
  }, [name, retryCount]);

  return (
    <div className="glass-panel flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
        <h3 className="text-sm font-medium text-cyan-400">AI Analysis</h3>
        {loading && (
          <span className="flex items-center gap-1.5 text-xs text-blue-400">
            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
            Analyzing...
          </span>
        )}
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 min-h-0">
        {error ? (
          <div>
            <p className="text-red-400 text-sm mb-2">{error}</p>
            <button
              onClick={() => { setError(null); setContent(''); setRetryCount(c => c + 1); }}
              className="text-xs px-3 py-1 bg-zinc-700 text-zinc-300 rounded hover:bg-zinc-600"
            >
              Retry
            </button>
          </div>
        ) : content ? (
          <div className="analysis-content">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        ) : loading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-4 bg-zinc-800 rounded w-3/4" />
            <div className="h-4 bg-zinc-800 rounded w-full" />
            <div className="h-4 bg-zinc-800 rounded w-5/6" />
            <div className="h-4 bg-zinc-800 rounded w-2/3" />
          </div>
        ) : null}
      </div>
    </div>
  );
}
