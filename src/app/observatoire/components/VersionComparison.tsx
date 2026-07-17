'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { TextVersion } from './ObservatoireContent';

interface VersionComparisonProps {
  versions: TextVersion[];
  onRefresh: () => void;
}

const statusConfig = {
  active: { label: 'Actif', color: 'bg-green-100 text-green-700' },
  superseded: { label: 'Remplacé', color: 'bg-amber-100 text-amber-700' },
  archived: { label: 'Archivé', color: 'bg-gray-100 text-gray-600' },
};

const domainLabels: Record<string, string> = {
  commercial: 'Droit commercial',
  societes: 'Droit des sociétés',
  travail: 'Droit du travail',
  penal: 'Droit pénal',
  civil: 'Droit civil',
  general: 'Général',
};

export default function VersionComparison({ versions, onRefresh }: VersionComparisonProps) {
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const [filterDomain, setFilterDomain] = useState('all');

  // Group versions by text_reference
  const grouped = versions.reduce<Record<string, TextVersion[]>>((acc, v) => {
    if (!acc[v.textReference]) acc[v.textReference] = [];
    acc[v.textReference].push(v);
    return acc;
  }, {});

  const refs = Object.keys(grouped).filter((ref) => {
    if (filterDomain === 'all') return true;
    return grouped[ref][0]?.domain === filterDomain;
  });

  const domains = Array.from(new Set(versions.map((v) => v.domain)));

  const selectedVersions = selectedRef ? (grouped[selectedRef] ?? []) : [];

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Icon name="FunnelIcon" size={15} className="text-foreground/50" />
          <span className="text-sm text-foreground/60">Domaine :</span>
        </div>
        {['all', ...domains].map((d) => (
          <button
            key={d}
            onClick={() => setFilterDomain(d)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterDomain === d
                ? 'bg-primary text-white' :'bg-foreground/5 text-foreground/60 hover:bg-foreground/10'
            }`}
          >
            {d === 'all' ? 'Tous' : domainLabels[d] ?? d}
          </button>
        ))}
      </div>

      {refs.length === 0 ? (
        <div className="text-center py-12 text-foreground/50 text-sm">
          Aucun texte juridique ingéré pour ce domaine.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* List */}
          <div className="lg:col-span-1 space-y-2">
            <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wider mb-3">
              {refs.length} texte{refs.length > 1 ? 's' : ''} référencé{refs.length > 1 ? 's' : ''}
            </p>
            {refs.map((ref) => {
              const vList = grouped[ref];
              const active = vList.find((v) => v.versionStatus === 'active');
              const isSelected = selectedRef === ref;
              return (
                <button
                  key={ref}
                  onClick={() => setSelectedRef(isSelected ? null : ref)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/5' :'border-border bg-surface hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-foreground/50 truncate">{ref}</p>
                      <p className="text-sm font-medium text-foreground mt-0.5 line-clamp-2">
                        {active?.title ?? vList[0]?.title}
                      </p>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 flex-shrink-0">
                      v{vList.length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-[10px] text-foreground/50">{active?.source ?? vList[0]?.source}</span>
                    {active && (
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${statusConfig.active.color}`}>
                        Actif
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detail */}
          <div className="lg:col-span-2">
            {!selectedRef ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-foreground/40 text-sm gap-2">
                <Icon name="DocumentDuplicateIcon" size={32} />
                <p>Sélectionnez un texte pour comparer ses versions</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-foreground">
                  Historique des versions — {selectedRef}
                </p>
                <div className="space-y-2">
                  {selectedVersions
                    .sort((a, b) => b.versionNumber - a.versionNumber)
                    .map((v, idx) => {
                      const cfg = statusConfig[v.versionStatus];
                      return (
                        <div
                          key={v.id}
                          className={`p-4 rounded-xl border ${
                            v.versionStatus === 'active' ?'border-green-200 bg-green-50/50' :'border-border bg-surface'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                                v.versionStatus === 'active' ? 'bg-green-500 text-white' : 'bg-foreground/10 text-foreground/60'
                              }`}>
                                v{v.versionNumber}
                              </div>
                              <div>
                                <p className="text-sm font-medium text-foreground">
                                  {v.versionLabel ?? `Version ${v.versionNumber}`}
                                </p>
                                <p className="text-xs text-foreground/50 mt-0.5">
                                  Ingéré le {new Date(v.ingestedAt).toLocaleDateString('fr-FR')}
                                  {v.effectiveDate && ` · En vigueur depuis le ${new Date(v.effectiveDate).toLocaleDateString('fr-FR')}`}
                                </p>
                              </div>
                            </div>
                            <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${cfg.color}`}>
                              {cfg.label}
                            </span>
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <Icon name="FingerPrintIcon" size={12} className="text-foreground/30" />
                            <span className="text-[10px] font-mono text-foreground/30 truncate">
                              Hash: {v.contentHash.slice(0, 16)}…
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
