'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ReviewItem, ReviewStatus } from './ReviewerContent';
import { toast } from 'sonner';

interface ReviewQueueProps {
  selectedItem: ReviewItem | null;
  onSelectItem: (item: ReviewItem | null) => void;
  onStatusChange: () => void;
}

const statusConfig: Record<ReviewStatus, { label: string; className: string; icon: string }> = {
  pending:   { label: 'En attente',  className: 'bg-amber-100 text-amber-700',  icon: 'ClockIcon' },
  in_review: { label: 'En révision', className: 'bg-blue-100 text-blue-700',    icon: 'EyeIcon' },
  approved:  { label: 'Approuvé',    className: 'bg-green-100 text-green-700',  icon: 'CheckCircleIcon' },
  rejected:  { label: 'Rejeté',      className: 'bg-red-100 text-red-700',      icon: 'XCircleIcon' },
  published: { label: 'Publié',      className: 'bg-purple-100 text-purple-700',icon: 'ArrowUpCircleIcon' },
};

const typeLabels: Record<string, string> = {
  qa_response: 'Q&R',
  analysis: 'Analyse',
  document: 'Document',
};

const priorityConfig: Record<string, string> = {
  high:   'bg-red-100 text-red-700',
  normal: 'bg-gray-100 text-gray-600',
  low:    'bg-green-100 text-green-700',
};

function mapRow(row: any): ReviewItem {
  return {
    id: row.id,
    reviewerId: row.reviewer_id,
    submitterId: row.submitter_id,
    itemType: row.item_type,
    reviewStatus: row.review_status,
    title: row.title,
    originalContent: row.original_content ?? {},
    correctedContent: row.corrected_content ?? null,
    domain: row.domain,
    priority: row.priority,
    submittedAt: row.submitted_at,
    reviewedAt: row.reviewed_at,
    publishedAt: row.published_at,
    createdAt: row.created_at,
  };
}

export default function ReviewQueue({ selectedItem, onSelectItem, onStatusChange }: ReviewQueueProps) {
  const { user } = useAuth();
  const supabase = createClient();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('review_items')
        .select('*')
        .order('submitted_at', { ascending: false });
      if (error) throw error;
      setItems((data ?? []).map(mapRow));
    } catch (err: any) {
      toast.error('Erreur lors du chargement de la file de révision');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const filtered = items.filter((item) => {
    const matchStatus = statusFilter === 'all' || item.reviewStatus === statusFilter;
    const matchType = typeFilter === 'all' || item.itemType === typeFilter;
    const matchSearch = !searchQuery ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.domain.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchType && matchSearch;
  });

  const updateStatus = async (item: ReviewItem, newStatus: ReviewStatus) => {
    setUpdatingId(item.id);
    try {
      const updates: any = { review_status: newStatus };
      if (newStatus === 'in_review') updates.reviewer_id = user?.id;
      if (['approved', 'rejected'].includes(newStatus)) updates.reviewed_at = new Date().toISOString();
      if (newStatus === 'published') updates.published_at = new Date().toISOString();

      const { error } = await supabase
        .from('review_items')
        .update(updates)
        .eq('id', item.id);
      if (error) throw error;
      toast.success(`Statut mis à jour : ${statusConfig[newStatus].label}`);
      await fetchItems();
      onStatusChange();
      if (selectedItem?.id === item.id) {
        onSelectItem({ ...item, reviewStatus: newStatus });
      }
    } catch (err: any) {
      toast.error(err.message ?? 'Erreur lors de la mise à jour');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
      {/* List */}
      <div className="xl:col-span-2 space-y-4">
        {/* Filters */}
        <div className="flex flex-col gap-2">
          <div className="relative">
            <Icon name="MagnifyingGlassIcon" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="flex-1 text-xs border border-border rounded-lg px-2 py-2 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="all">Tous les statuts</option>
              {Object.entries(statusConfig).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="flex-1 text-xs border border-border rounded-lg px-2 py-2 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="all">Tous les types</option>
              {Object.entries(typeLabels).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Items */}
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted text-sm">
            <Icon name="ClipboardDocumentListIcon" size={32} className="mx-auto mb-2 opacity-30" />
            Aucun élément dans la file
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((item) => {
              const sc = statusConfig[item.reviewStatus];
              const isSelected = selectedItem?.id === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectItem(isSelected ? null : item)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border bg-surface hover:border-primary/40 hover:bg-primary/3'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="text-xs font-semibold text-muted uppercase tracking-wide">
                      {typeLabels[item.itemType]}
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${sc.className}`}>
                      <Icon name={sc.icon as any} size={10} />
                      {sc.label}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-foreground line-clamp-2 mb-1">{item.title}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] text-muted bg-muted/10 px-2 py-0.5 rounded-full">{item.domain}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${priorityConfig[item.priority] ?? priorityConfig.normal}`}>
                      {item.priority === 'high' ? 'Urgent' : item.priority === 'low' ? 'Faible' : 'Normal'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Detail panel */}
      <div className="xl:col-span-3">
        {!selectedItem ? (
          <div className="flex flex-col items-center justify-center h-64 border border-dashed border-border rounded-xl text-muted">
            <Icon name="CursorArrowRaysIcon" size={32} className="mb-2 opacity-30" />
            <p className="text-sm">Sélectionnez un élément pour le réviser</p>
          </div>
        ) : (
          <div className="border border-border rounded-xl bg-surface overflow-hidden">
            {/* Panel header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-background">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-muted uppercase tracking-wide">
                  {typeLabels[selectedItem.itemType]}
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusConfig[selectedItem.reviewStatus].className}`}>
                  <Icon name={statusConfig[selectedItem.reviewStatus].icon as any} size={10} />
                  {statusConfig[selectedItem.reviewStatus].label}
                </span>
              </div>
              <button onClick={() => onSelectItem(null)} className="text-muted hover:text-foreground transition-colors">
                <Icon name="XMarkIcon" size={18} />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
              <h2 className="text-base font-bold text-foreground">{selectedItem.title}</h2>
              <div className="flex gap-2 flex-wrap">
                <span className="text-xs text-muted bg-muted/10 px-2 py-1 rounded-full">{selectedItem.domain}</span>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${priorityConfig[selectedItem.priority] ?? priorityConfig.normal}`}>
                  Priorité : {selectedItem.priority === 'high' ? 'Urgente' : selectedItem.priority === 'low' ? 'Faible' : 'Normale'}
                </span>
              </div>

              {/* Original content */}
              <div>
                <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Contenu original</p>
                <div className="bg-background border border-border rounded-lg p-4 space-y-3">
                  {Object.entries(selectedItem.originalContent).map(([key, value]) => {
                    if (key === 'citations' || Array.isArray(value)) return null;
                    return (
                      <div key={key}>
                        <p className="text-[10px] font-semibold text-muted uppercase tracking-wide mb-0.5">{key}</p>
                        <p className="text-sm text-foreground">{String(value)}</p>
                      </div>
                    );
                  })}
                  {selectedItem.originalContent.citations && Array.isArray(selectedItem.originalContent.citations) && (
                    <div>
                      <p className="text-[10px] font-semibold text-muted uppercase tracking-wide mb-1">Citations</p>
                      <div className="space-y-1">
                        {(selectedItem.originalContent.citations as any[]).map((c, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs">
                            <Icon name="BookOpenIcon" size={12} className="text-primary flex-shrink-0" />
                            <span className="font-mono text-primary">{c.reference}</span>
                            <span className="text-muted">{c.article}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${c.legalStatus === 'verified' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                              {c.legalStatus}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="px-5 py-4 border-t border-border bg-background flex flex-wrap gap-2">
              {selectedItem.reviewStatus === 'pending' && (
                <button
                  onClick={() => updateStatus(selectedItem, 'in_review')}
                  disabled={updatingId === selectedItem.id}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  <Icon name="EyeIcon" size={14} />
                  Prendre en charge
                </button>
              )}
              {selectedItem.reviewStatus === 'in_review' && (
                <>
                  <button
                    onClick={() => updateStatus(selectedItem, 'approved')}
                    disabled={updatingId === selectedItem.id}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    <Icon name="CheckCircleIcon" size={14} />
                    Approuver
                  </button>
                  <button
                    onClick={() => updateStatus(selectedItem, 'rejected')}
                    disabled={updatingId === selectedItem.id}
                    className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    <Icon name="XCircleIcon" size={14} />
                    Rejeter
                  </button>
                </>
              )}
              {selectedItem.reviewStatus === 'approved' && (
                <button
                  onClick={() => updateStatus(selectedItem, 'published')}
                  disabled={updatingId === selectedItem.id}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
                >
                  <Icon name="ArrowUpCircleIcon" size={14} />
                  Publier la correction
                </button>
              )}
              {selectedItem.reviewStatus === 'rejected' && (
                <button
                  onClick={() => updateStatus(selectedItem, 'pending')}
                  disabled={updatingId === selectedItem.id}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
                >
                  <Icon name="ArrowPathIcon" size={14} />
                  Remettre en attente
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
