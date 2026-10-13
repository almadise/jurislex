'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { fetchCurrentUser } from '@/lib/auth/client';
import type { GraphEdge, GraphNode } from '@/lib/matters/graph';

const typeColors: Record<string, string> = {
  matter: 'bg-primary text-white border-primary',
  party: 'bg-blue-100 text-blue-900 border-blue-300',
  fact: 'bg-green-50 text-green-900 border-green-300',
  evidence: 'bg-amber-50 text-amber-900 border-amber-300',
  issue: 'bg-purple-50 text-purple-900 border-purple-300',
  article: 'bg-indigo-50 text-indigo-900 border-indigo-300',
  claim: 'bg-slate-100 text-slate-900 border-slate-300',
  document: 'bg-cyan-50 text-cyan-900 border-cyan-300',
};

export default function MatterGraphContent() {
  const searchParams = useSearchParams();
  const [matters, setMatters] = useState<{ id: string; reference: string; title: string }[]>([]);
  const [matterId, setMatterId] = useState(searchParams.get('matterId') || '');
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [auth, setAuth] = useState(false);

  useEffect(() => {
    void (async () => {
      const u = await fetchCurrentUser();
      setAuth(Boolean(u));
      if (!u) return;
      const res = await fetch('/api/matters', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setMatters(
        (data.matters || []).map((m: { id: string; reference: string; title: string }) => ({
          id: m.id,
          reference: m.reference,
          title: m.title,
        }))
      );
    })();
  }, []);

  const loadGraph = useCallback(async (id: string) => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/matters/${id}/graph`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erreur || 'Graphe indisponible');
      setNodes(data.graph.nodes || []);
      setEdges(data.graph.edges || []);
      setSelected(null);
    } catch (e) {
      setError((e as Error).message);
      setNodes([]);
      setEdges([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (matterId) void loadGraph(matterId);
  }, [matterId, loadGraph]);

  const layout = useMemo(() => layoutRadial(nodes), [nodes]);

  if (!auth) {
    return (
      <div className="card p-10 text-center max-w-lg mx-auto">
        <p className="text-sm mb-4">Connexion requise pour le graphe de dossier.</p>
        <Link href="/sign-up-login" className="btn-primary inline-flex">
          Se connecter
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Graphe du dossier</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Relie parties, faits, preuves, questions juridiques, articles et documents générés pour
            justifier chaque conclusion.
          </p>
        </div>
        <select
          className="input-field w-auto min-w-[240px]"
          value={matterId}
          onChange={(e) => setMatterId(e.target.value)}
        >
          <option value="">— Choisir un dossier —</option>
          {matters.map((m) => (
            <option key={m.id} value={m.id}>
              {m.reference} — {m.title}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {!matterId && (
        <div className="card p-8 text-center text-sm text-muted-foreground">
          Sélectionnez un dossier pour afficher son graphe justificatif.
        </div>
      )}

      {matterId && (
        <div className="flex gap-4 flex-col xl:flex-row">
          <div className="flex-1 card p-2 overflow-hidden relative" style={{ minHeight: 520 }}>
            {loading && (
              <p className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground bg-card/80 z-10">
                Construction du graphe…
              </p>
            )}
            <svg viewBox="0 0 800 520" className="w-full h-[520px]">
              {edges.map((e) => {
                const a = layout[e.from];
                const b = layout[e.to];
                if (!a || !b) return null;
                return (
                  <g key={e.id}>
                    <line
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke="#cbd5e1"
                      strokeWidth={1.5}
                    />
                  </g>
                );
              })}
              {nodes.map((n) => {
                const p = layout[n.id];
                if (!p) return null;
                const active = selected?.id === n.id;
                return (
                  <g
                    key={n.id}
                    transform={`translate(${p.x},${p.y})`}
                    className="cursor-pointer"
                    onClick={() => setSelected(n)}
                  >
                    <circle
                      r={active ? 18 : 14}
                      className={active ? 'fill-primary' : 'fill-slate-200'}
                      stroke={active ? '#1e3a5f' : '#94a3b8'}
                      strokeWidth={active ? 2 : 1}
                    />
                    <title>{n.label}</title>
                  </g>
                );
              })}
            </svg>
            <div className="absolute bottom-2 left-2 flex flex-wrap gap-1 max-w-[90%]">
              {Object.entries(typeColors).map(([t, cls]) => (
                <span key={t} className={`text-[10px] px-2 py-0.5 rounded border ${cls}`}>
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div className="w-full xl:w-80 card p-4 space-y-3">
            <h3 className="text-sm font-semibold">Détail du nœud</h3>
            {!selected && (
              <p className="text-xs text-muted-foreground">
                Cliquez un nœud. {nodes.length} nœuds · {edges.length} liens.
              </p>
            )}
            {selected && (
              <>
                <span
                  className={`inline-flex text-[11px] px-2 py-0.5 rounded border ${typeColors[selected.type] || ''}`}
                >
                  {selected.type}
                </span>
                <p className="text-sm text-foreground leading-relaxed">{selected.label}</p>
                {selected.meta && (
                  <pre className="text-[10px] font-mono-ref bg-muted p-2 rounded overflow-auto max-h-40">
                    {JSON.stringify(selected.meta, null, 2)}
                  </pre>
                )}
                <div>
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">
                    Relations
                  </p>
                  <ul className="text-xs space-y-1">
                    {edges
                      .filter((e) => e.from === selected.id || e.to === selected.id)
                      .map((e) => (
                        <li key={e.id} className="text-muted-foreground">
                          <span className="font-mono-ref text-primary">{e.relation}</span>
                          {' → '}
                          {e.from === selected.id
                            ? nodes.find((n) => n.id === e.to)?.label.slice(0, 40)
                            : nodes.find((n) => n.id === e.from)?.label.slice(0, 40)}
                        </li>
                      ))}
                  </ul>
                </div>
              </>
            )}
            <Link
              href={matterId ? `/legal-analysis?matterId=${matterId}` : '/legal-analysis'}
              className="btn-secondary text-xs w-full justify-center"
            >
              <Icon name="DocumentMagnifyingGlassIcon" size={14} />
              Analyser
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function layoutRadial(nodes: GraphNode[]): Record<string, { x: number; y: number }> {
  const cx = 400;
  const cy = 260;
  const pos: Record<string, { x: number; y: number }> = {};
  if (!nodes.length) return pos;

  const root = nodes.find((n) => n.type === 'matter') || nodes[0];
  pos[root.id] = { x: cx, y: cy };

  const others = nodes.filter((n) => n.id !== root.id);
  const byType: Record<string, GraphNode[]> = {};
  for (const n of others) {
    byType[n.type] = byType[n.type] || [];
    byType[n.type].push(n);
  }

  const rings = Object.keys(byType);
  rings.forEach((type, ri) => {
    const group = byType[type];
    const r = 80 + ri * 55;
    group.forEach((n, i) => {
      const angle = (2 * Math.PI * i) / Math.max(group.length, 1) - Math.PI / 2;
      pos[n.id] = {
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
      };
    });
  });

  return pos;
}
