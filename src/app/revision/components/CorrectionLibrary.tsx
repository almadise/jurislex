'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ReviewCorrection } from './ReviewerContent';
import { toast } from 'sonner';

function mapCorrection(row: any): ReviewCorrection {
  return {
    id: row.id,
    reviewerId: row.reviewer_id,
    reviewItemId: row.review_item_id,
    domain: row.domain,
    errorPattern: row.error_pattern,
    correctionRule: row.correction_rule,
    citationRef: row.citation_ref,
    isPublished: row.is_published,
    usageCount: row.usage_count,
    createdAt: row.created_at,
  };
}

interface NewCorrectionForm {
  domain: string;
  errorPattern: string;
  correctionRule: string;
  citationRef: string;
}

const emptyForm: NewCorrectionForm = {
  domain: '',
  errorPattern: '',
  correctionRule: '',
  citationRef: '',
};

const domainOptions = [
  'Droit du travail',
  'Droit commercial OHADA',
  'Droit des sociétés',
  'Droit civil',
  'Droit foncier',
  'Droit bancaire COBAC',
  'Droit pénal',
  'Droit administratif',
];

export default function CorrectionLibrary() {
  const { user } = useAuth();
  const supabase = createClient();
  const [corrections, setCorrections] = useState<ReviewCorrection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewCorrectionForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [domainFilter, setDomainFilter] = useState('all');
  const [publishedFilter, setPublishedFilter] = useState<'all' | 'published' | 'draft'>('all');

  const fetchCorrections = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('review_corrections')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCorrections((data ?? []).map(mapCorrection));
    } catch {
      toast.error('Erreur lors du chargement des corrections');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { fetchCorrections(); }, [fetchCorrections]);

  const filtered = corrections.filter((c) => {
    const matchDomain = domainFilter === 'all' || c.domain === domainFilter;
    const matchPublished =
      publishedFilter === 'all' ||
      (publishedFilter === 'published' && c.isPublished) ||
      (publishedFilter === 'draft' && !c.isPublished);
    return matchDomain && matchPublished;
  });

  const handleSubmit = async () => {
    if (!user) return;
    if (!form.errorPattern.trim() || !form.correctionRule.trim() || !form.domain) {
      toast.error('Domaine, pattern d\'erreur et règle de correction sont obligatoires');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('review_corrections').insert({
        reviewer_id: user.id,
        domain: form.domain,
        error_pattern: form.errorPattern,
        correction_rule: form.correctionRule,
        citation_ref: form.citationRef || null,
        is_published: false,
        usage_count: 0,
      });
      if (error) throw error;
      toast.success('Correction ajoutée à la bibliothèque');
      setForm(emptyForm);
      setShowForm(false);
      fetchCorrections();
    } catch (err: any) {
      toast.error(err.message ?? 'Erreur lors de l\'ajout');
    } finally {
      setSubmitting(false);
    }
  };

  const togglePublish = async (correction: ReviewCorrection) => {
    setTogglingId(correction.id);
    try {
      const { error } = await supabase
        .from('review_corrections')
        .update({ is_published: !correction.isPublished })
        .eq('id', correction.id);
      if (error) throw error;
      toast.success(correction.isPublished ? 'Correction dépubliée' : 'Correction publiée');
      setCorrections((prev) =>
        prev.map((c) => c.id === correction.id ? { ...c, isPublished: !c.isPublished } : c)
      );
    } catch {
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setTogglingId(null);
    }
  };

  const publishedCount = corrections.filter((c) => c.isPublished).length;
  const draftCount = corrections.filter((c) => !c.isPublished).length;

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted">
            <span className="font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full text-xs">{publishedCount} publiées</span>
            <span className="font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full text-xs">{draftCount} brouillons</span>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Icon name="PlusIcon" size={16} />
          Nouvelle correction
        </button>
      </div>

      {/* New correction form */}
      {showForm && (
        <div className="border border-primary/30 bg-primary/5 rounded-xl p-5 space-y-4">
          <p className="text-sm font-bold text-foreground">Nouvelle règle de correction réutilisable</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted mb-1 block">Domaine juridique *</label>
              <select
                value={form.domain}
                onChange={(e) => setForm({ ...form, domain: e.target.value })}
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Sélectionner un domaine</option>
                {domainOptions.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
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
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Pattern d'erreur observé *</label>
            <textarea
              rows={2}
              value={form.errorPattern}
              onChange={(e) => setForm({ ...form, errorPattern: e.target.value })}
              placeholder="Décrivez le type d'erreur récurrente..."
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>
          <div>
            <label className="text-xs text-muted mb-1 block">Règle de correction *</label>
            <textarea
              rows={3}
              value={form.correctionRule}
              onChange={(e) => setForm({ ...form, correctionRule: e.target.value })}
              placeholder="Expliquez la règle correcte à appliquer..."
              className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-background text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {submitting ? <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin" /> : <Icon name="CheckIcon" size={14} />}
              Enregistrer
            </button>
            <button
              onClick={() => { setShowForm(false); setForm(emptyForm); }}
              className="px-4 py-2 text-sm font-semibold border border-border text-muted rounded-lg hover:bg-muted/10 transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <select
          value={domainFilter}
          onChange={(e) => setDomainFilter(e.target.value)}
          className="text-xs border border-border rounded-lg px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="all">Tous les domaines</option>
          {domainOptions.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <div className="flex rounded-lg border border-border overflow-hidden">
          {(['all', 'published', 'draft'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setPublishedFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                publishedFilter === f ? 'bg-primary text-white' : 'text-muted hover:bg-muted/10'
              }`}
            >
              {f === 'all' ? 'Toutes' : f === 'published' ? 'Publiées' : 'Brouillons'}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 border border-dashed border-border rounded-xl text-muted text-sm">
          <Icon name="BookOpenIcon" size={28} className="mb-2 opacity-30" />
          Aucune correction dans la bibliothèque
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map((correction) => (
            <div key={correction.id} className="border border-border rounded-xl p-4 bg-surface space-y-3">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-semibold text-muted bg-muted/10 px-2 py-0.5 rounded-full">
                  {correction.domain}
                </span>
                <div className="flex items-center gap-2">
                  {correction.usageCount > 0 && (
                    <span className="text-[10px] text-muted">
                      {correction.usageCount}× utilisée
                    </span>
                  )}
                  <button
                    onClick={() => togglePublish(correction)}
                    disabled={togglingId === correction.id}
                    className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors ${
                      correction.isPublished
                        ? 'bg-purple-100 text-purple-700 hover:bg-purple-200' :'bg-gray-100 text-gray-600 hover:bg-green-100 hover:text-green-700'
                    }`}
                  >
                    <Icon name={correction.isPublished ? 'ArrowDownCircleIcon' : 'ArrowUpCircleIcon'} size={10} />
                    {correction.isPublished ? 'Publiée' : 'Publier'}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <div>
                  <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wide mb-0.5">Pattern d'erreur</p>
                  <p className="text-sm text-foreground">{correction.errorPattern}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-green-600 uppercase tracking-wide mb-0.5">Règle de correction</p>
                  <p className="text-sm text-foreground">{correction.correctionRule}</p>
                </div>
              </div>

              {correction.citationRef && (
                <div className="flex items-center gap-1.5 pt-1 border-t border-border">
                  <Icon name="BookOpenIcon" size={12} className="text-primary" />
                  <span className="text-xs font-mono text-primary">{correction.citationRef}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
