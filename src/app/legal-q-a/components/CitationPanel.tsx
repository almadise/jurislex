'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';
import StatusBadge from '@/components/ui/StatusBadge';
import SourceReader from '@/components/SourceReader';
import type { QACitation } from './LegalQAContent';

interface CitationPanelProps {
  citations: QACitation[];
  selectedCitation: QACitation | null;
  onSelect: (citation: QACitation | null) => void;
  showAll: boolean;
  onToggleShowAll: () => void;
}

const claimStatusOrder: Record<string, number> = {
  supported: 0,
  inferred: 1,
  uncertain: 2,
  conflicting: 3,
  unsupported: 4,
};

export default function CitationPanel({
  citations,
  selectedCitation,
  onSelect,
  showAll,
  onToggleShowAll,
}: CitationPanelProps) {
  const sorted = [...citations].sort(
    (a, b) => claimStatusOrder[a.claimStatus] - claimStatusOrder[b.claimStatus]
  );
  const displayed = showAll ? sorted : sorted.slice(0, 6);

  const counts = citations.reduce(
    (acc, c) => {
      acc[c.claimStatus] = (acc[c.claimStatus] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const allVerified = citations.length > 0 && citations.every((c) => c.verified !== false);

  return (
    <div className="card h-fit sticky top-[76px]">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Sources citées</h3>
          <span className="text-xs text-muted-foreground font-mono-ref">
            {citations.length} citation{citations.length > 1 ? 's' : ''}
          </span>
        </div>

        {citations.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Aucune citation vérifiée — mode abstention ou corpus sans hit.
          </p>
        ) : (
          <>
            <div className="flex items-center gap-1.5 mb-3 text-[11px]">
              <Icon
                name={allVerified ? 'CheckCircleIcon' : 'ExclamationTriangleIcon'}
                size={14}
                className={allVerified ? 'text-green-600' : 'text-amber-600'}
              />
              <span className={allVerified ? 'text-green-700' : 'text-amber-700'}>
                {allVerified
                  ? 'Toutes les citations pointent vers une disposition récupérée'
                  : 'Vérification partielle'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {(Object.entries(counts) as [string, number][]).map(([status, count]) => (
                <div key={`count-${status}`} className="flex items-center gap-1.5">
                  <StatusBadge type="claim" value={status as QACitation['claimStatus']} size="sm" />
                  <span className="text-xs font-mono-ref text-muted-foreground tabular-nums">
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="p-3 space-y-2 max-h-[600px] overflow-y-auto scrollbar-thin">
        {displayed.map((citation) => (
          <div
            key={citation.id}
            onClick={() => onSelect(selectedCitation?.id === citation.id ? null : citation)}
            className={`rounded-lg border p-3 cursor-pointer transition-all duration-150 ${
              selectedCitation?.id === citation.id
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/30 hover:bg-muted/30'
            }`}
            role="button"
            aria-pressed={selectedCitation?.id === citation.id}
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <p className="font-mono-ref text-xs font-semibold text-primary truncate">
                  {citation.reference}
                </p>
                <p className="font-mono-ref text-xs text-muted-foreground">{citation.article}</p>
              </div>
              <StatusBadge type="claim" value={citation.claimStatus} size="sm" />
            </div>

            <p className="text-xs text-foreground font-medium mb-1.5 line-clamp-2 leading-snug">
              {citation.title}
            </p>
            <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed mb-2">
              {citation.excerpt}
            </p>

            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge type="legal" value={citation.legalStatus} size="sm" />
              {citation.page > 0 && (
                <span className="text-[10px] text-muted-foreground">p. {citation.page}</span>
              )}
              {citation.matchScore != null && (
                <span className="text-[10px] text-muted-foreground font-mono-ref">
                  {citation.matchScore}%
                </span>
              )}
              <span className="text-[10px] text-muted-foreground ml-auto">{citation.authority}</span>
            </div>

            {citation.sourcePath && (
              <p className="mt-2 text-[10px] font-mono-ref text-muted-foreground truncate" title={citation.sourcePath}>
                {citation.sourcePath}
              </p>
            )}

            {citation.claimStatus === 'conflicting' && (
              <div className="mt-2 flex items-center gap-1.5 p-1.5 bg-purple-50 rounded">
                <Icon
                  name="ExclamationCircleIcon"
                  size={12}
                  className="text-purple-600 flex-shrink-0"
                />
                <p className="text-[10px] text-purple-700">Conflit détecté avec une autre source</p>
              </div>
            )}

            {selectedCitation?.id === citation.id && citation.sourcePath && (
              <div className="mt-3 border-t border-border pt-2">
                <SourceReader
                  sourcePath={citation.sourcePath}
                  page={citation.page}
                  article={citation.article}
                  title={citation.title}
                  excerpt={citation.excerpt}
                />
              </div>
            )}
          </div>
        ))}

        {citations.length > 6 && (
          <button
            type="button"
            onClick={onToggleShowAll}
            className="w-full text-xs text-primary hover:underline py-2 font-medium"
          >
            {showAll
              ? 'Afficher moins'
              : `Voir ${citations.length - 6} citation${citations.length - 6 > 1 ? 's' : ''} supplémentaire${citations.length - 6 > 1 ? 's' : ''}`}
          </button>
        )}
      </div>

      <div className="p-3 border-t border-border">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Seules les citations reliées à des identifiants internes vérifiés après retrieval sont
          affichées. Les affirmations non fondées ne sont pas présentées comme conclusions
          juridiques.
        </p>
      </div>
    </div>
  );
}
