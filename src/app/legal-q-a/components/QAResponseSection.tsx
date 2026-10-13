'use client';

import React, { useMemo, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import StatusBadge from '@/components/ui/StatusBadge';
import type { QAResponse, QACitation } from './LegalQAContent';

interface QAResponseSectionProps {
  response: QAResponse;
  onCitationClick: (citation: QACitation) => void;
}

export default function QAResponseSection({ response, onCitationClick }: QAResponseSectionProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    summary: true,
    rule: true,
    application: true,
    uncertainties: true,
    assertions: true,
  });

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const claimCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of response.citations) {
      counts[c.claimStatus] = (counts[c.claimStatus] || 0) + 1;
    }
    for (const a of response.assertions ?? []) {
      counts[a.status] = (counts[a.status] || 0) + 1;
    }
    return counts;
  }, [response.citations, response.assertions]);

  const supportedCitations = response.citations.filter(
    (c) => c.claimStatus === 'supported' || c.claimStatus === 'inferred'
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="card overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection('summary')}
          className="flex items-center justify-between w-full p-4 text-left hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary/10 rounded-lg flex items-center justify-center">
              <Icon name="DocumentTextIcon" size={14} className="text-primary" />
            </div>
            <span className="text-sm font-semibold text-foreground">Résumé</span>
          </div>
          <Icon
            name={expandedSections.summary ? 'ChevronUpIcon' : 'ChevronDownIcon'}
            size={16}
            className="text-muted-foreground"
          />
        </button>
        {expandedSections.summary && (
          <div className="px-4 pb-4 fade-in">
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
              {response.summary}
            </p>
            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border flex-wrap">
              <span className="text-[11px] text-muted-foreground">Statuts observés :</span>
              {Object.entries(claimCounts).map(([status, n]) => (
                <span key={status} className="inline-flex items-center gap-1">
                  <StatusBadge type="claim" value={status as QACitation['claimStatus']} />
                  <span className="text-[11px] text-muted-foreground font-mono-ref">{n}</span>
                </span>
              ))}
              {Object.keys(claimCounts).length === 0 && (
                <span className="text-[11px] text-muted-foreground">aucune citation</span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection('rule')}
          className="flex items-center justify-between w-full p-4 text-left hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-accent/10 rounded-lg flex items-center justify-center">
              <Icon name="ScaleIcon" size={14} className="text-accent" />
            </div>
            <span className="text-sm font-semibold text-foreground">Règle de droit applicable</span>
          </div>
          <Icon
            name={expandedSections.rule ? 'ChevronUpIcon' : 'ChevronDownIcon'}
            size={16}
            className="text-muted-foreground"
          />
        </button>
        {expandedSections.rule && (
          <div className="px-4 pb-4 fade-in">
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
              {response.legalRule}
            </p>
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Sources utilisées (vérifiées)
              </p>
              <div className="flex flex-wrap gap-2">
                {supportedCitations.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Aucune source « supported/inferred » — voir panel citations ou mode abstention.
                  </p>
                ) : (
                  supportedCitations.slice(0, 8).map((citation) => (
                    <button
                      key={`rule-cit-${citation.id}`}
                      type="button"
                      onClick={() => onCitationClick(citation)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 hover:bg-primary/20 rounded-lg transition-colors"
                    >
                      <Icon name="BookOpenIcon" size={12} className="text-primary" />
                      <span className="font-mono-ref text-xs font-medium text-primary">
                        {citation.reference} — {citation.article}
                      </span>
                      <StatusBadge type="claim" value={citation.claimStatus} size="sm" />
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <button
          type="button"
          onClick={() => toggleSection('application')}
          className="flex items-center justify-between w-full p-4 text-left hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-green-100 rounded-lg flex items-center justify-center">
              <Icon name="AdjustmentsHorizontalIcon" size={14} className="text-green-700" />
            </div>
            <span className="text-sm font-semibold text-foreground">Application & Limites</span>
          </div>
          <Icon
            name={expandedSections.application ? 'ChevronUpIcon' : 'ChevronDownIcon'}
            size={16}
            className="text-muted-foreground"
          />
        </button>
        {expandedSections.application && (
          <div className="px-4 pb-4 fade-in">
            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
              {response.application}
            </p>
          </div>
        )}
      </div>

      {response.uncertainties.length > 0 && (
        <div className="card overflow-hidden border-amber-200">
          <button
            type="button"
            onClick={() => toggleSection('uncertainties')}
            className="flex items-center justify-between w-full p-4 text-left hover:bg-amber-50/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center">
                <Icon name="QuestionMarkCircleIcon" size={14} className="text-amber-600" />
              </div>
              <span className="text-sm font-semibold text-foreground">Incertitudes identifiées</span>
              <span className="claim-badge-uncertain text-[11px] px-2 py-0.5 rounded-full font-medium">
                {response.uncertainties.length}
              </span>
            </div>
            <Icon
              name={expandedSections.uncertainties ? 'ChevronUpIcon' : 'ChevronDownIcon'}
              size={16}
              className="text-muted-foreground"
            />
          </button>
          {expandedSections.uncertainties && (
            <div className="px-4 pb-4 fade-in space-y-2">
              {response.uncertainties.map((uncertainty, i) => (
                <div
                  key={`uncertainty-${i}`}
                  className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg"
                >
                  <Icon
                    name="ExclamationTriangleIcon"
                    size={14}
                    className="text-amber-500 flex-shrink-0 mt-0.5"
                  />
                  <p className="text-xs text-amber-800 leading-relaxed">{uncertainty}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {(response.assertions?.length ?? 0) > 0 && (
        <div className="card overflow-hidden">
          <button
            type="button"
            onClick={() => toggleSection('assertions')}
            className="flex items-center justify-between w-full p-4 text-left hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-slate-100 rounded-lg flex items-center justify-center">
                <Icon name="ListBulletIcon" size={14} className="text-slate-700" />
              </div>
              <span className="text-sm font-semibold text-foreground">
                Affirmations (statut interne)
              </span>
              <span className="text-[11px] text-muted-foreground font-mono-ref">
                {response.assertions!.length}
              </span>
            </div>
            <Icon
              name={expandedSections.assertions ? 'ChevronUpIcon' : 'ChevronDownIcon'}
              size={16}
              className="text-muted-foreground"
            />
          </button>
          {expandedSections.assertions && (
            <div className="px-4 pb-4 fade-in space-y-2">
              {response.assertions!.map((a, i) => (
                <div
                  key={`assertion-${i}`}
                  className={`flex items-start gap-2 p-3 rounded-lg border ${
                    a.status === 'unsupported'
                      ? 'bg-red-50 border-red-100'
                      : 'bg-muted/40 border-border'
                  }`}
                >
                  <StatusBadge type="claim" value={a.status} size="sm" />
                  <p className="text-xs text-foreground leading-relaxed flex-1">{a.text}</p>
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground">
                Les affirmations <strong>unsupported</strong> ne sont pas des conclusions juridiques.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
