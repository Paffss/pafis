'use client';

import { useEffect, useState, useCallback } from 'react';

interface ManifestViewerProps {
  name: string;
  onClose: () => void;
}

// Simple YAML syntax highlighter
function highlightYaml(yaml: string): string {
  return yaml
    .split('\n')
    .map(line => {
      // Comments
      if (line.trimStart().startsWith('#')) {
        return `<span class="yaml-comment">${escHtml(line)}</span>`;
      }
      // Keys (word followed by colon)
      const keyMatch = line.match(/^(\s*)([\w\-./]+)(\s*:)(.*)$/);
      if (keyMatch) {
        const [, indent, key, colon, rest] = keyMatch;
        const coloredRest = colorValue(rest);
        return `${escHtml(indent)}<span class="yaml-key">${escHtml(key)}</span><span class="yaml-colon">${escHtml(colon)}</span>${coloredRest}`;
      }
      // List items
      const listMatch = line.match(/^(\s*-\s*)(.*)$/);
      if (listMatch) {
        const [, dash, value] = listMatch;
        return `<span class="yaml-dash">${escHtml(dash)}</span>${colorValue(' ' + value)}`;
      }
      return escHtml(line);
    })
    .join('\n');
}

function escHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function colorValue(val: string): string {
  const trimmed = val.trim();
  if (!trimmed) return escHtml(val);
  // Booleans
  if (/^(true|false|yes|no)$/i.test(trimmed))
    return ` <span class="yaml-bool">${escHtml(trimmed)}</span>`;
  // Numbers
  if (/^\d+$/.test(trimmed))
    return ` <span class="yaml-number">${escHtml(trimmed)}</span>`;
  // Quoted strings
  if (/^["']/.test(trimmed))
    return ` <span class="yaml-string">${escHtml(trimmed)}</span>`;
  // Resource values like 100m, 256Mi
  if (/^\d+[a-zA-Z]+$/.test(trimmed))
    return ` <span class="yaml-resource">${escHtml(trimmed)}</span>`;
  // Plain values
  return ` <span class="yaml-value">${escHtml(trimmed)}</span>`;
}

export default function ManifestViewer({ name, onClose }: ManifestViewerProps) {
  const [yaml, setYaml]       = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied]   = useState(false);

  useEffect(() => {
    fetch(`/api/manifest/${encodeURIComponent(name)}`)
      .then(r => r.json())
      .then(d => { setYaml(d.rawYaml || '# No YAML available'); setLoading(false); })
      .catch(() => { setYaml('# Failed to load manifest'); setLoading(false); });
  }, [name]);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(yaml).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [yaml]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const lines = yaml.split('\n');
  const highlighted = highlightYaml(yaml);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-4 sm:inset-8 lg:inset-16 z-50 flex flex-col rounded-xl overflow-hidden"
        style={{ background: '#0a0f1a', border: '1px solid rgba(34,211,238,0.15)', boxShadow: '0 0 60px rgba(34,211,238,0.05)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-cyan-400">{name}.yaml</span>
            <span className="text-xs text-zinc-600">{lines.length} lines</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="text-xs px-3 py-1.5 rounded-lg transition-all"
              style={{
                background: copied ? 'rgba(34,211,238,0.15)' : 'rgba(255,255,255,0.05)',
                color: copied ? '#22d3ee' : '#71717a',
                border: `1px solid ${copied ? 'rgba(34,211,238,0.3)' : 'rgba(255,255,255,0.08)'}`,
              }}
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
            <button
              onClick={onClose}
              className="text-xs px-3 py-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 transition-colors"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* Code */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full text-zinc-600 text-sm animate-pulse">
              Loading manifest...
            </div>
          ) : (
            <div className="flex text-xs font-mono leading-6 min-h-full">
              {/* Line numbers */}
              <div className="sticky left-0 select-none py-4 px-3 text-right shrink-0"
                style={{ background: '#0a0f1a', color: '#3f3f46', minWidth: '3rem', borderRight: '1px solid rgba(255,255,255,0.04)' }}>
                {lines.map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
              {/* YAML content */}
              <pre
                className="flex-1 py-4 px-4 overflow-x-auto"
                style={{ background: 'transparent', margin: 0 }}
                dangerouslySetInnerHTML={{ __html: highlighted }}
              />
            </div>
          )}
        </div>
      </div>

      <style>{`
        .yaml-key     { color: #7dd3fc; }
        .yaml-colon   { color: #475569; }
        .yaml-string  { color: #86efac; }
        .yaml-value   { color: #e2e8f0; }
        .yaml-bool    { color: #f0abfc; }
        .yaml-number  { color: #fbbf24; }
        .yaml-resource{ color: #fb923c; }
        .yaml-dash    { color: #475569; }
        .yaml-comment { color: #4b5563; font-style: italic; }
      `}</style>
    </>
  );
}