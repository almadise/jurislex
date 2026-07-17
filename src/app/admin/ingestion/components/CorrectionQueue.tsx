'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

interface CorrectionItem {
  id: string;
  jobId: string;
  jobTitle?: string;
  stepKey: string;
  documentReference: string | null;
  articleNumber: string | null;
  originalContent: string | null;
  correctedContent: string | null;
  correctionType: string;
  correctionStatus: 'pending' | 'in_review' | 'corrected' | 'rejected' | 'escalated';
  priority: number;
  reviewNotes: string | null;
  createdAt: string;
}

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: 'En attente',  color: 'text-amber-600',  bg: 'bg-amber-50' },
  in_review: { label: 'En révision', color: 'text-blue-600',   bg: 'bg-blue-50' },
  corrected: { label: 'Corrigé',     color: 'text-green-600',  bg: 'bg-green-50' },
  rejected:  { label: 'Rejeté',      color: 'text-red-600',    bg: 'bg-red-50' },
  escalated: { label: 'Escaladé',    color: 'text-purple-600', bg: 'bg-purple-50' },
};

const TYPE_LABELS: Record<string, string> = {
  ocr_error:          'Erreur OCR',
  segmentation_error: 'Segmentation',
  metadata_error:     'Métadonnées',
  encoding_error:     'Encodage',
  structure_error:    'Structure',
};

interface Props {
  onRefresh: () => void;
}

export default function CorrectionQueue({ onRefresh }: Props) {
  const [items, setItems] = useState<CorrectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CorrectionItem | null>(null);
  const [correctedText, setCorrectedText] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('correction_queue')
      .select('*, ingestion_jobs(title)')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true });

    if (!error && data) {
      setItems(data.map((c: any) => ({
        id: c.id,
        jobId: c.job_id,
        jobTitle: c.ingestion_jobs?.title,
        stepKey: c.step_key,
        documentReference: c.document_reference,
        articleNumber: c.article_number,
        originalContent: c.original_content,
        correctedContent: c.corrected_content,
        correctionType: c.correction_type,
        correctionStatus: c.correction_status,
        priority: c.priority,
        reviewNotes: c.review_notes,
        createdAt: c.created_at,
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleSelect = (item: CorrectionItem) => {
    setSelected(item);
    setCorrectedText(item.correctedContent ?? item.originalContent ?? '');
    setReviewNotes(item.reviewNotes ?? '');
  };

  const handleSave = async (newStatus: CorrectionItem['correctionStatus']) => {
    if (!selected) return;
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from('correction_queue')
      .update({
        corrected_content: correctedText,
        correction_status: newStatus,
        review_notes: reviewNotes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selected.id);
    setSaving(false);
    setSelected(null);
    fetchItems();
    onRefresh();
  };

  const filtered = filterStatus === 'all' ? items : items.filter(i => i.correctionStatus === filterStatus);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* List */}
      <div className="lg:col-span-2 space-y-3">
        <div className="flex items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="flex-1 text-sm border border-border rounded-lg px-3 py-2 bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="all">Tous les statuts</option>
            {Object.entries(STATUS_STYLE).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <button onClick={fetchItems} className="p-2 border border-border rounded-lg text-foreground/50 hover:bg-surface transition-colors">
            <Icon name="ArrowPathIcon" size={15} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-surface border border-border rounded-xl p-8 text-center">
            <Icon name="CheckCircleIcon" size={32} className="text-green-400 mx-auto mb-2" />
            <p className="text-sm text-foreground/50">Aucune correction en attente</p>
          </div>
        ) : (
          filtered.map((item) => {
            const st = STATUS_STYLE[item.correctionStatus];
            return (
              <button
                key={item.id}
                onClick={() => handleSelect(item)}
                className={`w-full text-left bg-surface border rounded-xl p-4 transition-all hover:shadow-sm ${
                  selected?.id === item.id ? 'border-primary ring-1 ring-primary/20' : 'border-border'
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5">
                    {Array.from({ length: item.priority }).map((_, i) => (
                      <div key={i} className="w-1.5 h-1.5 rounded-full bg-accent" />
                    ))}
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${st.bg} ${st.color}`}>
                    {st.label}
                  </span>
                </div>
                <p className="text-sm font-semibold text-foreground truncate">
                  {item.articleNumber ?? item.documentReference ?? 'Document inconnu'}
                </p>
                <p className="text-xs text-foreground/50 mt-0.5 truncate">{item.jobTitle}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                    {TYPE_LABELS[item.correctionType] ?? item.correctionType}
                  </span>
                  <span className="text-[10px] text-foreground/40">{item.stepKey}</span>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Editor */}
      <div className="lg:col-span-3">
        {selected ? (
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">
                {selected.articleNumber ?? selected.documentReference}
              </h3>
              <p className="text-xs text-foreground/50 mt-0.5">{selected.jobTitle} · {TYPE_LABELS[selected.correctionType] ?? selected.correctionType}</p>
            </div>
            <div className="p-5 space-y-4">
              {/* Original */}
              <div>
                <label className="block text-xs font-semibold text-foreground/50 uppercase tracking-wider mb-1.5">
                  Contenu original (OCR brut)
                </label>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-foreground/70 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
                  {selected.originalContent ?? '—'}
                </div>
              </div>

              {/* Correction */}
              <div>
                <label className="block text-xs font-semibold text-foreground/50 uppercase tracking-wider mb-1.5">
                  Contenu corrigé
                </label>
                <textarea
                  value={correctedText}
                  onChange={(e) => setCorrectedText(e.target.value)}
                  rows={5}
                  className="w-full border border-border rounded-lg p-3 text-sm font-mono text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-foreground/50 uppercase tracking-wider mb-1.5">
                  Notes de révision
                </label>
                <textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={2}
                  placeholder="Commentaire optionnel..."
                  className="w-full border border-border rounded-lg p-3 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => handleSave('corrected')}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  <Icon name="CheckIcon" size={14} />
                  Valider
                </button>
                <button
                  onClick={() => handleSave('in_review')}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  <Icon name="EyeIcon" size={14} />
                  En révision
                </button>
                <button
                  onClick={() => handleSave('rejected')}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  <Icon name="XMarkIcon" size={14} />
                  Rejeter
                </button>
                <button
                  onClick={() => handleSave('escalated')}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 border border-border text-foreground/60 rounded-lg text-sm font-medium hover:bg-surface transition-colors disabled:opacity-50"
                >
                  <Icon name="ArrowUpIcon" size={14} />
                  Escalader
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-xl p-8 flex flex-col items-center justify-center h-full min-h-[300px] text-center">
            <Icon name="WrenchScrewdriverIcon" size={36} className="text-foreground/15 mb-3" />
            <p className="text-sm text-foreground/40">Sélectionnez un élément à corriger</p>
          </div>
        )}
      </div>
    </div>
  );
}
