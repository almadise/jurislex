'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { toast } from 'sonner';

interface Item {
  sourcePath: string;
  status: string;
  indexedSha256: string | null;
  diskSha256: string | null;
  reason?: string;
}

interface Report {
  scannedAt: string;
  totals: Record<string, number>;
  items: Item[];
  quarantine: string[];
}

interface EditorialItem {
  id: string;
  itemType: string;
  status: string;
  title: string;
  sourcePath?: string | null;
  assigneeEmail?: string | null;
  priority: number;
  checklist: {
    provenanceChecked: boolean;
    legalStatusChecked: boolean;
    relationsChecked: boolean;
    qualityChecked: boolean;
  };
  notes: string[];
  actions: { at: string; action: string; note?: string | null; byEmail?: string | null }[];
  updatedAt: string;
}

const statusStyle: Record<string, string> = {
  unchanged: 'bg-green-100 text-green-800',
  modified: 'bg-amber-100 text-amber-900',
  new: 'bg-blue-100 text-blue-900',
  missing: 'bg-red-100 text-red-800',
  quarantined: 'bg-purple-100 text-purple-900',
  pending: 'bg-slate-100 text-slate-800',
  in_review: 'bg-blue-100 text-blue-900',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
};

type Tab = 'scan' | 'editorial';

export default function ObservatoryContent() {
  const [tab, setTab] = useState<Tab>('scan');
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [editorial, setEditorial] = useState<EditorialItem[]>([]);
  const [edTotals, setEdTotals] = useState<Record<string, number>>({});
  const [edFilter, setEdFilter] = useState<string>('all');
  const [edLoading, setEdLoading] = useState(false);
  const [activeItem, setActiveItem] = useState<EditorialItem | null>(null);
  const [note, setNote] = useState('');

  const loadScan = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/observatory');
      const data = await res.json();
      if (!res.ok) throw new Error(data.erreur || 'Scan impossible');
      setReport(data.report);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadEditorial = useCallback(async () => {
    setEdLoading(true);
    try {
      const q = edFilter !== 'all' ? `?status=${edFilter}` : '';
      const res = await fetch(`/api/editorial${q}`, { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erreur || 'File éditoriale inaccessible');
      setEditorial(data.items || []);
      setEdTotals(data.totals || {});
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEdLoading(false);
    }
  }, [edFilter]);

  useEffect(() => {
    void loadScan();
  }, [loadScan]);

  useEffect(() => {
    if (tab === 'editorial') void loadEditorial();
  }, [tab, loadEditorial]);

  const toggle = (p: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(p)) n.delete(p);
      else n.add(p);
      return n;
    });
  };

  const quarantine = async (add: boolean) => {
    const paths = [...selected];
    if (!paths.length) {
      toast.message('Sélectionnez des sources');
      return;
    }
    const res = await fetch('/api/observatory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        action: add ? 'quarantine' : 'release',
        paths,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.erreur || 'Action refusée');
      return;
    }
    toast.success(add ? 'Sources en quarantaine' : 'Sources libérées');
    setSelected(new Set());
    void loadScan();
  };

  const syncEditorial = async () => {
    const res = await fetch('/api/editorial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ op: 'sync_observatory' }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.erreur || 'Sync impossible');
      return;
    }
    toast.success(data.message || `${data.created} item(s)`);
    void loadEditorial();
  };

  const runAction = async (
    itemId: string,
    action: string,
    extra?: Record<string, unknown>
  ) => {
    const res = await fetch('/api/editorial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        op: 'action',
        itemId,
        action,
        note: note || undefined,
        ...extra,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.erreur || 'Action refusée');
      return;
    }
    toast.success(`Action ${action} enregistrée`);
    setNote('');
    setActiveItem(data.item);
    void loadEditorial();
    if (action === 'quarantine' || action === 'approve') void loadScan();
  };

  const items =
    report?.items.filter((i) => filter === 'all' || i.status === filter) || [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="page-title">Observatoire des mises à jour</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Scan SHA-256 + file éditoriale (C2c) : pending → review → approve / reject /
            quarantaine.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className={tab === 'scan' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setTab('scan')}
          >
            Scan corpus
          </button>
          <button
            type="button"
            className={tab === 'editorial' ? 'btn-primary' : 'btn-secondary'}
            onClick={() => setTab('editorial')}
          >
            File éditoriale
          </button>
        </div>
      </div>

      {tab === 'scan' && (
        <>
          <div className="flex justify-end">
            <button
              type="button"
              className="btn-primary"
              onClick={() => void loadScan()}
              disabled={loading}
            >
              <Icon
                name="ArrowPathIcon"
                size={16}
                className={loading ? 'animate-spin' : ''}
              />
              Rescanner
            </button>
          </div>

          {report && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {Object.entries(report.totals).map(([k, v]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setFilter(k === filter ? 'all' : k)}
                  className={`card p-3 text-left ${filter === k ? 'ring-2 ring-primary' : ''}`}
                >
                  <p className="text-2xl font-bold tabular-nums">{v}</p>
                  <p className="text-xs text-muted-foreground capitalize">{k}</p>
                </button>
              ))}
            </div>
          )}

          {selected.size > 0 && (
            <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <span className="text-sm font-medium">{selected.size} sélectionnée(s)</span>
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() => void quarantine(true)}
              >
                Mettre en quarantaine
              </button>
              <button
                type="button"
                className="btn-ghost text-xs"
                onClick={() => void quarantine(false)}
              >
                Libérer
              </button>
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() => {
                  setTab('editorial');
                  void syncEditorial();
                }}
              >
                Envoyer à la file éditoriale
              </button>
            </div>
          )}

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-left text-xs text-muted-foreground uppercase">
                    <th className="px-3 py-2 w-8" />
                    <th className="px-3 py-2">Statut</th>
                    <th className="px-3 py-2">Source</th>
                    <th className="px-3 py-2">Raison</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                        Scan en cours…
                      </td>
                    </tr>
                  )}
                  {!loading &&
                    items.map((i) => (
                      <tr key={i.sourcePath} className="border-b border-border/60 hover:bg-muted/20">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selected.has(i.sourcePath)}
                            onChange={() => toggle(i.sourcePath)}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`text-[11px] px-2 py-0.5 rounded font-medium ${statusStyle[i.status] || 'bg-muted'}`}
                          >
                            {i.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] break-all">
                          {i.sourcePath}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          {i.reason || '—'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'editorial' && (
        <>
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div className="flex flex-wrap gap-2">
              {['all', 'pending', 'in_review', 'approved', 'rejected', 'quarantined'].map(
                (s) => (
                  <button
                    key={s}
                    type="button"
                    className={`text-xs px-2.5 py-1 rounded-full border ${
                      edFilter === s
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'border-border bg-card'
                    }`}
                    onClick={() => setEdFilter(s)}
                  >
                    {s}
                    {s !== 'all' && edTotals[s] != null ? ` (${edTotals[s]})` : ''}
                  </button>
                )
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-secondary text-xs"
                onClick={() => void syncEditorial()}
              >
                Importer depuis le scan
              </button>
              <button
                type="button"
                className="btn-primary text-xs"
                onClick={() => void loadEditorial()}
                disabled={edLoading}
              >
                Actualiser
              </button>
            </div>
          </div>

          <div className="grid lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2 card overflow-hidden max-h-[640px] overflow-y-auto">
              {edLoading && (
                <p className="p-4 text-sm text-muted-foreground">Chargement…</p>
              )}
              {!edLoading && editorial.length === 0 && (
                <p className="p-4 text-sm text-muted-foreground">
                  File vide. Lancez un scan puis « Importer depuis le scan », ou créez un
                  item via l&apos;API.
                </p>
              )}
              {editorial.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => setActiveItem(it)}
                  className={`w-full text-left px-3 py-3 border-b border-border/60 hover:bg-muted/30 ${
                    activeItem?.id === it.id ? 'bg-primary/5' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded ${statusStyle[it.status] || 'bg-muted'}`}
                    >
                      {it.status}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{it.itemType}</span>
                  </div>
                  <p className="text-sm font-medium line-clamp-2">{it.title}</p>
                  {it.sourcePath && (
                    <p className="text-[10px] font-mono text-muted-foreground truncate mt-0.5">
                      {it.sourcePath}
                    </p>
                  )}
                </button>
              ))}
            </div>

            <div className="lg:col-span-3 card p-4 flex flex-col gap-4">
              {!activeItem && (
                <p className="text-sm text-muted-foreground">
                  Sélectionnez un item pour revue (checklist + actions).
                </p>
              )}
              {activeItem && (
                <>
                  <div>
                    <h2 className="text-base font-semibold">{activeItem.title}</h2>
                    <p className="text-xs text-muted-foreground mt-1">
                      {activeItem.status} · priorité {activeItem.priority}
                      {activeItem.assigneeEmail
                        ? ` · assigné ${activeItem.assigneeEmail}`
                        : ''}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {(
                      [
                        ['provenanceChecked', 'Provenance'],
                        ['legalStatusChecked', 'Statut juridique'],
                        ['relationsChecked', 'Relations CDC'],
                        ['qualityChecked', 'Qualité / OCR'],
                      ] as const
                    ).map(([key, label]) => (
                      <label
                        key={key}
                        className="flex items-center gap-2 p-2 rounded border border-border cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={activeItem.checklist[key]}
                          onChange={(e) => {
                            void runAction(activeItem.id, 'note', {
                              checklist: { [key]: e.target.checked },
                              note: `Checklist ${label}: ${e.target.checked ? 'OK' : 'non'}`,
                            });
                          }}
                        />
                        {label}
                      </label>
                    ))}
                  </div>

                  <textarea
                    className="input-field text-sm min-h-[80px]"
                    placeholder="Note de revue…"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      onClick={() => void runAction(activeItem.id, 'start_review')}
                    >
                      Prendre en revue
                    </button>
                    <button
                      type="button"
                      className="btn-primary text-xs"
                      onClick={() => void runAction(activeItem.id, 'approve')}
                    >
                      Approuver & publier
                    </button>
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      onClick={() => void runAction(activeItem.id, 'reject')}
                    >
                      Rejeter
                    </button>
                    <button
                      type="button"
                      className="btn-ghost text-xs text-amber-800"
                      onClick={() => void runAction(activeItem.id, 'quarantine')}
                    >
                      Quarantaine
                    </button>
                    <button
                      type="button"
                      className="btn-ghost text-xs"
                      onClick={() => void runAction(activeItem.id, 'request_info')}
                    >
                      Demander info
                    </button>
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-2">
                      Journal
                    </p>
                    <ul className="space-y-1 max-h-40 overflow-y-auto text-xs">
                      {[...activeItem.actions].reverse().map((a, i) => (
                        <li key={i} className="border-l-2 border-border pl-2 py-0.5">
                          <span className="font-medium">{a.action}</span>
                          <span className="text-muted-foreground">
                            {' '}
                            · {new Date(a.at).toLocaleString('fr-FR')}
                            {a.byEmail ? ` · ${a.byEmail}` : ''}
                          </span>
                          {a.note && <p className="text-muted-foreground">{a.note}</p>}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
