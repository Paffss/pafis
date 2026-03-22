'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from') || '/';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) { router.push(from); router.refresh(); }
      else { const d = await res.json(); setError(d.error || 'Invalid credentials'); }
    } catch { setError('Something went wrong.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center">
      <div className="cyber-bg" />
      <div className="relative z-10 w-full max-w-sm px-6">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black tracking-tight text-zinc-100 mb-1">PAF<span className="glow-text">IS</span></h1>
          <p className="text-sm text-zinc-500">Predictive Analysis For Infrastructure Services</p>
        </div>
        <div className="glass-panel p-8 space-y-5">
          <div className="text-center">
            <h2 className="text-base font-bold text-zinc-200">Demo Access</h2>
            <p className="text-xs text-zinc-500 mt-1">Enter your credentials to continue</p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Username</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                placeholder="username" required
                className="w-full px-4 py-2.5 rounded-lg text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(34,211,238,0.15)' }} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" required
                className="w-full px-4 py-2.5 rounded-lg text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(34,211,238,0.15)' }} />
            </div>
            {error && <div className="text-xs text-red-400 text-center py-2 px-3 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>{error}</div>}
            <button type="submit" disabled={loading}
              className="w-full py-2.5 rounded-lg text-sm font-bold transition-all"
              style={{ background: 'rgba(34,211,238,0.15)', border: '1px solid rgba(34,211,238,0.3)', color: '#22d3ee' }}>
              {loading ? 'Authenticating...' : 'Access Demo →'}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-zinc-700 mt-6">PAFIS · Predictive Analysis For Infrastructure Services</p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense fallback={null}><LoginForm /></Suspense>;
}
