'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import Icon from '@/components/ui/AppIcon';
import type { Matter } from './CaseManagementContent';

interface NewCaseModalProps {
  onClose: () => void;
  onCreated: (matter: Matter) => void;
}

interface NewCaseForm {
  title: string;
  domain: string;
  party1: string;
  party2: string;
  riskLevel: 'low' | 'medium' | 'high';
  tags: string;
}

const domainOptions = [
  'Droit commercial OHADA',
  'Droit du travail',
  'Droit civil',
  'Droit des sociétés',
  'Droit pénal',
  'Droit foncier',
  'Droit bancaire COBAC',
  'Droit numérique',
  'Droit de la propriété intellectuelle',
  'Droit administratif',
];

export default function NewCaseModal({ onClose, onCreated }: NewCaseModalProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NewCaseForm>();

  const onSubmit = async (data: NewCaseForm) => {
    await new Promise((r) => setTimeout(r, 600));
    const refNum = String(Math.floor(Math.random() * 900) + 100);
    const newMatter: Matter = {
      id: `matter-${Date.now()}`,
      reference: `DOS-2026-0${refNum}`,
      title: data.title,
      domain: data.domain,
      parties: [data.party1, data.party2].filter(Boolean),
      status: 'draft',
      analyses: 0,
      documents: 0,
      lastActivity: '17/07/2026',
      createdAt: '17/07/2026',
      assignedTo: 'Fotso Mbarga',
      riskLevel: data.riskLevel,
      tags: data.tags ? data.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    };
    onCreated(newMatter);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="new-case-title">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-card rounded-xl border border-border shadow-modal w-full max-w-lg scale-in">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 id="new-case-title" className="text-base font-semibold text-foreground">Nouveau dossier</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors" aria-label="Fermer">
            <Icon name="XMarkIcon" size={18} className="text-muted-foreground" />
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-5 flex flex-col gap-4">
          <div>
            <label className="label" htmlFor="new-case-title-input">
              Intitulé du dossier <span className="text-red-500">*</span>
            </label>
            <input
              id="new-case-title-input"
              className={`input-field ${errors.title ? 'border-red-400' : ''}`}
              placeholder="Ex: Licenciement abusif — Nom du salarié c/ Employeur"
              {...register('title', { required: 'L\'intitulé est obligatoire.' })}
            />
            {errors.title && <p className="error-text" role="alert">{errors.title.message}</p>}
          </div>

          <div>
            <label className="label" htmlFor="new-case-domain">
              Domaine juridique <span className="text-red-500">*</span>
            </label>
            <select
              id="new-case-domain"
              className={`input-field ${errors.domain ? 'border-red-400' : ''}`}
              {...register('domain', { required: 'Sélectionnez un domaine.' })}
            >
              <option value="">Sélectionner un domaine...</option>
              {domainOptions.map((d) => (
                <option key={`domain-select-${d}`} value={d}>{d}</option>
              ))}
            </select>
            {errors.domain && <p className="error-text" role="alert">{errors.domain.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="new-case-party1">
                Partie 1 <span className="text-red-500">*</span>
              </label>
              <input
                id="new-case-party1"
                className={`input-field ${errors.party1 ? 'border-red-400' : ''}`}
                placeholder="Nom de la partie 1"
                {...register('party1', { required: 'Requis.' })}
              />
              {errors.party1 && <p className="error-text" role="alert">{errors.party1.message}</p>}
            </div>
            <div>
              <label className="label" htmlFor="new-case-party2">
                Partie 2
              </label>
              <input
                id="new-case-party2"
                className="input-field"
                placeholder="Nom de la partie 2"
                {...register('party2')}
              />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="new-case-risk">
              Niveau de risque estimé
            </label>
            <select id="new-case-risk" className="input-field" {...register('riskLevel')}>
              <option value="low">Faible</option>
              <option value="medium">Modéré</option>
              <option value="high">Élevé</option>
            </select>
          </div>

          <div>
            <label className="label" htmlFor="new-case-tags">
              Tags (séparés par des virgules)
            </label>
            <input
              id="new-case-tags"
              className="input-field"
              placeholder="licenciement, indemnités, urgent..."
              {...register('tags')}
            />
            <p className="helper-text">Facultatif — facilitent la recherche et le filtrage.</p>
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-border">
            <button type="button" onClick={onClose} className="btn-secondary flex-1 justify-center">
              Annuler
            </button>
            <button type="submit" disabled={isSubmitting} className="btn-primary flex-1 justify-center">
              {isSubmitting ? (
                <>
                  <Icon name="ArrowPathIcon" size={16} className="animate-spin" />
                  Création...
                </>
              ) : (
                <>
                  <Icon name="FolderPlusIcon" size={16} />
                  Créer le dossier
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}