'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { QuarantinedResponse } from './ObservatoireContent';
import { createClient } from '@/lib/supabase/client';

interface QuarantinePanelProps {
  quarantined: QuarantinedResponse[];
  onRefresh: () => void;
}

const statusConfig = {
  quarantined: { label: 'En quarantaine', color: 'bg-red-100 text-red-700', icon: 'ShieldExclamationIcon' },
  reviewed: { label: 'Révisé', color: 'bg-amber-100 text-amber-700', icon: 'ClipboardDocumentCheckIcon' },
  cleared: { label: 'Validé', color: 'bg-green-100 text-green-700', icon: 'CheckBadgeIcon' },
  invalidated: { label: 'Invalidé', color: 'bg-gray-100 text-gray-600', icon: 'XCircleIcon' },
};

const responseTypeLabels: Record<string, string> = {
  qa_response: 'Q&R',
  analysis: 'Analyse',
  document: 'Document',
  search_result: 'Résultat de recherche',
};

export default function QuarantinePanel({ quarantined, onRefresh }: QuarantinePanelProps) {
  const [filterStatus, setFilterStatus] = useState('all');
  const [selected, setSelected] = useState<QuarantinedResponse | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const filtered = quarantined.filter((q) => {
    if (filterStatus === 'all') return true;
    return q.quarantineStatus === filterStatus;
  });

  const handleAction = async (item: QuarantinedResponse, newStatus: 'reviewed' | 'cleared' | 'invalidated') => {
    setActionLoading(newStatus);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('quarantined_responses')
        .update({
          quarantine_status: newStatus,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes || null,
        })
        .eq('id', item.id);
      if (error) throw error;
      onRefresh();
      setSelected(null);
      setReviewNotes('');
    } catch (err: any) {
      alert('Erreur : ' + (err.message ?? 'Impossible de mettre à jour'));
    } finally {
      setActionLoading(null);
    }
  };

  const counts = {
    quarantined: quarantined.filter((q) => q.quarantineStatus === 'quarantined').length,
    reviewed: quarantined.filter((q) => q.quarantineStatus === 'reviewed').length,
    cleared: quarantined.filter((q) => q.quarantineStatus === 'cleared').length,
    invalidated: quarantined.filter((q) => q.quarantineStatus === 'invalidated').length,
  };

  return (
    <div className="space-y-5">
      {/* Status filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => setFilterStatus('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filterStatus === 'all' ? 'bg-primary text-white' : 'bg-foreground/5 text-foreground/60 hover:bg-foreground/10'
          }`}
        >
          Tous ({quarantined.length})
        </button>
        {(Object.keys(statusConfig) as Array<keyof typeof statusConfig>).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterStatus === s ? 'bg-primary text-white' : 'bg-foreground/5 text-foreground/60 hover:bg-foreground/10'
            }`}
          >
            {statusConfig[s].label} ({counts[s]})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-foreground/50 text-sm">
          Aucune réponse en quarantaine pour ce statut.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* List */}
          <div className="lg:col-span-2 space-y-2 max-h-[520px] overflow-y-auto pr-1">
            {filtered.map((item) => {
              const cfg = statusConfig[item.quarantineStatus];
              const isSelected = selected?.id === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setSelected(isSelected ? null : item);
                    setReviewNotes('');
                  }}
                  className={`w-full text-left p-3.5 rounded-xl border transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/5' :'border-border bg-surface hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-foreground/10 text-foreground/60">
                          {responseTypeLabels[item.responseType] ?? item.responseType}
                        </span>
                        {item.responseReference && (
                          <span className="text-[10px] font-mono text-foreground/40">{item.responseReference}</span>
                        )}
                      </div>
                      <p className="text-xs text-foreground/80 mt-1.5 line-clamp-2">
                        {item.originalQuery ?? 'Requête non disponible'}
                      </p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${cfg.color}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    {item.affectedArticles.length > 0 && (
                      <span className="text-[10px] text-foreground/40">
                        {item.affectedArticles.join(', ')}
                      </span>
                    )}
                    <span className="text-[10px] text-foreground/30 ml-auto">
                      {new Date(item.quarantinedAt).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detail */}
          <div className="lg:col-span-3">
            {!selected ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-foreground/40 text-sm gap-2">
                <Icon name="ShieldExclamationIcon" size={32} />
                <p>Sélectionnez une réponse pour la réviser</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">
                        {responseTypeLabels[selected.responseType] ?? selected.responseType}
                      </span>
                      {selected.responseReference && (
                        <span className="text-xs font-mono text-foreground/50">{selected.responseReference}</span>
                      )}
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${statusConfig[selected.quarantineStatus].color}`}>
                        {statusConfig[selected.quarantineStatus].label}
                      </span>
                    </div>
                    <p className="text-xs text-foreground/50 mt-1">
                      Mis en quarantaine le {new Date(selected.quarantinedAt).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>

                {/* Affected */}
                {(selected.affectedArticles.length > 0 || selected.affectedTextReferences.length > 0) && (
                  <div className="flex flex-wrap gap-2">
                    {selected.affectedArticles.map((a) => (
                      <span key={a} className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">
                        {a}
                      </span>
                    ))}
                    {selected.affectedTextReferences.map((r) => (
                      <span key={r} className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-mono">
                        {r}
                      </span>
                    ))}
                  </div>
                )}

                {/* Quarantine reason */}
                {selected.quarantineReason && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-xs font-semibold text-red-700 mb-1">Motif de quarantaine</p>
                    <p className="text-xs text-red-800">{selected.quarantineReason}</p>
                  </div>
                )}

                {/* Original query */}
                {selected.originalQuery && (
                  <div>
                    <p className="text-xs font-semibold text-foreground/60 mb-1.5">Requête originale</p>
                    <p className="text-sm text-foreground/80 italic">« {selected.originalQuery} »</p>
                  </div>
                )}

                {/* Original response */}
                {selected.originalResponse && (
                  <div>
                    <p className="text-xs font-semibold text-foreground/60 mb-1.5">Réponse affectée</p>
                    <div className="p-3 bg-foreground/5 rounded-lg text-xs text-foreground/70 leading-relaxed max-h-28 overflow-y-auto">
                      {selected.originalResponse}
                    </div>
                  </div>
                )}

                {/* Review notes */}
                {selected.quarantineStatus === 'quarantined' && (
                  <div>
                    <label className="text-xs font-semibold text-foreground/60 mb-1.5 block">
                      Notes de révision
                    </label>
                    <textarea
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                      placeholder="Ajoutez vos observations..."
                      rows={3}
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-surface text-foreground placeholder-foreground/30 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    />
                  </div>
                )}

                {/* Existing review notes */}
                {selected.reviewNotes && selected.quarantineStatus !== 'quarantined' && (
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs font-semibold text-blue-700 mb-1">Notes du réviseur</p>
                    <p className="text-xs text-blue-800">{selected.reviewNotes}</p>
                    {selected.reviewedAt && (
                      <p className="text-[10px] text-blue-500 mt-1">
                        Révisé le {new Date(selected.reviewedAt).toLocaleDateString('fr-FR')}
                      </p>
                    )}
                  </div>
                )}

                {/* Actions */}
                {selected.quarantineStatus === 'quarantined' && (
                  <div className="flex items-center gap-2 flex-wrap pt-1">
                    <button
                      onClick={() => handleAction(selected, 'reviewed')}
                      disabled={!!actionLoading}
                      className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 text-white rounded-lg text-xs font-medium hover:bg-amber-600 transition-colors disabled:opacity-50"
                    >
                      {actionLoading === 'reviewed' ? (
                        <div className="w-3.5 h-3.5 border border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Icon name="ClipboardDocumentCheckIcon" size={14} />
                      )}
                      Marquer révisé
                    </button>
                    <button
                      onClick={() => handleAction(selected, 'cleared')}
                      disabled={!!actionLoading}
                      className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      {actionLoading === 'cleared' ? (
                        <div className="w-3.5 h-3.5 border border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Icon name="CheckBadgeIcon" size={14} />
                      )}
                      Valider et lever
                    </button>
                    <button
                      onClick={() => handleAction(selected, 'invalidated')}
                      disabled={!!actionLoading}
                      className="flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      {actionLoading === 'invalidated' ? (
                        <div className="w-3.5 h-3.5 border border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Icon name="XCircleIcon" size={14} />
                      )}
                      Invalider
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
