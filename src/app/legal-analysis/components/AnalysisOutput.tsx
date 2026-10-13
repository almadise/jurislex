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
  available: {
    label: 'Disponible',
    className: 'bg-green-100 text-green-700',
    icon: 'CheckCircleIcon',
  },
  to_gather: {
    label: 'À rassembler',
    className: 'bg-amber-100 text-amber-700',
    icon: 'ClockIcon',
  },
  missing: {
    label: 'Manquant',
    className: 'bg-red-100 text-red-700',
    icon: 'XCircleIcon',
  },
};

export default function AnalysisOutput({ analysis, onBack }: AnalysisOutputProps) {
  const [activeSection, setActiveSection] = useState<string>('qualification');

  const sections = [
    { id: 'qualification', label: 'Qualification', icon: 'ScaleIcon' },
    { id: 'facts', label: 'Faits / Hypothèses', icon: 'UsersIcon' },
    { id: 'law', label: 'Droit applicable', icon: 'BookOpenIcon' },
    { id: 'calcs', label: 'Calculs', icon: 'CalculatorIcon' },
    { id: 'risks', label: 'Risques', icon: 'ExclamationTriangleIcon' },
    { id: 'evidence', label: 'Preuves', icon: 'DocumentMagnifyingGlassIcon' },
    { id: 'steps', label: 'Démarches', icon: 'ListBulletIcon' },
  ] as const;

  const confidenceColor =
    analysis.confidenceLevel >= 80
      ? 'text-green-600'
      : analysis.confidenceLevel >= 60
        ? 'text-amber-600'
        : 'text-red-600';

  return (
    <div className="flex gap-6 flex-col">
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <StatusBadge type="risk" value={analysis.overallRisk} size="md" />
              <span className={`text-sm font-semibold tabular-nums ${confidenceColor}`}>
                Confiance : {analysis.confidenceLevel}%
              </span>
              {analysis.engine && (
                <span className="text-[11px] font-mono-ref px-2 py-0.5 bg-muted rounded">
                  {analysis.engine}
                </span>
              )}
            </div>
            <h2 className="text-sm font-semibold text-foreground">Analyse juridique structurée</h2>
            {analysis.warningMessage && (
              <p className="text-xs text-muted-foreground mt-2 max-w-2xl">
                {analysis.warningMessage}
              </p>
            )}
          </div>
        </div>

        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${
              analysis.confidenceLevel >= 80
                ? 'bg-green-500'
                : analysis.confidenceLevel >= 60
                  ? 'bg-amber-500'
                  : 'bg-red-500'
            }`}
            style={{ width: `${analysis.confidenceLevel}%` }}
          />
        </div>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin pb-1">
        {sections.map((s) => (
          <button
            key={`analysis-sec-${s.id}`}
            type="button"
            onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
              activeSection === s.id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <Icon name={s.icon as Parameters<typeof Icon>[0]['name']} size={14} />
            {s.label}
          </button>
        ))}
      </div>

      <div className="card p-6 fade-in">
        {activeSection === 'qualification' && (
          <div>
            <h3 className="section-header mb-4">Qualification juridique</h3>
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg mb-4">
              <p className="text-sm text-foreground leading-relaxed">{analysis.qualification}</p>
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
              Questions juridiques
            </p>
            <div className="space-y-2">
              {analysis.factObject.legalIssues.map((issue, i) => (
                <div key={`issue-${i}`} className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                  <span className="w-5 h-5 bg-primary/10 text-primary text-xs font-bold rounded-full flex items-center justify-center flex-shrink-0">
                    {i + 1}
                  </span>
                  <p className="text-sm text-foreground">{issue}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeSection === 'facts' && (
          <div className="space-y-6">
            <div>
              <h3 className="section-header mb-3">Faits utilisateur</h3>
              <div className="space-y-2">
                {(analysis.userFacts || analysis.factObject.admittedFacts).map((f, i) => (
                  <div
                    key={`uf-${i}`}
                    className="flex items-start gap-2 p-2.5 bg-green-50 border border-green-100 rounded-lg"
                  >
                    <Icon name="CheckCircleIcon" size={14} className="text-green-600 mt-0.5" />
                    <p className="text-xs text-green-900">{f}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="section-header mb-3">Hypothèses système</h3>
              <div className="space-y-2">
                {(analysis.systemHypotheses || analysis.factObject.hypotheses || []).map((h, i) => (
                  <div
                    key={`hyp-${i}`}
                    className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-100 rounded-lg"
                  >
                    <Icon name="ExclamationTriangleIcon" size={14} className="text-amber-600 mt-0.5" />
                    <p className="text-xs text-amber-900">{h}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h3 className="section-header mb-3">Parties & chronologie</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                {analysis.factObject.parties.map((party, i) => (
                  <div key={`party-${i}`} className="p-3 bg-muted/50 rounded-lg border border-border">
                    <p className="text-sm font-semibold">{party.name}</p>
                    <p className="text-xs text-muted-foreground">{party.quality}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {analysis.factObject.dates.map((d, i) => (
                  <div key={`date-${i}`} className="flex gap-3 text-sm">
                    <span className="font-mono-ref text-primary w-28">{d.date}</span>
                    <span className="text-muted-foreground">{d.label}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-4">
                Juridiction estimée : {analysis.factObject.jurisdiction}
              </p>
            </div>
          </div>
        )}

        {activeSection === 'law' && (
          <div>
            <h3 className="section-header mb-4">Droit applicable (corpus récupéré)</h3>
            {analysis.applicableLaw.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucune disposition suffisamment pertinente — prudence maximale.
              </p>
            ) : (
              <div className="space-y-3">
                {analysis.applicableLaw.map((law, i) => (
                  <div
                    key={`law-${i}`}
                    className="p-3 bg-muted/50 rounded-lg border border-border"
                  >
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono-ref text-xs font-semibold text-primary">
                        {law.reference}
                      </span>
                      <span className="font-mono-ref text-xs text-accent">{law.article}</span>
                      {law.verified !== false && (
                        <span className="text-[10px] text-green-700">vérifié</span>
                      )}
                      {law.page != null && law.page > 0 && (
                        <span className="text-[10px] text-muted-foreground">p. {law.page}</span>
                      )}
                    </div>
                    <p className="text-xs text-foreground">{law.relevance}</p>
                    {law.excerpt && (
                      <p className="text-[11px] text-muted-foreground mt-2 line-clamp-3">
                        {law.excerpt}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
            <p className="text-sm mt-4 p-3 bg-muted/50 rounded-lg">
              {analysis.factObject.legalRelation}
            </p>
          </div>
        )}

        {activeSection === 'calcs' && (
          <div>
            <h3 className="section-header mb-2">Calculs déterministes</h3>
            <p className="text-xs text-muted-foreground mb-4">
              Produits par le moteur de règles testé — pas par estimation LLM libre. Les statuts{' '}
              <code className="font-mono-ref">hypothesis_only</code> doivent être validés.
            </p>
            {(analysis.calculations || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Données insuffisantes pour un calcul (dates / salaire).
              </p>
            ) : (
              <div className="space-y-3">
                {analysis.calculations!.map((c) => (
                  <div key={c.id} className="p-4 border border-border rounded-lg bg-muted/30">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm font-semibold text-foreground">{c.label}</p>
                      <span
                        className={`text-[10px] font-mono-ref px-2 py-0.5 rounded ${
                          c.status === 'hypothesis_only'
                            ? 'bg-amber-100 text-amber-800'
                            : c.status === 'blocked_missing_input'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {c.status}
                      </span>
                    </div>
                    <p className="text-lg font-bold tabular-nums text-primary">
                      {c.result}
                      {c.unit ? ` ${c.unit}` : ''}
                    </p>
                    <p className="text-[11px] font-mono-ref text-muted-foreground mt-1">
                      {c.formula}
                    </p>
                    <ul className="mt-2 space-y-1">
                      {c.assumptions.map((a, i) => (
                        <li key={i} className="text-[11px] text-muted-foreground">
                          · {a}
                        </li>
                      ))}
                    </ul>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      Réf. : {c.legalReferences.join(' · ')}
                    </p>
                  </div>
                ))}
              </div>
            )}
            {analysis.factObject.amounts.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                  Montants retenus
                </p>
                {analysis.factObject.amounts.map((a, i) => (
                  <p key={i} className="text-sm">
                    {a.label} : <span className="font-mono-ref">{a.amount}</span>
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {activeSection === 'risks' && (
          <div>
            <h3 className="section-header mb-4">Risques</h3>
            <div className="space-y-3 mb-6">
              {analysis.risks.map((risk, i) => (
                <div
                  key={`risk-${i}`}
                  className={`flex items-start gap-3 p-4 rounded-lg border ${
                    risk.level === 'high'
                      ? 'bg-red-50 border-red-200'
                      : risk.level === 'medium'
                        ? 'bg-amber-50 border-amber-200'
                        : 'bg-green-50 border-green-200'
                  }`}
                >
                  <StatusBadge type="risk" value={risk.level} size="sm" />
                  <p className="text-sm flex-1">{risk.description}</p>
                </div>
              ))}
            </div>
            <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
              Informations manquantes
            </p>
            {analysis.factObject.missingInfo.map((info, i) => (
              <div key={`missing-${i}`} className="flex items-center gap-2 p-2.5 bg-muted/50 rounded-lg mb-1">
                <Icon name="MinusCircleIcon" size={14} className="text-muted-foreground" />
                <p className="text-xs">{info}</p>
              </div>
            ))}
          </div>
        )}

        {activeSection === 'evidence' && (
          <div>
            <h3 className="section-header mb-4">Preuves à réunir</h3>
            <div className="space-y-2">
              {analysis.evidence.map((ev, i) => {
                const config = evidenceStatusConfig[ev.status];
                return (
                  <div
                    key={`ev-${i}`}
                    className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border"
                  >
                    <Icon
                      name={config.icon as Parameters<typeof Icon>[0]['name']}
                      size={16}
                    />
                    <p className="text-sm flex-1">{ev.item}</p>
                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${config.className}`}
                    >
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
            <h3 className="section-header mb-4">Prochaines démarches</h3>
            <div className="space-y-3">
              {analysis.nextSteps.map((step) => (
                <div
                  key={`step-${step.priority}`}
                  className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg border border-border"
                >
                  <div className="w-7 h-7 bg-primary text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {step.priority}
                  </div>
                  <div>
                    <p className="text-sm">{step.action}</p>
                    {step.deadline && (
                      <p className="text-xs text-muted-foreground font-mono-ref mt-1">
                        Avant le {step.deadline}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button type="button" onClick={onBack} className="btn-secondary">
          <Icon name="ArrowLeftIcon" size={16} />
          Nouvelle analyse
        </button>
        {analysis.matterId && (
          <a href="/case-management" className="btn-secondary text-xs">
            <Icon name="FolderOpenIcon" size={14} />
            Voir les dossiers
          </a>
        )}
        <a
          href="/legal-q-a"
          className="btn-ghost text-xs text-muted-foreground"
          title="Poser une question sur le corpus"
        >
          Q&amp;A sourcée
        </a>
      </div>
    </div>
  );
}
