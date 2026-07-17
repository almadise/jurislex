'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ReviewItem, ReviewAnnotation, AnnotationType } from './ReviewerContent';
import { toast } from 'sonner';

interface AnnotationPanelProps {
  selectedItem: ReviewItem | null;
  onSelectItem: (item: ReviewItem | null) => void;
}

const annotationTypeConfig: Record<AnnotationType, { label: string; className: string; icon: string }> = {
  comment:             { label: 'Commentaire',          className: 'bg-gray-100 text-gray-700',   icon: 'ChatBubbleLeftIcon' },
  correction:          { label: 'Correction',           className: 'bg-blue-100 text-blue-700',   icon: 'PencilIcon' },
  citation_error:      { label: 'Erreur de citation',   className: 'bg-red-100 text-red-700',     icon: 'ExclamationTriangleIcon' },
  qualification_error: { label: 'Erreur de qualification', className: 'bg-amber-100 text-amber-700', icon: 'ExclamationCircleIcon' },
  validation:          { label: 'Validation',           className: 'bg-green-100 text-green-700', icon: 'CheckBadgeIcon' },
};

interface NewAnnotationForm {
  annotationType: AnnotationType;
  targetField: string;
  originalText: string;
  correctedText: string;
  comment: string;
  citationRef: string;
}

const emptyForm: NewAnnotationForm = {
  annotationType: 'comment',
  targetField: '',
  originalText: '',
  correctedText: '',
  comment: '',
  citationRef: '',
};

function mapAnnotation(row: any): ReviewAnnotation {
  return {
    id: row.id,
    reviewItemId: row.review_item_id,
    reviewerId: row.reviewer_id,
    annotationType: row.annotation_type,
    targetField: row.target_field,
    originalText: row.original_text,
    correctedText: row.corrected_text,
    comment: row.comment,
    citationRef: row.citation_ref,
    isResolved: row.is_resolved,
    createdAt: row.created_at,
  };
}

export default function AnnotationPanel({ selectedItem, onSelectItem }: AnnotationPanelProps) {
  const { user } = useAuth();
  const supabase = createClient();
  const [annotations, setAnnotations] = useState<ReviewAnnotation[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewAnnotationForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const fetchAnnotations = useCallback(async (itemId: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('review_annotations')
        .select('*')
        .eq('review_item_id', itemId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAnnotations((data ?? []).map(mapAnnotation));
    } catch {
      toast.error('Erreur lors du chargement des annotations');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (selectedItem) fetchAnnotations(selectedItem.id);
    else setAnnotations([]);
  }, [selectedItem, fetchAnnotations]);

  const handleSubmit = async () => {
    if (!selectedItem || !user) return;
    if (!form.comment.trim()) {
      toast.error('Le commentaire est obligatoire');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('review_annotations').insert({
        review_item_id: selectedItem.id,
        reviewer_id: user.id,
        annotation_type: form.annotationType,
        target_field: form.targetField,
        original_text: form.originalText,
        corrected_text: form.correctedText || null,
        comment: form.comment,
        citation_ref: form.citationRef || null,
        is_resolved: false,
      });
      if (error) throw error;
      toast.success('Annotation ajoutée');
      setForm(emptyForm);
      setShowForm(false);
      fetchAnnotations(selectedItem.id);
    } catch (err: any) {
      toast.error(err.message ?? 'Erreur lors de l\'ajout');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleResolved = async (annotation: ReviewAnnotation) => {
    setResolvingId(annotation.id);
    try {
      const { error } = await supabase
        .from('review_annotations')
        .update({ is_resolved: !annotation.isResolved })
        .eq('id', annotation.id);
      if (error) throw error;
      setAnnotations((prev) =>
        prev.map((a) => a.id === annotation.id ? { ...a, isResolved: !a.isResolved } : a)
      );
    } catch {
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
      {/* Item selector */}
      <div className="xl:col-span-2 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">Élément sélectionné</p>
        </div>
        {!selectedItem ? (
          <div className="border border-dashed border-border rounded-xl p-6 text-center text-muted text-sm">
            <Icon name="CursorArrowRaysIcon" size={28} className="mx-auto mb-2 opacity-30" />
            Allez dans la file de révision et sélectionnez un élément pour annoter
          </div>
        ) : (
          <div className="border border-primary/30 bg-primary/5 rounded-xl p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                {selectedItem.itemType === 'qa_response' ? 'Q&R' : selectedItem.itemType === 'analysis' ? 'Analyse' : 'Document'}
              </span>
              <button onClick={() => onSelectItem(null)} className="text-muted hover:text-foreground">
                <Icon name="XMarkIcon" size={14} />
              </button>
            </div>
            <p className="text-sm font-medium text-foreground mb-1">{selectedItem.title}</p>
            <p className="text-xs text-muted">{selectedItem.domain}</p>
          </div>
        )}

        {/* Add annotation form */}
        {selectedItem && (
          <div className="space-y-3">
            <button
              onClick={() => setShowForm(!showForm)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Icon name="PlusIcon" size={16} />
              Ajouter une annotation
            </button>

            {showForm && (
              <div className="border border-border rounded-xl p-4 space-y-3 bg-surface">
                <p className="text-xs font-semibold text-foreground uppercase tracking-wide">Nouvelle annotation</p>

                <div>
                  <label className="text-xs text-muted mb-1 block">Type</label>
                  <select
                    value={form.annotationType}
                    onChange={(e) => setForm({ ...form, annotationType: e.target.value as AnnotationType })}
                    className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    {Object.entries(annotationTypeConfig).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-muted mb-1 block">Champ ciblé</label>
                  <input
                    type="text"
                    placeholder="ex: citations[0].article"
                    value={form.targetField}
                    onChange={(e) => setForm({ ...form, targetField: e.target.value })}
                    className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                {(form.annotationType === 'correction' || form.annotationType === 'citation_error' || form.annotationType === 'qualification_error') && (
                  <>
                    <div>
                      <label className="text-xs text-muted mb-1 block">Texte original</label>
                      <input
                        type="text"
                        value={form.originalText}
                        onChange={(e) => setForm({ ...form, originalText: e.target.value })}
                        className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted mb-1 block">Texte corrigé</label>
                      <input
                        type="text"
                        value={form.correctedText}
                        onChange={(e) => setForm({ ...form, correctedText: e.target.value })}
                        className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                  </>
                )}

                <div>
                  <label className="text-xs text-muted mb-1 block">Référence de citation</label>
                  <input
                    type="text"
                    placeholder="ex: OHADA-AUDCG-2010"
                    value={form.citationRef}
                    onChange={(e) => setForm({ ...form, citationRef: e.target.value })}
                    className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>

                <div>
                  <label className="text-xs text-muted mb-1 block">Commentaire *</label>
                  <textarea
                    rows={3}
                    value={form.comment}
                    onChange={(e) => setForm({ ...form, comment: e.target.value })}
                    className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                    placeholder="Expliquez l'annotation..."
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {submitting ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" /> : <Icon name="CheckIcon" size={12} />}
                    Enregistrer
                  </button>
                  <button
                    onClick={() => { setShowForm(false); setForm(emptyForm); }}
                    className="px-3 py-2 text-xs font-semibold border border-border text-muted rounded-lg hover:bg-muted/10 transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Annotations list */}
      <div className="xl:col-span-3 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">
            Annotations {selectedItem ? `(${annotations.length})` : ''}
          </p>
          {annotations.some((a) => !a.isResolved) && (
            <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">
              {annotations.filter((a) => !a.isResolved).length} non résolue(s)
            </span>
          )}
        </div>

        {!selectedItem ? (
          <div className="flex flex-col items-center justify-center h-48 border border-dashed border-border rounded-xl text-muted text-sm">
            <Icon name="PencilSquareIcon" size={28} className="mb-2 opacity-30" />
            Sélectionnez un élément pour voir ses annotations
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : annotations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 border border-dashed border-border rounded-xl text-muted text-sm">
            <Icon name="ChatBubbleLeftIcon" size={28} className="mb-2 opacity-30" />
            Aucune annotation sur cet élément
          </div>
        ) : (
          <div className="space-y-3">
            {annotations.map((ann) => {
              const tc = annotationTypeConfig[ann.annotationType];
              return (
                <div
                  key={ann.id}
                  className={`border rounded-xl p-4 transition-opacity ${ann.isResolved ? 'opacity-50 border-border' : 'border-border bg-surface'}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${tc.className}`}>
                      <Icon name={tc.icon as any} size={10} />
                      {tc.label}
                    </span>
                    <button
                      onClick={() => toggleResolved(ann)}
                      disabled={resolvingId === ann.id}
                      className={`flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full transition-colors ${
                        ann.isResolved
                          ? 'bg-gray-100 text-gray-500 hover:bg-amber-100 hover:text-amber-700' :'bg-green-100 text-green-700 hover:bg-green-200'
                      }`}
                    >
                      <Icon name={ann.isResolved ? 'ArrowPathIcon' : 'CheckIcon'} size={10} />
                      {ann.isResolved ? 'Rouvrir' : 'Résoudre'}
                    </button>
                  </div>

                  {ann.targetField && (
                    <p className="text-[10px] font-mono text-primary bg-primary/5 px-2 py-0.5 rounded mb-2 inline-block">
                      {ann.targetField}
                    </p>
                  )}

                  {ann.originalText && (
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                        <p className="text-[9px] font-semibold text-red-500 uppercase mb-0.5">Original</p>
                        <p className="text-xs text-red-800">{ann.originalText}</p>
                      </div>
                      {ann.correctedText && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-2">
                          <p className="text-[9px] font-semibold text-green-600 uppercase mb-0.5">Corrigé</p>
                          <p className="text-xs text-green-800">{ann.correctedText}</p>
                        </div>
                      )}
                    </div>
                  )}

                  <p className="text-sm text-foreground">{ann.comment}</p>

                  {ann.citationRef && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <Icon name="BookOpenIcon" size={12} className="text-primary" />
                      <span className="text-xs font-mono text-primary">{ann.citationRef}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
