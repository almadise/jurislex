'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import StatusBadge from '@/components/ui/StatusBadge';
import SourceReader from '@/components/SourceReader';
import type { SearchResult } from './LegalSearchContent';

interface ArticlePreviewPanelProps {
  result: SearchResult;
  onClose: () => void;
}

export default function ArticlePreviewPanel({ result, onClose }: ArticlePreviewPanelProps) {
  const [tab, setTab] = useState<'article' | 'meta' | 'source'>('article');

  const tabs = [
    { id: 'article' as const, label: 'Article' },
    { id: 'meta' as const, label: 'Métadonnées' },
    { id: 'source' as const, label: 'Source' },
  ];

  return (
    <div className="card h-full flex flex-col overflow-hidden">
      <div className="flex items-start justify-between p-4 border-b border-border flex-shrink-0">
        <div className="flex-1 min-w-0 pr-3">
          <p className="text-xs text-muted-foreground mb-1 font-mono-ref">{result.reference}</p>
          <h3 className="text-sm font-semibold text-foreground leading-snug">{result.title}</h3>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="font-mono-ref text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">
              {result.article}
            </span>
            {result.page > 0 && (
              <span className="text-xs text-muted-foreground">p. {result.page}</span>
            )}
            <StatusBadge type="legal" value={result.legalStatus} />
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors flex-shrink-0"
          aria-label="Fermer l'aperçu"
        >
          <Icon name="XMarkIcon" size={16} className="text-muted-foreground" />
        </button>
      </div>

      <div className="flex border-b border-border flex-shrink-0">
        {tabs.map((t) => (
          <button
            key={`preview-tab-${t.id}`}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
              tab === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
        {tab === 'article' && (
          <div className="fade-in">
            <div className="mb-4 grid grid-cols-1 gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground w-24">
                  Autorité
                </span>
                <span className="text-xs font-medium text-foreground">{result.authority}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground w-24">
                  Date
                </span>
                <span className="text-xs font-medium text-foreground">{result.date}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground w-24">
                  Domaine
                </span>
                <span className="text-xs font-medium text-foreground">{result.domain}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground w-24">
                  Provenance
                </span>
                <span
                  className={`text-xs font-medium ${
                    result.provenance === 'official' ? 'text-green-700' : 'text-amber-600'
                  }`}
                >
                  {result.provenance === 'official'
                    ? 'Source officielle (inférée)'
                    : 'Source secondaire'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground w-24">
                  Correspondance
                </span>
                <span className="text-xs font-medium text-foreground">
                  {result.matchScore}% · {result.matchReason}
                </span>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 mb-4">
              <p className="font-mono-ref text-sm font-semibold text-primary mb-3">{result.article}</p>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {result.excerpt}
              </p>
            </div>

            {result.legalStatus === 'unknown' && (
              <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                <Icon
                  name="ExclamationTriangleIcon"
                  size={16}
                  className="text-amber-600 flex-shrink-0 mt-0.5"
                />
                <div>
                  <p className="text-xs font-semibold text-amber-700 mb-0.5">
                    Statut juridique non vérifié
                  </p>
                  <p className="text-xs text-amber-600">
                    Le corpus ne confirme pas automatiquement qu’un texte est en vigueur. Vérifiez les
                    sources officielles avant toute utilisation.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'meta' && (
          <div className="fade-in space-y-3 text-sm">
            <MetaRow label="Identifiant résultat" value={result.id} mono />
            <MetaRow label="Chunk / document" value={`${result.chunkId ?? '—'} / ${result.documentId ?? '—'}`} mono />
            <MetaRow label="Catégorie corpus" value={result.category ?? '—'} mono />
            <MetaRow label="Backend" value={result.backend ?? '—'} />
            <MetaRow label="Langue" value={result.language} />
            <p className="text-xs text-muted-foreground pt-2">
              Les relations entre textes (abroge, modifie, consolide) seront renseignées au Cycle B
              (graphe juridique). Aucune relation inventée n’est affichée.
            </p>
          </div>
        )}

        {tab === 'source' && (
          <div className="fade-in">
            <SourceReader
              sourcePath={result.sourcePath}
              page={result.page}
              article={result.article}
              title={result.title}
              excerpt={result.excerpt}
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 p-4 border-t border-border flex-shrink-0">
        <span className="text-xs text-muted-foreground flex-1">
          Citation vérifiable uniquement si le chunk provient du corpus indexé.
        </span>
      </div>
    </div>
  );
}

function MetaRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className={`text-foreground ${mono ? 'font-mono-ref text-xs break-all' : ''}`}>
        {value}
      </span>
    </div>
  );
}
