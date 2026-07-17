'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import StatusBadge from '@/components/ui/StatusBadge';
import type { Matter } from './CaseManagementContent';

interface CaseDetailPanelProps {
  matter: Matter;
  onClose: () => void;
}

const mockTimeline = [
  { id: 'ev-001', date: '17/07/2026', time: '10:34', type: 'analysis', label: 'Analyse de situation lancée', user: 'Fotso Mbarga' },
  { id: 'ev-002', date: '15/07/2026', time: '14:12', type: 'document', label: 'Mise en demeure générée et exportée en PDF', user: 'Fotso Mbarga' },
  { id: 'ev-003', date: '12/07/2026', time: '09:22', type: 'search', label: 'Recherche : Art. 40-42 Code du Travail', user: 'Fotso Mbarga' },
  { id: 'ev-004', date: '08/07/2026', time: '16:50', type: 'qa', label: 'Q&A : obligations employeur licenciement économique', user: 'Fotso Mbarga' },
  { id: 'ev-005', date: '02/07/2026', time: '11:00', type: 'create', label: 'Dossier créé', user: 'Fotso Mbarga' },
];

const mockDocuments = [
  { id: 'doc-001', name: 'Mise en demeure — 15/07/2026', type: 'docx', size: '24 Ko', date: '15/07/2026' },
];

const mockParties = [
  { id: 'party-001', name: 'Mme Nkeng Abanda', quality: 'Salariée — Demanderesse', contact: 'nkeng.abanda@email.cm' },
  { id: 'party-002', name: 'SARL Fotso & Associés', quality: 'Employeur — Défendeur', contact: 'contact@fotso-associes.cm' },
];

const mockEvidence = [
  { id: 'ev-p-001', name: 'Lettre de licenciement', status: 'to_gather' as const, notes: 'À demander à l\'employeur' },
  { id: 'ev-p-002', name: 'Contrat de travail signé', status: 'to_gather' as const, notes: '' },
  { id: 'ev-p-003', name: 'Attestation de travail', status: 'available' as const, notes: 'Reçue le 29/05/2026' },
  { id: 'ev-p-004', name: 'Bulletins de salaire (12 mois)', status: 'to_gather' as const, notes: '' },
  { id: 'ev-p-005', name: 'PV consultation délégués du personnel', status: 'missing' as const, notes: 'Probablement inexistant' },
];

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
};

export default function CaseDetailPanel({ matter, onClose }: CaseDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'parties' | 'analyses' | 'documents'>('overview');

  const tabs = [
    { id: 'overview', label: 'Aperçu', icon: 'InformationCircleIcon' },
    { id: 'timeline', label: 'Chronologie', icon: 'ClockIcon' },
    { id: 'parties', label: 'Parties & Preuves', icon: 'UsersIcon' },
    { id: 'analyses', label: 'Analyses', icon: 'DocumentMagnifyingGlassIcon' },
    { id: 'documents', label: 'Documents', icon: 'DocumentTextIcon' },
  ] as const;

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
                  <span className="text-white text-[10px] font-bold">FM</span>
                </div>
                <p className="text-sm text-foreground">{matter.assignedTo}</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="fade-in">
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
              <div className="space-y-4 pl-10">
                {mockTimeline.map((event) => {
                  const config = timelineTypeConfig[event.type as keyof typeof timelineTypeConfig];
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
          </div>
        )}

        {activeTab === 'parties' && (
          <div className="space-y-4 fade-in">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Parties</p>
              <div className="space-y-2">
                {mockParties.map((party) => (
                  <div key={party.id} className="p-3 bg-muted/50 rounded-lg border border-border">
                    <p className="text-sm font-semibold text-foreground">{party.name}</p>
                    <p className="text-xs text-muted-foreground">{party.quality}</p>
                    <p className="text-xs text-primary mt-1">{party.contact}</p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Preuves</p>
              <div className="space-y-2">
                {mockEvidence.map((ev) => {
                  const config = evidenceStatusConfig[ev.status];
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
            </div>
          </div>
        )}

        {activeTab === 'analyses' && (
          <div className="space-y-3 fade-in">
            {[
              { id: 'an-001', title: 'Analyse de licenciement économique', date: '17/07/2026', confidence: 72, risk: 'medium' as const },
              { id: 'an-002', title: 'Q&A : obligations employeur', date: '08/07/2026', confidence: 88, risk: 'low' as const },
              { id: 'an-003', title: 'Recherche Code du Travail Art. 40-42', date: '12/07/2026', confidence: 95, risk: 'low' as const },
            ].map((analysis) => (
              <div key={analysis.id} className="p-3 bg-muted/50 rounded-lg border border-border hover:border-primary/30 cursor-pointer transition-colors">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="text-xs font-medium text-foreground">{analysis.title}</p>
                  <StatusBadge type="risk" value={analysis.risk} size="sm" />
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-[11px] text-muted-foreground font-mono-ref">{analysis.date}</p>
                  <div className="flex items-center gap-1 flex-1">
                    <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full"
                        style={{ width: `${analysis.confidence}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-muted-foreground tabular-nums">{analysis.confidence}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="space-y-3 fade-in">
            {mockDocuments.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-center">
                <Icon name="DocumentTextIcon" size={32} className="text-muted-foreground mb-2" />
                <p className="text-sm font-semibold text-foreground">Aucun document généré</p>
                <p className="text-xs text-muted-foreground mb-4">Générez votre premier document pour ce dossier.</p>
                <button className="btn-primary text-xs">
                  <Icon name="PlusIcon" size={14} />
                  Générer un document
                </button>
              </div>
            ) : (
              mockDocuments.map((doc) => (
                <div key={doc.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border">
                  <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Icon name="DocumentTextIcon" size={16} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">{doc.name}</p>
                    <p className="text-[11px] text-muted-foreground">{doc.type.toUpperCase()} · {doc.size} · {doc.date}</p>
                  </div>
                  <button className="p-1.5 rounded hover:bg-muted transition-colors" aria-label="Télécharger le document">
                    <Icon name="ArrowDownTrayIcon" size={14} className="text-muted-foreground" />
                  </button>
                </div>
              ))
            )}
            <button className="btn-secondary w-full justify-center text-xs">
              <Icon name="PlusIcon" size={14} />
              Générer un nouveau document
            </button>
          </div>
        )}
      </div>
    </div>
  );
}