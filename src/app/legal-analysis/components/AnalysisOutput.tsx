'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import StatusBadge from '@/components/ui/StatusBadge';
import type { StructuredAnalysis } from './LegalAnalysisContent';

interface AnalysisOutputProps {
  analysis: StructuredAnalysis;
  onBack: () => void;
}

const evidenceStatusConfig = {
  available: { label: 'Disponible', className: 'bg-green-100 text-green-700', icon: 'CheckCircleIcon' },
  to_gather: { label: 'À rassembler', className: 'bg-amber-100 text-amber-700', icon: 'ClockIcon' },
  missing: { label: 'Manquant', className: 'bg-red-100 text-red-700', icon: 'XCircleIcon' },
};

export default function AnalysisOutput({ analysis, onBack }: AnalysisOutputProps) {
  const [activeSection, setActiveSection] = useState<string>('qualification');

  const sections = [
    { id: 'qualification', label: 'Qualification', icon: 'ScaleIcon' },
    { id: 'parties', label: 'Parties & Chronologie', icon: 'UsersIcon' },
    { id: 'law', label: 'Droit applicable', icon: 'BookOpenIcon' },
    { id: 'risks', label: 'Risques', icon: 'ExclamationTriangleIcon' },
    { id: 'evidence', label: 'Preuves', icon: 'DocumentMagnifyingGlassIcon' },
    { id: 'steps', label: 'Prochaines démarches', icon: 'ListBulletIcon' },
  ] as const;

  const confidenceColor =
    analysis.confidenceLevel >= 80 ? 'text-green-600' :
    analysis.confidenceLevel >= 60 ? 'text-amber-600': 'text-red-600';

  return (
    <div className="flex gap-6">
      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col gap-4">
        {/* Summary header */}
        <div className="card p-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <StatusBadge type="risk" value={analysis.overallRisk} size="md" />
                <span className={`text-sm font-semibold tabular-nums ${confidenceColor}`}>
                  Confiance : {analysis.confidenceLevel}%
                </span>
              </div>
              <h2 className="text-sm font-semibold text-foreground">Analyse juridique structurée</h2>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn-secondary text-xs">
                <Icon name="FolderPlusIcon" size={14} />
                Ajouter au dossier
              </button>
              <button className="btn-primary text-xs">
                <Icon name="DocumentTextIcon" size={14} />
                Générer un document
              </button>
            </div>
          </div>

          {/* Confidence bar */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Niveau de confiance de l'analyse</span>
              <span className={`text-xs font-bold tabular-nums ${confidenceColor}`}>{analysis.confidenceLevel}%</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  analysis.confidenceLevel >= 80 ? 'bg-green-500' :
                  analysis.confidenceLevel >= 60 ? 'bg-amber-500' :'bg-red-500'
                }`}
                style={{ width: `${analysis.confidenceLevel}%` }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Confiance limitée par : informations manquantes ({analysis.factObject.missingInfo.length} éléments non confirmés).
            </p>
          </div>
        </div>

        {/* Section nav */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin pb-1">
          {sections.map((s) => (
            <button
              key={`analysis-sec-${s.id}`}
              onClick={() => setActiveSection(s.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
                activeSection === s.id
                  ? 'bg-primary text-primary-foreground': 'text-muted-foreground hover:bg-muted'
              }`}
            >
              <Icon name={s.icon as Parameters<typeof Icon>[0]['name']} size={14} />
              {s.label}
            </button>
          ))}
        </div>

        {/* Section content */}
        <div className="card p-6 fade-in">
          {activeSection === 'qualification' && (
            <div>
              <h3 className="section-header mb-4">Qualification juridique</h3>
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg mb-4">
                <p className="text-sm text-foreground leading-relaxed">{analysis.qualification}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  Questions juridiques identifiées
                </p>
                <div className="space-y-2">
                  {analysis.factObject.legalIssues.map((issue, i) => (
                    <div key={`issue-${i}`} className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                      <span className="w-5 h-5 bg-primary/10 text-primary text-xs font-bold rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        {i + 1}
                      </span>
                      <p className="text-sm text-foreground">{issue}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeSection === 'parties' && (
            <div>
              <h3 className="section-header mb-4">Parties & Chronologie</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {analysis.factObject.parties.map((party, i) => (
                  <div key={`party-${i}`} className="p-3 bg-muted/50 rounded-lg border border-border">
                    <p className="text-sm font-semibold text-foreground">{party.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{party.quality}</p>
                  </div>
                ))}
              </div>

              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Chronologie</p>
              <div className="relative">
                <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />
                <div className="space-y-3 pl-8">
                  {analysis.factObject.dates.map((d, i) => (
                    <div key={`date-${i}`} className="relative">
                      <div className="absolute -left-5 w-2 h-2 bg-primary rounded-full top-1.5" />
                      <p className="text-xs text-muted-foreground">{d.label}</p>
                      <p className="text-sm font-medium text-foreground font-mono-ref">{d.date}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Urgences & Délais</p>
                <div className="space-y-2">
                  {analysis.factObject.urgencies.map((u, i) => (
                    <div key={`urgency-${i}`} className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <Icon name="ClockIcon" size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-800">{u}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeSection === 'law' && (
            <div>
              <h3 className="section-header mb-4">Droit applicable</h3>
              <div className="space-y-3">
                {analysis.applicableLaw.map((law, i) => (
                  <div key={`law-${i}`} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg border border-border">
                    <Icon name="BookOpenIcon" size={16} className="text-primary flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono-ref text-xs font-semibold text-primary">{law.reference}</span>
                        <span className="font-mono-ref text-xs font-medium text-accent">{law.article}</span>
                      </div>
                      <p className="text-xs text-foreground">{law.relevance}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Relation juridique</p>
                <p className="text-sm text-foreground p-3 bg-muted/50 rounded-lg">{analysis.factObject.legalRelation}</p>
              </div>
            </div>
          )}

          {activeSection === 'risks' && (
            <div>
              <h3 className="section-header mb-4">Analyse des risques</h3>
              <div className="space-y-3 mb-6">
                {analysis.risks.map((risk, i) => (
                  <div
                    key={`risk-${i}`}
                    className={`flex items-start gap-3 p-4 rounded-lg border ${
                      risk.level === 'high' ? 'bg-red-50 border-red-200' :
                      risk.level === 'medium' ? 'bg-amber-50 border-amber-200' :'bg-green-50 border-green-200'
                    }`}
                  >
                    <StatusBadge type="risk" value={risk.level} size="sm" />
                    <p className={`text-sm flex-1 ${
                      risk.level === 'high' ? 'text-red-800' :
                      risk.level === 'medium' ? 'text-amber-800' :'text-green-800'
                    }`}>
                      {risk.description}
                    </p>
                  </div>
                ))}
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Informations manquantes</p>
                <div className="space-y-2">
                  {analysis.factObject.missingInfo.map((info, i) => (
                    <div key={`missing-${i}`} className="flex items-center gap-2 p-2.5 bg-muted/50 rounded-lg">
                      <Icon name="MinusCircleIcon" size={14} className="text-muted-foreground flex-shrink-0" />
                      <p className="text-xs text-foreground">{info}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeSection === 'evidence' && (
            <div>
              <h3 className="section-header mb-4">Preuves à réunir</h3>
              <div className="space-y-2">
                {analysis.evidence.map((ev, i) => {
                  const config = evidenceStatusConfig[ev.status];
                  return (
                    <div key={`ev-${i}`} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border">
                      <Icon name={config.icon as Parameters<typeof Icon>[0]['name']} size={16} className={config.className.split(' ')[1]} />
                      <p className="text-sm text-foreground flex-1">{ev.item}</p>
                      <span className={`inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full ${config.className}`}>
                        {config.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeSection === 'steps' && (
            <div>
              <h3 className="section-header mb-4">Prochaines démarches recommandées</h3>
              <div className="space-y-3">
                {analysis.nextSteps.map((step) => (
                  <div key={`step-${step.priority}`} className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg border border-border">
                    <div className="w-7 h-7 bg-primary text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {step.priority}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-foreground">{step.action}</p>
                      {step.deadline && (
                        <div className="flex items-center gap-1 mt-1">
                          <Icon name="CalendarIcon" size={12} className="text-muted-foreground" />
                          <p className="text-xs text-muted-foreground font-mono-ref">Avant le {step.deadline}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button onClick={onBack} className="btn-secondary">
            <Icon name="ArrowLeftIcon" size={16} />
            Modifier les réponses
          </button>
          <button className="btn-primary ml-auto">
            <Icon name="DocumentTextIcon" size={16} />
            Générer une mise en demeure
          </button>
        </div>
      </div>

      {/* Sidebar: amounts */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-4">
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Montants estimés</h3>
          <div className="space-y-3">
            {analysis.factObject.amounts.map((amt, i) => (
              <div key={`amt-${i}`} className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{amt.label}</p>
                <p className="text-sm font-semibold text-foreground font-mono-ref tabular-nums">{amt.amount}</p>
              </div>
            ))}
            <div className="pt-2 border-t border-border flex items-center justify-between">
              <p className="text-xs font-semibold text-foreground">Total estimé</p>
              <p className="text-sm font-bold text-accent font-mono-ref tabular-nums">1 980 000 FCFA</p>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            * Estimations calculées sur base des dispositions légales. Hors intérêts et frais de procédure.
          </p>
        </div>

        <div className="card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Juridiction compétente</h3>
          <p className="text-xs text-foreground leading-relaxed">{analysis.factObject.jurisdiction}</p>
        </div>

        <div className="card p-4 border-amber-200 bg-amber-50">
          <div className="flex items-start gap-2">
            <Icon name="ExclamationTriangleIcon" size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-700 mb-1">Avertissement</p>
              <p className="text-xs text-amber-600 leading-relaxed">
                Cette analyse est fondée sur les informations fournies et le corpus indexé au 17/07/2026. Elle ne constitue pas un avis juridique. Consultez un avocat avant toute démarche.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}