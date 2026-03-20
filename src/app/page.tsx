'use client';

import { Suspense } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import SearchBar from '@/components/SearchBar';
import ServiceDiagram from '@/components/ServiceDiagram';
import ServiceHeader from '@/components/ServiceHeader';
import AnalysisPanel from '@/components/AnalysisPanel';
import CostPanel from '@/components/CostPanel';
import Dashboard from '@/components/Dashboard';

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
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Cyber grid background */}
      <div className="cyber-bg" />

      {/* Header */}
      <header
        className="relative z-40 sticky top-0"
        style={{
          background: 'rgba(3, 10, 18, 0.85)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(34, 211, 238, 0.1)',
        }}
      >
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center gap-5">
          <button
            onClick={() => setSelectedService(null)}
            className="flex items-center gap-2.5 shrink-0 group"
          >
            <img src="/logo.svg" alt="PAFIS" className="w-10 h-10 object-contain group-hover:scale-110 transition-transform drop-shadow-[0_0_10px_rgba(34,211,238,0.4)]" />
            <h1 className="text-lg font-black tracking-tight">
              PAFIS
            </h1>
          </button>
          <SearchBar
            key={selectedService || 'dashboard'}
            onSelect={name => setSelectedService(name)}
            selected={selectedService || undefined}
          />
          {selectedService && (
            <button
              onClick={() => setSelectedService(null)}
              className="text-xs font-medium px-3 py-1.5 rounded-lg transition-all shrink-0"
              style={{
                color: '#22d3ee',
                background: 'rgba(34, 211, 238, 0.08)',
                border: '1px solid rgba(34, 211, 238, 0.15)',
              }}
            >
              Dashboard
            </button>
          )}
          <span className="text-[10px] font-mono text-cyan-400/40 shrink-0 ml-auto">v1.0.0</span>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 max-w-[1600px] mx-auto px-6 py-6">
        {selectedService ? (
          <ServiceView name={selectedService} />
        ) : (
          <Dashboard />
        )}
      </main>
    </div>
  );
}

function ServiceView({ name }: { name: string }) {
  return (
    <div className="space-y-4">
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
