'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import StatusBadge from '@/components/ui/StatusBadge';
import type { SearchResult } from './LegalSearchContent';

interface ArticlePreviewPanelProps {
  result: SearchResult;
  onClose: () => void;
}

export default function ArticlePreviewPanel({ result, onClose }: ArticlePreviewPanelProps) {
  const [tab, setTab] = useState<'article' | 'context' | 'relations'>('article');

  const tabs = [
    { id: 'article', label: 'Article' },
    { id: 'context', label: 'Contexte' },
    { id: 'relations', label: 'Relations' },
  ] as const;

  return (
    <div className="card h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-border flex-shrink-0">
        <div className="flex-1 min-w-0 pr-3">
          <p className="text-xs text-muted-foreground mb-1 font-mono-ref">{result.reference}</p>
          <h3 className="text-sm font-semibold text-foreground leading-snug">{result.title}</h3>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="font-mono-ref text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">
              {result.article}
            </span>
            <span className="text-xs text-muted-foreground">p. {result.page}</span>
            <StatusBadge type="legal" value={result.legalStatus} />
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-muted transition-colors flex-shrink-0"
          aria-label="Fermer l'aperçu"
        >
          <Icon name="XMarkIcon" size={16} className="text-muted-foreground" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border flex-shrink-0">
        {tabs.map((t) => (
          <button
            key={`preview-tab-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
              tab === t.id
                ? 'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
        {tab === 'article' && (
          <div className="fade-in">
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Autorité</span>
                <span className="text-xs font-medium text-foreground">{result.authority}</span>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Date</span>
                <span className="text-xs font-medium text-foreground">{result.date}</span>
              </div>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Domaine</span>
                <span className="text-xs font-medium text-foreground">{result.domain}</span>
              </div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Provenance</span>
                <span className={`text-xs font-medium ${result.provenance === 'official' ? 'text-green-700' : 'text-amber-600'}`}>
                  {result.provenance === 'official' ? 'Source officielle' : 'Source secondaire'}
                </span>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 mb-4">
              <p className="font-mono-ref text-sm font-semibold text-primary mb-3">{result.article}</p>
              <p className="text-sm text-foreground leading-relaxed">{result.excerpt}</p>
              <p className="text-sm text-foreground leading-relaxed mt-3">
                À cet effet, il doit tenir à jour un registre des opérations commerciales et se conformer aux obligations comptables prévues par les textes applicables. Tout manquement à ces obligations est susceptible d'engager la responsabilité du commerçant.
              </p>
            </div>

            {result.legalStatus === 'unknown' && (
              <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
                <Icon name="ExclamationTriangleIcon" size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-amber-700 mb-0.5">Statut juridique incertain</p>
                  <p className="text-xs text-amber-600">
                    Le statut en vigueur de ce texte n'a pas pu être vérifié. Une consultation des sources officielles est recommandée avant toute utilisation.
                  </p>
                </div>
              </div>
            )}
            {result.legalStatus === 'superseded' && (
              <div className="flex items-start gap-3 p-3 bg-purple-50 border border-purple-200 rounded-lg mb-4">
                <Icon name="ExclamationCircleIcon" size={16} className="text-purple-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-purple-700 mb-0.5">Texte remplacé</p>
                  <p className="text-xs text-purple-600">
                    Ce texte a été remplacé par une version ultérieure. Vérifiez la version consolidée avant usage.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'context' && (
          <div className="fade-in space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Article précédent</p>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="font-mono-ref text-xs font-medium text-primary mb-1">
                  {result.article.replace(/\d+$/, (n) => String(parseInt(n) - 1))}
                </p>
                <p className="text-xs text-muted-foreground line-clamp-3">
                  Tout commerçant, personne physique ou morale, doit s'immatriculer au Registre du Commerce et du Crédit Mobilier dans le délai d'un mois à compter du début de son activité commerciale...
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Article suivant</p>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="font-mono-ref text-xs font-medium text-primary mb-1">
                  {result.article.replace(/\d+$/, (n) => String(parseInt(n) + 1))}
                </p>
                <p className="text-xs text-muted-foreground line-clamp-3">
                  Les obligations comptables du commerçant comprennent la tenue d'un livre journal, d'un grand livre et d'un livre d'inventaire conformément aux dispositions de l'Acte uniforme...
                </p>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Section parente</p>
              <p className="text-xs text-foreground">Chapitre III — Obligations du commerçant</p>
              <p className="text-xs text-muted-foreground">Titre II — Statut du commerçant</p>
            </div>
          </div>
        )}

        {tab === 'relations' && (
          <div className="fade-in space-y-3">
            <p className="text-xs text-muted-foreground">Relations identifiées avec d'autres textes du corpus.</p>
            {[
              { type: 'implements', label: 'Met en œuvre', ref: 'Traité OHADA-1993', article: 'Art. 10' },
              { type: 'references', label: 'Référencé par', ref: 'OHADA-AUSC-2014', article: 'Art. 13' },
              { type: 'references', label: 'Référencé par', ref: 'OHADA-AUDCG-2010', article: 'Art. 72' },
              { type: 'amends', label: 'Modifié par', ref: 'OHADA-AUDCG-2010-REV', article: 'Art. 59bis' },
            ].map((rel, i) => (
              <div key={`rel-${i}`} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors cursor-pointer">
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  rel.type === 'implements' ? 'bg-blue-100 text-blue-700' :
                  rel.type === 'amends'? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {rel.label}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground font-mono-ref">{rel.ref}</p>
                  <p className="text-[11px] text-muted-foreground">{rel.article}</p>
                </div>
                <Icon name="ChevronRightIcon" size={14} className="text-muted-foreground flex-shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-2 p-4 border-t border-border flex-shrink-0">
        <button className="btn-primary flex-1 justify-center text-xs">
          <Icon name="ChatBubbleLeftRightIcon" size={14} />
          Poser une question
        </button>
        <button className="btn-secondary text-xs px-3">
          <Icon name="FolderPlusIcon" size={14} />
          Ajouter au dossier
        </button>
        <button className="btn-ghost text-xs px-3">
          <Icon name="ArrowDownTrayIcon" size={14} />
        </button>
      </div>
    </div>
  );
}