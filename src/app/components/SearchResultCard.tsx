'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';
import StatusBadge from '@/components/ui/StatusBadge';
import type { SearchResult } from './LegalSearchContent';

interface SearchResultCardProps {
  result: SearchResult;
  isSelected: boolean;
  onClick: () => void;
}

const domainColors: Record<string, string> = {
  'Droit commercial OHADA': 'bg-blue-100 text-blue-700',
  'Droit du travail': 'bg-green-100 text-green-700',
  'Droit du travail / sécurité sociale': 'bg-green-100 text-green-700',
  'Droit civil': 'bg-purple-100 text-purple-700',
  'Droit des sociétés': 'bg-indigo-100 text-indigo-700',
  'Droit pénal': 'bg-red-100 text-red-700',
  'Droit foncier': 'bg-amber-100 text-amber-700',
  'Droit bancaire COBAC': 'bg-cyan-100 text-cyan-700',
  'Droit numérique': 'bg-pink-100 text-pink-700',
  'Marchés publics': 'bg-orange-100 text-orange-700',
  'Fiscalité et changes': 'bg-teal-100 text-teal-700',
};

export default function SearchResultCard({ result, isSelected, onClick }: SearchResultCardProps) {
  const scoreColor =
    result.matchScore >= 90 ? 'text-green-600' :
    result.matchScore >= 75 ? 'text-amber-600': 'text-muted-foreground';

  return (
    <div
      onClick={onClick}
      className={`card p-4 cursor-pointer transition-all duration-150 hover:shadow-elevated ${
        isSelected ? 'ring-2 ring-primary border-primary' : 'hover:border-primary/30'
      }`}
      role="button"
      aria-pressed={isSelected}
      aria-label={`${result.title} — ${result.article}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">
            {result.title}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="font-mono-ref text-xs text-muted-foreground">{result.reference}</span>
            <span className="text-muted-foreground text-xs">·</span>
            <span className="font-mono-ref text-xs font-medium text-primary">{result.article}</span>
            <span className="text-muted-foreground text-xs">·</span>
            <span className="text-xs text-muted-foreground">p. {result.page}</span>
          </div>
        </div>
        <div className={`text-right flex-shrink-0`}>
          <p className={`text-base font-bold tabular-nums ${scoreColor}`}>{result.matchScore}%</p>
          <p className="text-[10px] text-muted-foreground whitespace-nowrap">{result.matchReason}</p>
        </div>
      </div>

      {/* Excerpt */}
      <p className="text-xs text-muted-foreground line-clamp-2 mb-3 leading-relaxed">
        {result.excerpt}
      </p>

      {/* Footer */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${domainColors[result.domain] || 'bg-gray-100 text-gray-600'}`}>
          {result.domain}
        </span>
        <StatusBadge type="legal" value={result.legalStatus} />
        {result.provenance === 'official' ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-green-700">
            <Icon name="ShieldCheckIcon" size={12} />
            Officiel
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] text-amber-600">
            <Icon name="DocumentIcon" size={12} />
            Secondaire
          </span>
        )}
        <span className="text-[11px] text-muted-foreground ml-auto">{result.date}</span>
      </div>
    </div>
  );
}