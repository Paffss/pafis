'use client';

import { Suspense } from 'react';
import Image from 'next/image';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import SearchBar from '@/components/SearchBar';
import ServiceDiagram from '@/components/ServiceDiagram';
import ServiceHeader from '@/components/ServiceHeader';
import AnalysisPanel from '@/components/AnalysisPanel';
import CostPanel from '@/components/CostPanel';
import Dashboard from '@/components/Dashboard';
import DataSourceBanner from '@/components/DataSourceBanner';

export default function Home() {
  return (
    <Suspense fallback={null}>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedService = searchParams.get('service');

  const setSelectedService = (service: string | null) => {
    const nextParams = new URLSearchParams(searchParams.toString());

    if (service) {
      nextParams.set('service', service);
    } else {
      nextParams.delete('service');
    }

    const query = nextParams.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Cyber grid background */}
      <div className="cyber-bg" />

      {/* Header */}
      <header
        className="relative z-40 sticky top-0"
        style={{
          background: 'rgba(3,10,18,0.9)',
          backdropFilter: 'blur(24px)',
          borderBottom: '1px solid rgba(34,211,238,0.08)',
        }}
      >
        <div className="max-w-[1600px] mx-auto px-6 py-2.5 flex items-center gap-4">

          {/* Logo + wordmark */}
          <button
            onClick={() => setSelectedService(null)}
            className="flex items-center gap-2.5 shrink-0 group"
          >
            <Image src="/logo.svg" alt="PAFIS" width={36} height={36}
              className="object-contain group-hover:scale-110 transition-transform drop-shadow-[0_0_12px_rgba(34,211,238,0.5)]" />
            <div className="flex flex-col leading-none">
              <span className="text-base font-black tracking-tight text-zinc-100">PAFIS</span>
              <span className="text-[9px] font-mono text-cyan-400/50 tracking-widest">PLATFORM INTEL</span>
            </div>
          </button>

          {/* Divider */}
          <div className="w-px h-6 bg-white/8 shrink-0" />

          {/* Search */}
          <SearchBar
            key={selectedService || 'dashboard'}
            onSelect={name => setSelectedService(name)}
            selected={selectedService || undefined}
          />

          {/* Back to dashboard breadcrumb */}
          {selectedService && (
            <button
              onClick={() => setSelectedService(null)}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all shrink-0"
              style={{ color: '#22d3ee', background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.15)' }}
            >
              ← Dashboard
            </button>
          )}

          {/* Spacer */}
          <div className="ml-auto" />

          {/* GitHub link */}
          <a
            href="https://github.com/Paffss/pafis"
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors shrink-0"
            title="View on GitHub"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
          </a>

          {/* Version */}
          <span className="text-[10px] font-mono text-zinc-600 shrink-0">v1.1.0</span>

          {/* Health indicator */}
          <a href="/health" target="_blank"
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg shrink-0 transition-all"
            style={{ color: '#4ade80', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)' }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Live
          </a>
        </div>
      </header>

      {/* Data source disclaimer */}
      <DataSourceBanner mode={process.env.NEXT_PUBLIC_DATA_MODE as 'sample' | 'cluster' | 'auto' || 'auto'} />

      {/* Main content */}
      <main className="relative z-10 max-w-[1600px] mx-auto px-6 py-6">
        {selectedService ? (
          <ServiceView name={selectedService} onBack={() => setSelectedService(null)} />
        ) : (
          <Dashboard onSelectService={name => setSelectedService(name)} />
        )}
      </main>
    </div>
  );
}

function ServiceView({ name, onBack }: { name: string; onBack: () => void }) {
  return (
    <div className="space-y-4">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-100 transition-colors group"
      >
        <span className="group-hover:-translate-x-0.5 transition-transform">←</span>
        <span>Back to Dashboard</span>
      </button>
      <ServiceHeader name={name} />
      <ServiceDiagram name={name} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="min-h-[400px]">
          <AnalysisPanel name={name} />
        </div>
        <CostPanel name={name} />
      </div>
    </div>
  );
}