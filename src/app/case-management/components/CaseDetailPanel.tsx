'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import StatusBadge from '@/components/ui/StatusBadge';
import type { Matter } from './CaseManagementContent';

interface CaseDetailPanelProps {
  matter: Matter;
  onClose: () => void;
  onExport?: () => void;
  onDelete?: () => void;
}

interface StoredAnalysisRow {
  id: string;
  matterId: string | null;
  createdAt: string;
  narrativePreview: string;
  analysis: {
    qualification?: string;
    overallRisk?: string;
    confidenceLevel?: number;
    applicableLaw?: unknown[];
  };
}

export default function CaseDetailPanel({
  matter,
  onClose,
  onExport,
  onDelete,
}: CaseDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'timeline' | 'parties' | 'analyses' | 'documents'
  >('overview');
  const [analyses, setAnalyses] = useState<StoredAnalysisRow[]>([]);
  const [loadingAnalyses, setLoadingAnalyses] = useState(false);

  useEffect(() => {
    if (activeTab !== 'analyses' && activeTab !== 'timeline') return;
    setLoadingAnalyses(true);
    void fetch(`/api/analysis?matterId=${encodeURIComponent(matter.id)}`, {
      credentials: 'include',
    })
      .then((r) => r.json())
      .then((data) => {
        setAnalyses(data.analyses || []);
      })
      .catch(() => setAnalyses([]))
      .finally(() => setLoadingAnalyses(false));
  }, [activeTab, matter.id]);

  const tabs = [
    { id: 'overview' as const, label: 'Aperçu', icon: 'InformationCircleIcon' },
    { id: 'timeline' as const, label: 'Chronologie', icon: 'ClockIcon' },
    { id: 'parties' as const, label: 'Parties', icon: 'UsersIcon' },
    { id: 'analyses' as const, label: 'Analyses', icon: 'DocumentMagnifyingGlassIcon' },
    { id: 'documents' as const, label: 'Documents', icon: 'DocumentTextIcon' },
  ];

  const parties =
    matter.partyDetails?.length
      ? matter.partyDetails
      : matter.parties.map((name) => ({ name, quality: undefined as string | undefined }));

  const timeline = [
    {
      id: 'create',
      date: matter.createdAt,
      label: 'Dossier créé',
      user: matter.assignedTo,
    },
    ...analyses.map((a) => ({
      id: a.id,
      date: new Date(a.createdAt).toLocaleDateString('fr-FR'),
      label: `Analyse enregistrée${a.analysis?.overallRisk ? ` · risque ${a.analysis.overallRisk}` : ''}`,
      user: matter.assignedTo,
    })),
  ];

  return (
    <div className="card h-full flex flex-col overflow-hidden">
      <div className="p-4 border-b border-border flex-shrink-0">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-mono-ref text-xs font-medium text-primary">
                {matter.reference}
              </span>
              <StatusBadge type="matter" value={matter.status} size="sm" />
              <StatusBadge type="risk" value={matter.riskLevel} size="sm" />
            </div>
            <h3 className="text-sm font-semibold text-foreground leading-snug">{matter.title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors flex-shrink-0"
            aria-label="Fermer le panneau"
          >
            <Icon name="XMarkIcon" size={16} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
          <span>Créé le {matter.createdAt}</span>
          <span>·</span>
          <span>Activité : {matter.lastActivity}</span>
          <span>·</span>
          <span className="font-mono-ref">{matter.analyses} analyse(s)</span>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <Link
            href={`/legal-analysis?matterId=${encodeURIComponent(matter.id)}`}
            className="btn-primary text-xs flex-1 justify-center"
          >
            <Icon name="DocumentMagnifyingGlassIcon" size={14} />
            Analyser
          </Link>
          <Link
            href={`/matter-graph?matterId=${encodeURIComponent(matter.id)}`}
            className="btn-secondary text-xs px-2"
            title="Graphe du dossier"
          >
            <Icon name="ShareIcon" size={14} />
          </Link>
          <button
            type="button"
            className="btn-secondary text-xs flex-1 justify-center"
            onClick={onExport}
          >
            <Icon name="ArrowDownTrayIcon" size={14} />
            Exporter
          </button>
          <button
            type="button"
            className="btn-ghost text-xs px-2 text-red-600"
            onClick={onDelete}
            title="Suppression définitive"
          >
            <Icon name="TrashIcon" size={14} />
          </button>
        </div>
      </div>

      <div className="flex border-b border-border overflow-x-auto flex-shrink-0">
        {tabs.map((t) => (
          <button
            key={`detail-tab-${t.id}`}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 ${
              activeTab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground'
            }`}
          >
            <Icon name={t.icon as Parameters<typeof Icon>[0]['name']} size={14} />
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
        {activeTab === 'overview' && (
          <div className="space-y-4 fade-in">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Domaine
              </p>
              <p className="text-sm text-foreground">{matter.domain}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Parties
              </p>
              {parties.map((p, i) => (
                <p key={`ov-party-${i}`} className="text-sm text-foreground">
                  {p.name}
                  {p.quality ? ` — ${p.quality}` : ''}
                </p>
              ))}
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Tags
              </p>
              <div className="flex flex-wrap gap-1.5">
                {matter.tags.length === 0 && (
                  <span className="text-xs text-muted-foreground">Aucun tag</span>
                )}
                {matter.tags.map((tag) => (
                  <span
                    key={`tag-${tag}`}
                    className="text-[11px] px-2 py-0.5 bg-muted rounded-full text-muted-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Responsable
              </p>
              <p className="text-sm text-foreground">{matter.assignedTo}</p>
            </div>
            <p className="text-[11px] text-muted-foreground border-t border-border pt-3">
              Données confidentielles — accessibles uniquement au propriétaire du dossier.
            </p>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="space-y-3 fade-in">
            {loadingAnalyses && (
              <p className="text-xs text-muted-foreground">Chargement de la chronologie…</p>
            )}
            {timeline.map((ev) => (
              <div key={ev.id} className="p-3 bg-muted/50 rounded-lg border border-border">
                <p className="text-xs font-medium text-foreground">{ev.label}</p>
                <p className="text-[11px] text-muted-foreground font-mono-ref mt-1">
                  {ev.date} · {ev.user}
                </p>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'parties' && (
          <div className="space-y-2 fade-in">
            {parties.map((party, i) => (
              <div key={`party-${i}`} className="p-3 bg-muted/50 rounded-lg border border-border">
                <p className="text-sm font-semibold text-foreground">{party.name}</p>
                {party.quality && (
                  <p className="text-xs text-muted-foreground">{party.quality}</p>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'analyses' && (
          <div className="space-y-3 fade-in">
            {loadingAnalyses && (
              <p className="text-xs text-muted-foreground">Chargement…</p>
            )}
            {!loadingAnalyses && analyses.length === 0 && (
              <div className="py-8 text-center">
                <Icon
                  name="DocumentMagnifyingGlassIcon"
                  size={32}
                  className="text-muted-foreground mx-auto mb-2"
                />
                <p className="text-sm font-semibold">Aucune analyse liée</p>
                <p className="text-xs text-muted-foreground mb-4">
                  Lancez une analyse rattachée à ce dossier.
                </p>
                <Link
                  href={`/legal-analysis?matterId=${encodeURIComponent(matter.id)}`}
                  className="btn-primary text-xs inline-flex"
                >
                  Analyser la situation
                </Link>
              </div>
            )}
            {analyses.map((a) => (
              <div
                key={a.id}
                className="p-3 bg-muted/50 rounded-lg border border-border space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-mono-ref text-muted-foreground">
                    {new Date(a.createdAt).toLocaleString('fr-FR')}
                  </p>
                  {a.analysis?.overallRisk && (
                    <StatusBadge
                      type="risk"
                      value={a.analysis.overallRisk as 'low' | 'medium' | 'high'}
                      size="sm"
                    />
                  )}
                </div>
                <p className="text-xs text-foreground line-clamp-3">
                  {a.analysis?.qualification || a.narrativePreview}
                </p>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono-ref">
                  {a.analysis?.confidenceLevel != null && (
                    <span>confiance {a.analysis.confidenceLevel}%</span>
                  )}
                  {a.analysis?.applicableLaw && (
                    <span>{a.analysis.applicableLaw.length} source(s)</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="py-8 text-center fade-in">
            <Icon name="DocumentTextIcon" size={32} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-semibold">Aucun document généré</p>
            <p className="text-xs text-muted-foreground">Export documentaire : sprint S5.</p>
          </div>
        )}
      </div>
    </div>
  );
}
