'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import Icon from '@/components/ui/AppIcon';
import type { DocumentTemplate } from './DocumentGenerationContent';

interface DocumentFormProps {
  template: DocumentTemplate;
  onBack: () => void;
  onSubmit: (data: Record<string, string>) => void;
  isGenerating: boolean;
  initialValues?: Record<string, string>;
}

const fallbackLabels: Record<string, { label: string; helper?: string; rows?: number }> = {
  expediteur: { label: 'Expéditeur (nom, qualité, adresse)' },
  destinataire: { label: 'Destinataire (nom, qualité, adresse)' },
  objet: { label: 'Objet du courrier' },
  montant: { label: 'Montant (FCFA)' },
  delai: { label: 'Délai d’exécution' },
  fondement_juridique: { label: 'Fondement juridique', rows: 2 },
  faits: { label: 'Exposé des faits', rows: 4 },
  reference_contrat: { label: 'Référence contrat / commande' },
  objet_reclamation: { label: 'Objet de la réclamation', rows: 4 },
  pieces_jointes: { label: 'Pièces jointes', rows: 2 },
  demande: { label: 'Demande formulée', rows: 3 },
  salarie: { label: 'Salarié', rows: 2 },
  employeur: { label: 'Employeur', rows: 2 },
  date_faits: { label: 'Date des faits' },
  requerant: { label: 'Requérant', rows: 3 },
  autorite: { label: 'Autorité destinataire', rows: 2 },
  objet_recours: { label: 'Objet du recours' },
  decision_contestee: { label: 'Décision contestée' },
  fondement: { label: 'Fondement juridique', rows: 3 },
  demandeur: { label: 'Demandeur', rows: 3 },
  defendeur: { label: 'Défendeur', rows: 3 },
  juridiction: { label: 'Juridiction saisie' },
  moyens_droit: { label: 'Moyens de droit', rows: 4 },
  pretentions: { label: 'Prétentions', rows: 4 },
};

export default function DocumentForm({
  template,
  onBack,
  onSubmit,
  isGenerating,
  initialValues,
}: DocumentFormProps) {
  const fieldDefs =
    template.fields && template.fields.length > 0
      ? template.fields
      : template.requiredFields.map((key) => ({
          key,
          label: fallbackLabels[key]?.label || key,
          helper: fallbackLabels[key]?.helper,
          required: true,
          rows: fallbackLabels[key]?.rows,
          type: 'text' as const,
        }));

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Record<string, string>>({
    defaultValues: initialValues || {},
  });

  return (
    <div className="flex gap-6">
      <div className="flex-1 min-w-0">
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-6 pb-6 border-b border-border">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <Icon
                name={template.icon as Parameters<typeof Icon>[0]['name']}
                size={20}
                className="text-primary"
              />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">{template.name}</h2>
              <p className="text-xs text-muted-foreground">
                {template.domain}
                {template.version ? ` · v${template.version}` : ''}
              </p>
            </div>
            {template.humanReviewLevel === 'required' && (
              <div className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg">
                <Icon name="ExclamationCircleIcon" size={14} className="text-red-600" />
                <span className="text-xs font-medium text-red-700">
                  Revue professionnelle obligatoire
                </span>
              </div>
            )}
          </div>

          {template.conditions && (
            <p className="text-xs text-muted-foreground mb-4 p-3 bg-muted/50 rounded-lg">
              {template.conditions}
            </p>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
            {fieldDefs.map((field) => {
              const rows = field.rows || 1;
              const isTextarea = rows > 1 || field.type === 'textarea';
              return (
                <div key={`field-${field.key}`}>
                  <label className="label" htmlFor={`field-${field.key}`}>
                    {field.label}
                    {field.required !== false && (
                      <span className="text-red-500 ml-1" aria-hidden>
                        *
                      </span>
                    )}
                  </label>
                  {field.helper && <p className="helper-text mb-2">{field.helper}</p>}
                  {isTextarea ? (
                    <textarea
                      id={`field-${field.key}`}
                      rows={rows > 1 ? rows : 3}
                      className={`input-field resize-none ${errors[field.key] ? 'border-red-400' : ''}`}
                      {...register(field.key, {
                        required: field.required !== false ? 'Ce champ est obligatoire.' : false,
                        validate: (v) =>
                          field.required === false || (v && v.trim().length > 0) || 'Champ vide interdit.',
                      })}
                    />
                  ) : (
                    <input
                      id={`field-${field.key}`}
                      type="text"
                      className={`input-field ${errors[field.key] ? 'border-red-400' : ''}`}
                      {...register(field.key, {
                        required: field.required !== false ? 'Ce champ est obligatoire.' : false,
                        validate: (v) =>
                          field.required === false || (v && v.trim().length > 0) || 'Champ vide interdit.',
                      })}
                    />
                  )}
                  {errors[field.key] && (
                    <p className="error-text" role="alert">
                      {errors[field.key]?.message as string}
                    </p>
                  )}
                </div>
              );
            })}

            <div className="flex items-center gap-3 pt-4 border-t border-border">
              <button type="button" onClick={onBack} className="btn-secondary">
                <Icon name="ArrowLeftIcon" size={16} />
                Retour
              </button>
              <button
                type="submit"
                disabled={isGenerating}
                className="btn-primary ml-auto min-w-[200px] justify-center"
              >
                Continuer — confirmation
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="w-72 flex-shrink-0 flex flex-col gap-4">
        <div className="card p-4">
          <h3 className="text-sm font-semibold mb-3">Fondements du modèle</h3>
          <div className="space-y-1.5">
            {template.legalBasis.map((basis) => (
              <span
                key={basis}
                className="block font-mono-ref text-xs px-2 py-1 bg-primary/5 text-primary rounded"
              >
                {basis}
              </span>
            ))}
          </div>
        </div>
        <div className="card p-4 border-amber-200 bg-amber-50">
          <p className="text-xs font-semibold text-amber-700 mb-1">Avant de générer</p>
          <p className="text-xs text-amber-600 leading-relaxed">
            Aucun document ne sera exporté avec des variables non renseignées.
          </p>
        </div>
      </div>
    </div>
  );
}
