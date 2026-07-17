'use client';

import React, { useState, useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';
import StatusBadge from '@/components/ui/StatusBadge';
import type { Matter } from './CaseManagementContent';
import { caseService } from '@/lib/services/caseService';

interface CaseDetailPanelProps {
  matter: Matter;
  onClose: () => void;
}

const evidenceStatusConfig = {
  available: { label: 'Disponible', className: 'bg-green-100 text-green-700', icon: 'CheckCircleIcon' },
  to_gather: { label: 'À rassembler', className: 'bg-amber-100 text-amber-700', icon: 'ClockIcon' },
  missing: { label: 'Manquant', className: 'bg-red-100 text-red-700', icon: 'XCircleIcon' },
};

const timelineTypeConfig = {
  analysis: { icon: 'DocumentMagnifyingGlassIcon', color: 'bg-purple-100 text-purple-600' },
  document: { icon: 'DocumentTextIcon', color: 'bg-blue-100 text-blue-600' },
  search: { icon: 'MagnifyingGlassIcon', color: 'bg-green-100 text-green-600' },
  qa: { icon: 'ChatBubbleLeftRightIcon', color: 'bg-amber-100 text-amber-600' },
  create: { icon: 'FolderPlusIcon', color: 'bg-primary/10 text-primary' },
  update: { icon: 'PencilSquareIcon', color: 'bg-gray-100 text-gray-600' },
  note: { icon: 'ChatBubbleBottomCenterTextIcon', color: 'bg-indigo-100 text-indigo-600' },
};

export default function CaseDetailPanel({ matter, onClose }: CaseDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'parties' | 'analyses' | 'documents'>('overview');

  const [timeline, setTimeline] = useState<any[]>([]);
  const [parties, setParties] = useState<any[]>([]);
  const [evidence, setEvidence] = useState<any[]>([]);
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [tabLoading, setTabLoading] = useState(false);

  useEffect(() => {
    setTimeline([]);
    setParties([]);
    setEvidence([]);
    setAnalyses([]);
    setDocuments([]);
    setActiveTab('overview');
  }, [matter.id]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setTabLoading(true);
      try {
        if (activeTab === 'timeline' && timeline.length === 0) {
          const data = await caseService.getTimeline(matter.id);
          if (!cancelled) setTimeline(data);
        } else if (activeTab === 'parties' && parties.length === 0) {
          const [p, e] = await Promise.all([
            caseService.getParties(matter.id),
            caseService.getEvidence(matter.id),
          ]);
          if (!cancelled) {
            setParties(p);
            setEvidence(e);
          }
        } else if (activeTab === 'analyses' && analyses.length === 0) {
          const data = await caseService.getAnalyses(matter.id);
          if (!cancelled) setAnalyses(data);
        } else if (activeTab === 'documents' && documents.length === 0) {
          const data = await caseService.getDocuments(matter.id);
          if (!cancelled) setDocuments(data);
        }
      } finally {
        if (!cancelled) setTabLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [activeTab, matter.id]);

  const tabs = [
    { id: 'overview', label: 'Aperçu', icon: 'InformationCircleIcon' },
    { id: 'timeline', label: 'Chronologie', icon: 'ClockIcon' },
    { id: 'parties', label: 'Parties & Preuves', icon: 'UsersIcon' },
    { id: 'analyses', label: 'Analyses', icon: 'DocumentMagnifyingGlassIcon' },
    { id: 'documents', label: 'Documents', icon: 'DocumentTextIcon' },
  ] as const;

  const LoadingSkeleton = () => (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-12 bg-muted rounded-lg" />
      ))}
    </div>
  );

  return (
    <div className="card h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border flex-shrink-0">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono-ref text-xs font-medium text-primary">{matter.reference}</span>
              <StatusBadge type="matter" value={matter.status} size="sm" />
              <StatusBadge type="risk" value={matter.riskLevel} size="sm" />
            </div>
            <h3 className="text-sm font-semibold text-foreground leading-snug">{matter.title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors flex-shrink-0"
            aria-label="Fermer le panneau"
          >
            <Icon name="XMarkIcon" size={16} className="text-muted-foreground" />
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground">
            <Icon name="CalendarIcon" size={12} className="inline mr-1" />
            Créé le {matter.createdAt}
          </span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">
            <Icon name="ClockIcon" size={12} className="inline mr-1" />
            Activité : {matter.lastActivity}
          </span>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-2 mt-3">
          <button className="btn-primary text-xs flex-1 justify-center">
            <Icon name="DocumentMagnifyingGlassIcon" size={14} />
            Analyser
          </button>
          <button className="btn-secondary text-xs flex-1 justify-center">
            <Icon name="DocumentTextIcon" size={14} />
            Générer
          </button>
          <button className="btn-ghost text-xs px-2">
            <Icon name="ArrowDownTrayIcon" size={14} />
          </button>
          <button className="btn-ghost text-xs px-2">
            <Icon name="EllipsisHorizontalIcon" size={14} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border overflow-x-auto scrollbar-thin flex-shrink-0">
        {tabs.map((t) => (
          <button
            key={`detail-tab-${t.id}`}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2 flex-shrink-0 ${
              activeTab === t.id
                ? 'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon name={t.icon as Parameters<typeof Icon>[0]['name']} size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
        {activeTab === 'overview' && (
          <div className="space-y-4 fade-in">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Domaine juridique</p>
              <p className="text-sm text-foreground">{matter.domain}</p>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Parties</p>
              <div className="space-y-1">
                {matter.parties.map((p) => (
                  <p key={`ov-party-${p.slice(0, 20)}`} className="text-sm text-foreground">{p}</p>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {matter.tags.map((tag) => (
                  <span key={`tag-${tag}`} className="text-[11px] px-2 py-0.5 bg-muted rounded-full text-muted-foreground">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <p className="text-2xl font-bold tabular-nums text-foreground">{matter.analyses}</p>
                <p className="text-xs text-muted-foreground">Analyses</p>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg text-center">
                <p className="text-2xl font-bold tabular-nums text-foreground">{matter.documents}</p>
                <p className="text-xs text-muted-foreground">Documents</p>
              </div>
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Responsable</p>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-accent rounded-full flex items-center justify-center">
                  <span className="text-white text-[10px] font-bold">
                    {matter.assignedTo
                      .split(' ')
                      .map((w) => w[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-foreground">{matter.assignedTo}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="fade-in">
            {tabLoading ? (
              <LoadingSkeleton />
            ) : timeline.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Aucun événement enregistré.</p>
            ) : (
              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
                <div className="space-y-4 pl-10">
                  {timeline.map((event) => {
                    const config = timelineTypeConfig[event.type as keyof typeof timelineTypeConfig] ?? timelineTypeConfig.note;
                    return (
                      <div key={event.id} className="relative">
                        <div className={`absolute -left-6 w-8 h-8 rounded-full flex items-center justify-center ${config.color}`}>
                          <Icon name={config.icon as Parameters<typeof Icon>[0]['name']} size={14} />
                        </div>
                        <div className="pb-4">
                          <p className="text-xs font-medium text-foreground">{event.label}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-[11px] text-muted-foreground font-mono-ref">{event.date} à {event.time}</p>
                            <span className="text-muted-foreground">·</span>
                            <p className="text-[11px] text-muted-foreground">{event.user}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'parties' && (
          <div className="space-y-4 fade-in">
            {tabLoading ? (
              <LoadingSkeleton />
            ) : (
              <>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Parties</p>
                  {parties.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucune partie enregistrée.</p>
                  ) : (
                    <div className="space-y-2">
                      {parties.map((party) => (
                        <div key={party.id} className="p-3 bg-muted/50 rounded-lg border border-border">
                          <p className="text-sm font-semibold text-foreground">{party.name}</p>
                          <p className="text-xs text-muted-foreground">{party.quality}</p>
                          {party.contact && <p className="text-xs text-primary mt-1">{party.contact}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Preuves</p>
                  {evidence.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucune pièce enregistrée.</p>
                  ) : (
                    <div className="space-y-2">
                      {evidence.map((ev) => {
                        const config = evidenceStatusConfig[ev.status as keyof typeof evidenceStatusConfig] ?? evidenceStatusConfig.to_gather;
                        return (
                          <div key={ev.id} className="flex items-start gap-2 p-2.5 bg-muted/50 rounded-lg border border-border">
                            <Icon name={config.icon as Parameters<typeof Icon>[0]['name']} size={14} className={config.className.split(' ')[1]} />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-medium text-foreground">{ev.name}</p>
                              {ev.notes && <p className="text-[11px] text-muted-foreground">{ev.notes}</p>}
                            </div>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0 ${config.className}`}>
                              {config.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'analyses' && (
          <div className="space-y-3 fade-in">
            {tabLoading ? (
              <LoadingSkeleton />
            ) : analyses.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Aucune analyse pour ce dossier.</p>
            ) : (
              analyses.map((an) => (
                <div key={an.id} className="p-3 bg-muted/50 rounded-lg border border-border">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="text-xs font-semibold text-foreground">{an.title}</p>
                    <StatusBadge type="risk" value={an.risk} size="sm" />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1.5 bg-border rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${an.confidence}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-mono-ref text-muted-foreground">{an.confidence}%</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 font-mono-ref">{an.date}</p>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="space-y-2 fade-in">
            {tabLoading ? (
              <LoadingSkeleton />
            ) : documents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Aucun document généré.</p>
            ) : (
              documents.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon name="DocumentTextIcon" size={16} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{doc.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {doc.type?.toUpperCase()} · {doc.size} · {doc.date}
                    </p>
                  </div>
                  <button className="btn-ghost p-1.5" aria-label="Télécharger">
                    <Icon name="ArrowDownTrayIcon" size={14} className="text-muted-foreground" />
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}