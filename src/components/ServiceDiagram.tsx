'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import mermaid from 'mermaid';

interface ServiceDiagramProps {
  name: string;
}

interface DiagramNode {
  id: string;
  name: string;
  type: string;
  metadata: Record<string, unknown>;
}

const LAYER_CONFIG: Record<string, { label: string; default: boolean; color: string }> = {
  deployment: { label: 'Deployments', default: true, color: 'bg-blue-500' },
  service: { label: 'Services', default: true, color: 'bg-purple-500' },
  ingress: { label: 'Ingress', default: true, color: 'bg-orange-500' },
  configmap: { label: 'ConfigMaps', default: false, color: 'bg-green-500' },
  secret: { label: 'Secrets', default: false, color: 'bg-red-500' },
  database: { label: 'Databases', default: true, color: 'bg-violet-500' },
  servicemonitor: { label: 'Monitors', default: false, color: 'bg-slate-500' },
  'helm-chart': { label: 'Helm', default: true, color: 'bg-cyan-500' },
  'network-callers': { label: 'Network Callers', default: true, color: 'bg-yellow-500' },
};

mermaid.initialize({
  startOnLoad: false,
  maxEdges: 2000,
  theme: 'dark',
  themeVariables: {
    primaryColor: '#0d1b2a',
    primaryTextColor: '#e0f2fe',
    primaryBorderColor: '#22d3ee',
    lineColor: '#22d3ee66',
    secondaryColor: '#0a1628',
    tertiaryColor: '#030a12',
    background: '#030a12',
    mainBkg: '#0d1b2a',
    nodeBorder: '#22d3ee44',
    clusterBkg: '#06121e',
    clusterBorder: '#22d3ee33',
    titleColor: '#22d3ee',
    edgeLabelBackground: '#0a1628',
    fontSize: '12px',
  },
  flowchart: {
    curve: 'basis',
    padding: 15,
    htmlLabels: true,
    useMaxWidth: false,
  },
  securityLevel: 'loose',
});

export default function ServiceDiagram({ name }: ServiceDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{ active: boolean; lastX: number; lastY: number }>({
    active: false,
    lastX: 0,
    lastY: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [depth, setDepth] = useState(2);
  const [zoom, setZoom] = useState(100);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [layers, setLayers] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const [key, cfg] of Object.entries(LAYER_CONFIG)) {
      init[key] = cfg.default;
    }
    return init;
  });
  const [rawData, setRawData] = useState<{ mermaid: string; nodeCount: number; edgeCount: number; nodes: DiagramNode[]; edges: { source: string; target: string; type: string; label?: string }[] } | null>(null);
  const [filteredCounts, setFilteredCounts] = useState({ nodes: 0, edges: 0 });
  const [hoveredNode, setHoveredNode] = useState<DiagramNode | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<string | null>(null);
  const [edgePos, setEdgePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Fetch graph data
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`/api/graph/${encodeURIComponent(name)}?depth=${depth}`);
        if (!res.ok) throw new Error('Failed to load graph');
        const data = await res.json();
        if (!cancelled) setRawData(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Unknown error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => { cancelled = true; };
  }, [name, depth]);

  // Render diagram with layer filtering
  const renderDiagram = useCallback(async () => {
    if (!rawData || !containerRef.current) return;

    // Filter mermaid syntax by removing lines for hidden layers
    const hiddenTypes = Object.entries(layers)
      .filter(([, visible]) => !visible)
      .map(([type]) => type)
      .filter(t => t !== 'network-callers'); // handled separately

    const hideNetwork = !layers['network-callers'];

    // Get node IDs to hide
    const hiddenNodeIds = new Set(
      rawData.nodes
        .filter(n => hiddenTypes.includes(n.type))
        .map(n => n.id.replace(/[^a-zA-Z0-9]/g, '_'))
    );

    // If hiding network callers, find nodes that are ONLY connected via network-allows
    if (hideNetwork) {
      // Hide edges with "net" or port labels (network-allows edges)
      // and nodes that only appear through network edges
    }

    // Filter mermaid lines
    const lines = rawData.mermaid.split('\n');
    const filtered = lines.filter(line => {
      const trimmed = line.trim();
      // Keep graph declaration, subgraph headers/ends, classDefs
      if (trimmed.startsWith('graph ') || trimmed === 'end' || trimmed.startsWith('classDef ')) return true;
      // Hide network-allows edges (they contain -- ":port" -->)
      if (hideNetwork && trimmed.match(/-- ":\d+".*-->/)) return false;
      // Check if any hidden node ID appears in this line
      for (const hiddenId of hiddenNodeIds) {
        if (trimmed.includes(hiddenId)) return false;
      }
      return true;
    });

    // Remove empty subgraphs
    const cleaned: string[] = [];
    for (let i = 0; i < filtered.length; i++) {
      if (filtered[i].trim().startsWith('subgraph ') && filtered[i + 1]?.trim() === 'end') {
        i++; // skip both
        continue;
      }
      cleaned.push(filtered[i]);
    }

    const mermaidStr = cleaned.join('\n');
    const visibleNodes = rawData.nodes.filter(n => !hiddenTypes.includes(n.type));
    setFilteredCounts({
      nodes: visibleNodes.length,
      edges: cleaned.filter(l => l.includes('-->') || l.includes('-.-') || l.includes('==>')).length,
    });

    try {
      containerRef.current.innerHTML = '';
      const id = `mermaid-${Date.now()}`;
      const { svg } = await mermaid.render(id, mermaidStr);
      if (containerRef.current) {
        containerRef.current.innerHTML = svg;
        // Adjust SVG for zoom controls
        const svgEl = containerRef.current.querySelector('svg');
        if (svgEl) {
          // Let SVG render at natural content size, only shrink if too wide
          svgEl.style.maxWidth = '100%';
          svgEl.style.height = 'auto';
        }
        // Add hover handlers to nodes
        containerRef.current.querySelectorAll('.node').forEach(el => {
          if (!rawData) return;
          // Mermaid node IDs contain our sanitized ID (e.g., "flowchart-deploy_auth-123")
          const elId = el.id || '';
          // Match against our node IDs (sanitized: deploy_auth, ing_auth, svc_auth, etc.)
          const node = rawData.nodes.find(n => {
            const sanitized = n.id.replace(/[^a-zA-Z0-9]/g, '_');
            return elId.includes(sanitized);
          });
          if (node) {
            (el as HTMLElement).style.cursor = 'pointer';
            el.addEventListener('mouseenter', () => setHoveredNode(node));
            el.addEventListener('mouseleave', () => setHoveredNode(null));
          }
        });
        // Add hover on edges (paths) to show connection info
        containerRef.current.querySelectorAll('.flowchart-link').forEach(el => {
          (el as HTMLElement).style.cursor = 'pointer';
          (el as SVGElement).setAttribute('stroke-width', '2');
          el.addEventListener('mouseenter', (e) => {
            (el as SVGElement).setAttribute('stroke-width', '4');
            (el as SVGElement).setAttribute('stroke', '#22d3ee');
            const rect = containerRef.current!.getBoundingClientRect();
            setEdgePos({ x: (e as MouseEvent).clientX - rect.left, y: (e as MouseEvent).clientY - rect.top });
            setHoveredEdge('Connection');
          });
          el.addEventListener('mouseleave', () => {
            (el as SVGElement).setAttribute('stroke-width', '2');
            (el as SVGElement).setAttribute('stroke', '');
            setHoveredEdge(null);
          });
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Render error');
    }
  }, [rawData, layers]);

  useEffect(() => {
    renderDiagram();
  }, [renderDiagram]);

  const toggleLayer = (type: string) => {
    setLayers(prev => ({ ...prev, [type]: !prev[type] }));
  };

  const clampZoom = (value: number) => Math.max(25, Math.min(300, value));

  const zoomAtPoint = useCallback((nextZoom: number, clientX: number, clientY: number) => {
    const viewportEl = viewportRef.current;
    const clampedZoom = clampZoom(nextZoom);

    if (!viewportEl) {
      setZoom(clampedZoom);
      return;
    }

    const rect = viewportEl.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const currentScale = zoom / 100;
    const nextScale = clampedZoom / 100;

    setPan(prev => ({
      x: localX - ((localX - prev.x) / currentScale) * nextScale,
      y: localY - ((localY - prev.y) / currentScale) * nextScale,
    }));
    setZoom(clampedZoom);
  }, [zoom]);

  useEffect(() => {
    const viewportEl = viewportRef.current;
    if (!viewportEl) return;

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;

      // Prevent browser/page zoom and keep zoom behavior scoped to the diagram.
      e.preventDefault();
      e.stopPropagation();

      const direction = e.deltaY < 0 ? 1 : -1;
      const step = direction > 0 ? 10 : -10;
      zoomAtPoint(zoom + step, e.clientX, e.clientY);
    };

    viewportEl.addEventListener('wheel', onWheel, { passive: false });
    return () => viewportEl.removeEventListener('wheel', onWheel);
  }, [zoom, zoomAtPoint]);

  const handlePanStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;

    dragStateRef.current = {
      active: true,
      lastX: e.clientX,
      lastY: e.clientY,
    };
    setIsPanning(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const handlePanMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current.active) return;

    const dx = e.clientX - dragStateRef.current.lastX;
    const dy = e.clientY - dragStateRef.current.lastY;
    dragStateRef.current.lastX = e.clientX;
    dragStateRef.current.lastY = e.clientY;

    setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
  }, []);

  const handlePanEnd = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current.active) return;

    dragStateRef.current.active = false;
    setIsPanning(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  if (error && !rawData) {
    return (
      <div className="flex items-center justify-center h-64 glass-panel">
        <p className="text-red-400">Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="relative glass-panel overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
        <h3 className="text-sm font-medium text-slate-400">Dependency Graph</h3>
        <div className="flex items-center gap-3">
          {!loading && (
            <span className="text-xs text-slate-500">
              {filteredCounts.nodes} nodes, {filteredCounts.edges} edges
            </span>
          )}
          {/* Zoom control */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setZoom(z => clampZoom(z - 25))}
              className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-slate-400 hover:bg-white/15"
            >
              −
            </button>
            <span className="text-xs text-slate-500 w-8 text-center">{zoom}%</span>
            <button
              onClick={() => setZoom(z => clampZoom(z + 25))}
              className="text-xs px-1.5 py-0.5 rounded bg-white/10 text-slate-400 hover:bg-white/15"
            >
              +
            </button>
          </div>
          {/* Depth control */}
          <div className="flex items-center gap-1">
            <span className="text-xs text-slate-500">Depth:</span>
            {[1, 2, 3].map(d => (
              <button
                key={d}
                onClick={() => setDepth(d)}
                className={`text-xs px-1.5 py-0.5 rounded ${
                  depth === d ? 'bg-cyan-500 text-black' : 'bg-white/10 text-slate-400 hover:bg-white/15'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Layer toggles */}
      <div className="flex flex-wrap gap-1.5 px-4 py-2 border-b border-white/5/50">
        {Object.entries(LAYER_CONFIG).map(([type, cfg]) => (
          <button
            key={type}
            onClick={() => toggleLayer(type)}
            className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded transition-colors ${
              layers[type]
                ? 'bg-white/10 text-zinc-200'
                : 'bg-zinc-800/50 text-zinc-600'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${layers[type] ? cfg.color : 'bg-white/10'}`} />
            {cfg.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-pulse text-slate-500">Loading graph...</div>
        </div>
      )}
      {error && rawData && (
        <div className="px-4 py-2 text-xs text-amber-400 bg-amber-400/10">
          {error} — try reducing depth or hiding layers
        </div>
      )}
      <div className="overflow-auto p-4 relative">
        <div
          ref={viewportRef}
          className={isPanning ? 'cursor-grabbing select-none' : 'cursor-grab'}
          onPointerDown={handlePanStart}
          onPointerMove={handlePanMove}
          onPointerUp={handlePanEnd}
          onPointerCancel={handlePanEnd}
          onPointerLeave={handlePanEnd}
          style={{ touchAction: 'none' }}
        >
          <div
            ref={containerRef}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom / 100})`,
              transformOrigin: 'top left',
            }}
          />
        </div>
        {hoveredNode && (
          <div
            className="absolute top-4 right-4 z-50 glass-panel p-3 min-w-[200px] text-xs shadow-2xl"
            style={{ borderColor: 'rgba(34, 211, 238, 0.3)', pointerEvents: 'none' }}
          >
            <div className="font-bold text-cyan-400 text-sm mb-2">{hoveredNode.name}</div>
            <div className="space-y-1 text-slate-300">
              <div><span className="text-slate-500">Type:</span> {hoveredNode.type}</div>
              {hoveredNode.metadata.ownerTeam ? <div><span className="text-slate-500">Team:</span> {String(hoveredNode.metadata.ownerTeam)}</div> : null}
              {hoveredNode.metadata.replicas !== undefined ? <div><span className="text-slate-500">Replicas:</span> {String(hoveredNode.metadata.replicas)}</div> : null}
              {hoveredNode.metadata.cpuRequest ? <div><span className="text-slate-500">CPU:</span> {String(hoveredNode.metadata.cpuRequest)}/{String(hoveredNode.metadata.cpuLimit || 'no limit')}</div> : null}
              {hoveredNode.metadata.memoryRequest ? <div><span className="text-slate-500">Memory:</span> {String(hoveredNode.metadata.memoryRequest)}/{String(hoveredNode.metadata.memoryLimit || 'no limit')}</div> : null}
              {hoveredNode.metadata.framework ? <div><span className="text-slate-500">Stack:</span> {String(hoveredNode.metadata.framework)}/{String(hoveredNode.metadata.tech)}</div> : null}
            </div>
            {rawData?.edges && (() => {
              const outgoing = rawData.edges.filter(e => e.source === hoveredNode.id && e.type === 'network-allows');
              const incoming = rawData.edges.filter(e => e.target === hoveredNode.id && e.type === 'network-allows');
              if (outgoing.length === 0 && incoming.length === 0) return null;
              return (
                <div className="mt-2 pt-2 border-t border-white/10 space-y-1">
                  {outgoing.length > 0 && (
                    <div>
                      <span className="text-cyan-500 text-[10px] font-bold">CALLS:</span>
                      <div className="text-slate-400">{outgoing.map(e => {
                        const name = e.target.split(':')[1];
                        return name + (e.label || '');
                      }).join(', ')}</div>
                    </div>
                  )}
                  {incoming.length > 0 && (
                    <div>
                      <span className="text-amber-500 text-[10px] font-bold">CALLED BY:</span>
                      <div className="text-slate-400">{incoming.map(e => {
                        const name = e.source.split(':')[1];
                        return name + (e.label || '');
                      }).join(', ')}</div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
