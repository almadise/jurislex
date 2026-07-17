'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

const STEP_NAMES = [
  'Découverte des sources',
  'Vérification SHA-256',
  'Extraction de texte (OCR)',
  'Nettoyage & normalisation',
  'Segmentation en articles',
  'Détection de la structure',
  'Extraction des métadonnées',
  'Génération des embeddings',
  'Indexation vectorielle',
  'Indexation full-text',
  'Validation de cohérence',
  'Mise à jour du registre',
  'Rapport final',
];

const STEP_KEYS = [
  'discovery','sha256','ocr','cleaning','segmentation',
  'structure','metadata','embedding','vector_index',
  'fts_index','validation','registry','report',
];

export default function NewJobModal({ onClose, onCreated }: Props) {
  const { user } = useAuth();
  const [form, setForm] = useState({
    title: '',
    description: '',
    sourceType: 'pdf',
    domain: 'OHADA',
    jurisdiction: 'Cameroun',
    totalDocuments: 1,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    setError(null);
    const supabase = createClient();

    try {
      // Get user profile id
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', user?.id)
        .single();

      const { data: job, error: jobErr } = await supabase
        .from('ingestion_jobs')
        .insert({
          title: form.title,
          description: form.description || null,
          source_type: form.sourceType,
          domain: form.domain,
          jurisdiction: form.jurisdiction,
          total_documents: form.totalDocuments,
          initiated_by: profile?.id ?? null,
          job_status: 'pending',
        })
        .select()
        .single();

      if (jobErr) throw jobErr;

      // Create 13 steps
      const steps = STEP_NAMES.map((name, i) => ({
        job_id: job.id,
        step_number: i + 1,
        step_name: name,
        step_key: STEP_KEYS[i],
        step_status: 'pending',
        items_total: 0,
        items_processed: 0,
        items_failed: 0,
      }));

      const { error: stepsErr } = await supabase.from('ingestion_steps').insert(steps);
      if (stepsErr) throw stepsErr;

      onCreated();
    } catch (err: any) {
      setError(err.message ?? 'Erreur lors de la création');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Nouveau job d'ingestion</h2>
          <button onClick={onClose} className="text-foreground/40 hover:text-foreground transition-colors">
            <Icon name="XMarkIcon" size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-foreground/60 uppercase tracking-wider mb-1.5">
              Titre du job *
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Ex: Acte Uniforme OHADA — Droit des sociétés"
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground/60 uppercase tracking-wider mb-1.5">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2}
              placeholder="Description optionnelle..."
              className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground/60 uppercase tracking-wider mb-1.5">
                Type de source
              </label>
              <select
                value={form.sourceType}
                onChange={(e) => setForm(f => ({ ...f, sourceType: e.target.value }))}
                className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {['pdf', 'docx', 'html', 'txt', 'url', 'api'].map(t => (
                  <option key={t} value={t}>{t.toUpperCase()}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground/60 uppercase tracking-wider mb-1.5">
                Nb. documents
              </label>
              <input
                type="number"
                min={1}
                value={form.totalDocuments}
                onChange={(e) => setForm(f => ({ ...f, totalDocuments: parseInt(e.target.value) || 1 }))}
                className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground/60 uppercase tracking-wider mb-1.5">
                Domaine juridique
              </label>
              <input
                type="text"
                value={form.domain}
                onChange={(e) => setForm(f => ({ ...f, domain: e.target.value }))}
                className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground/60 uppercase tracking-wider mb-1.5">
                Juridiction
              </label>
              <input
                type="text"
                value={form.jurisdiction}
                onChange={(e) => setForm(f => ({ ...f, jurisdiction: e.target.value }))}
                className="w-full border border-border rounded-lg px-3 py-2.5 text-sm text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* Pipeline preview */}
          <div className="bg-background rounded-xl p-4 border border-border">
            <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wider mb-3">
              13 étapes du pipeline
            </p>
            <div className="flex flex-wrap gap-1.5">
              {STEP_NAMES.map((name, i) => (
                <span key={i} className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                  {i + 1}. {name.split(' ')[0]}
                </span>
              ))}
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600">{error}</div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="submit"
              disabled={saving || !form.title.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Icon name="PlayIcon" size={14} />
              )}
              Créer le job
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 border border-border text-foreground/60 rounded-lg text-sm font-medium hover:bg-surface transition-colors"
            >
              Annuler
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
