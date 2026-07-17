'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { ArticleChange, TextVersion } from './ObservatoireContent';
import { createClient } from '@/lib/supabase/client';

interface ArticleChangesProps {
  changes: ArticleChange[];
  versions: TextVersion[];
  onRefresh: () => void;
}

const severityConfig = {
  low: { label: 'Faible', color: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' },
  medium: { label: 'Moyen', color: 'bg-blue-100 text-blue-700', dot: 'bg-blue-500' },
  high: { label: 'Élevé', color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  critical: { label: 'Critique', color: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
};

const changeTypeConfig = {
  addition: { label: 'Ajout', icon: 'PlusCircleIcon', color: 'text-green-600' },
  modification: { label: 'Modification', icon: 'PencilSquareIcon', color: 'text-amber-600' },
  deletion: { label: 'Suppression', icon: 'MinusCircleIcon', color: 'text-red-600' },
  renumbering: { label: 'Renumérotation', icon: 'ArrowsRightLeftIcon', color: 'text-blue-600' },
};

export default function ArticleChanges({ changes, versions, onRefresh }: ArticleChangesProps) {
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterConfirmed, setFilterConfirmed] = useState('all');
  const [selectedChange, setSelectedChange] = useState<ArticleChange | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const filtered = changes.filter((c) => {
    if (filterSeverity !== 'all' && c.severity !== filterSeverity) return false;
    if (filterConfirmed === 'pending' && c.isConfirmed) return false;
    if (filterConfirmed === 'confirmed' && !c.isConfirmed) return false;
    return true;
  });

  const getVersionLabel = (id: string | null) => {
    if (!id) return '—';
    const v = versions.find((v) => v.id === id);
    return v ? (v.versionLabel ?? `v${v.versionNumber}`) : id.slice(0, 8);
  };

  const handleConfirm = async (change: ArticleChange) => {
    setConfirmingId(change.id);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('article_changes')
        .update({ is_confirmed: true, confirmed_at: new Date().toISOString() })
        .eq('id', change.id);
      if (error) throw error;
      onRefresh();
      setSelectedChange(null);
    } catch (err: any) {
      alert('Erreur : ' + (err.message ?? 'Impossible de confirmer'));
    } finally {
      setConfirmingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs text-foreground/50">Sévérité :</span>
          {['all', 'critical', 'high', 'medium', 'low'].map((s) => (
            <button
              key={s}
              onClick={() => setFilterSeverity(s)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                filterSeverity === s
                  ? 'bg-primary text-white' :'bg-foreground/5 text-foreground/60 hover:bg-foreground/10'
              }`}
            >
              {s === 'all' ? 'Tous' : severityConfig[s as keyof typeof severityConfig]?.label ?? s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-foreground/50">Statut :</span>
          {[
            { id: 'all', label: 'Tous' },
            { id: 'pending', label: 'En attente' },
            { id: 'confirmed', label: 'Confirmés' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilterConfirmed(f.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                filterConfirmed === f.id
                  ? 'bg-primary text-white' :'bg-foreground/5 text-foreground/60 hover:bg-foreground/10'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-foreground/50 text-sm">
          Aucune modification détectée pour ces critères.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* List */}
          <div className="lg:col-span-2 space-y-2 max-h-[520px] overflow-y-auto pr-1">
            {filtered.map((change) => {
              const sev = severityConfig[change.severity];
              const ct = changeTypeConfig[change.changeType];
              const isSelected = selectedChange?.id === change.id;
              return (
                <button
                  key={change.id}
                  onClick={() => setSelectedChange(isSelected ? null : change)}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/5' :'border-border bg-surface hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold ${ct.color}`}>{change.articleNumber}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${sev.color}`}>
                          {sev.label}
                        </span>
                      </div>
                      <p className="text-xs text-foreground/70 mt-1 line-clamp-2">
                        {change.articleTitle ?? change.diffSummary ?? 'Modification détectée'}
                      </p>
                    </div>
                    {change.isConfirmed ? (
                      <Icon name="CheckCircleIcon" size={16} className="text-green-500 flex-shrink-0" />
                    ) : (
                      <Icon name="ClockIcon" size={16} className="text-amber-500 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-[10px] text-foreground/40 mt-2 font-mono">{change.textReference}</p>
                </button>
              );
            })}
          </div>

          {/* Detail */}
          <div className="lg:col-span-3">
            {!selectedChange ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-foreground/40 text-sm gap-2">
                <Icon name="ExclamationTriangleIcon" size={32} />
                <p>Sélectionnez une modification pour voir le détail</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-base font-semibold text-foreground">{selectedChange.articleNumber}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${severityConfig[selectedChange.severity].color}`}>
                        {severityConfig[selectedChange.severity].label}
                      </span>
                      <span className={`text-xs font-medium ${changeTypeConfig[selectedChange.changeType].color}`}>
                        {changeTypeConfig[selectedChange.changeType].label}
                      </span>
                    </div>
                    {selectedChange.articleTitle && (
                      <p className="text-sm text-foreground/70 mt-1">{selectedChange.articleTitle}</p>
                    )}
                  </div>
                  {!selectedChange.isConfirmed && (
                    <button
                      onClick={() => handleConfirm(selectedChange)}
                      disabled={confirmingId === selectedChange.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      {confirmingId === selectedChange.id ? (
                        <div className="w-3.5 h-3.5 border border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Icon name="CheckIcon" size={14} />
                      )}
                      Confirmer
                    </button>
                  )}
                </div>

                <div className="text-xs text-foreground/50 flex items-center gap-4">
                  <span>Référence : <strong className="font-mono text-foreground/70">{selectedChange.textReference}</strong></span>
                  <span>{new Date(selectedChange.detectedAt).toLocaleDateString('fr-FR')}</span>
                </div>

                {selectedChange.diffSummary && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                    <p className="font-medium mb-1">Résumé de la modification</p>
                    <p>{selectedChange.diffSummary}</p>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-3">
                  {selectedChange.oldContent && (
                    <div>
                      <p className="text-xs font-semibold text-red-600 mb-1.5 flex items-center gap-1">
                        <Icon name="MinusCircleIcon" size={13} /> Ancienne version
                        <span className="font-normal text-foreground/40 ml-1">({getVersionLabel(selectedChange.oldVersionId)})</span>
                      </p>
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-foreground/80 leading-relaxed">
                        {selectedChange.oldContent}
                      </div>
                    </div>
                  )}
                  {selectedChange.newContent && (
                    <div>
                      <p className="text-xs font-semibold text-green-600 mb-1.5 flex items-center gap-1">
                        <Icon name="PlusCircleIcon" size={13} /> Nouvelle version
                        <span className="font-normal text-foreground/40 ml-1">({getVersionLabel(selectedChange.newVersionId)})</span>
                      </p>
                      <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-xs text-foreground/80 leading-relaxed">
                        {selectedChange.newContent}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
