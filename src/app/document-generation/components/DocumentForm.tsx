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
}

const fieldConfig: Record<string, { label: string; helper?: string; type?: string; rows?: number }> = {
  expediteur: { label: 'Expéditeur (nom, qualité, adresse)', helper: 'Nom complet et coordonnées de la partie qui envoie le courrier.' },
  destinataire: { label: 'Destinataire (nom, qualité, adresse)', helper: 'Nom complet et coordonnées du destinataire.' },
  objet: { label: 'Objet du courrier', helper: "Résumé en une ligne de l'objet du courrier." },
  montant: { label: 'Montant réclamé (en FCFA)', helper: 'Montant principal, hors intérêts et pénalités éventuels.', type: 'text' },
  delai: { label: 'Délai accordé pour exécution', helper: 'Délai en jours (ex: 8 jours, 15 jours).' },
  fondement_juridique: { label: 'Fondement juridique invoqué', helper: "Article(s) de loi ou de contrat sur lesquels vous fondez la demande." },
  reference_contrat: { label: 'Référence du contrat ou de la commande', helper: 'Numéro ou date du contrat, bon de commande, ou facture concerné.' },
  objet_reclamation: { label: 'Objet de la réclamation', helper: "Décrivez précisément le manquement ou l'inexécution constatée.", rows: 4 },
  pieces_jointes: { label: 'Pièces jointes listées', helper: 'Listez les documents annexés (ex: facture n°123, bon de livraison du 10/06/2026).' },
  salarie: { label: "Salarié (nom, poste, date d'embauche)", helper: 'Identité complète et situation du salarié.' },
  employeur: { label: "Employeur (raison sociale, adresse)", helper: "Nom de l'entreprise et siège social." },
  date_faits: { label: 'Date des faits', helper: 'Date ou période à laquelle les faits se sont produits.' },
  demande: { label: 'Demande formulée', helper: "Ce que vous demandez expressément à l'employeur.", rows: 3 },
  requerant: { label: 'Requérant (nom, qualité, adresse)', helper: 'Identité et qualité de la personne qui formule le recours.' },
  autorite: { label: 'Autorité destinataire', helper: "Nom et adresse de l'autorité administrative saisie." },
  objet_recours: { label: 'Objet du recours', helper: 'Décision ou acte contesté, ou acte sollicité.' },
  decision_contestee: { label: 'Décision contestée (référence, date)', helper: 'Référence et date de la décision administrative contestée.' },
  fondement: { label: 'Fondement juridique', helper: 'Textes légaux ou réglementaires sur lesquels le recours est fondé.' },
  demandeur: { label: "Demandeur (nom, qualité, domicile)", helper: "Identité complète du demandeur à l'instance." },
  defendeur: { label: 'Défendeur (nom, qualité, domicile)', helper: 'Identité complète du défendeur.' },
  juridiction: { label: 'Juridiction saisie', helper: 'Nom et siège de la juridiction (ex: Tribunal de Grande Instance de Yaoundé).' },
  faits: { label: 'Exposé des faits', helper: 'Récit chronologique et précis des faits à soumettre à la juridiction.', rows: 6 },
  moyens_droit: { label: 'Moyens de droit', helper: 'Arguments juridiques et textes applicables.', rows: 4 },
  pretentions: { label: 'Prétentions (chef par chef)', helper: 'Listez chaque demande avec son montant ou sa nature.', rows: 3 },
};

export default function DocumentForm({ template, onBack, onSubmit, isGenerating }: DocumentFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Record<string, string>>();

  const onFormSubmit = (data: Record<string, string>) => {
    onSubmit(data);
  };

  return (
    <div className="flex gap-6">
      {/* Form */}
      <div className="flex-1 min-w-0">
        <div className="card p-6">
          {/* Template header */}
          <div className="flex items-center gap-3 mb-6 pb-6 border-b border-border">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <Icon name={template.icon as Parameters<typeof Icon>[0]['name']} size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">{template.name}</h2>
              <p className="text-xs text-muted-foreground">{template.domain}</p>
            </div>
            {template.humanReviewLevel === 'required' && (
              <div className="ml-auto flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg">
                <Icon name="ExclamationCircleIcon" size={14} className="text-red-600" />
                <span className="text-xs font-medium text-red-700">Revue professionnelle obligatoire avant dépôt</span>
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit(onFormSubmit)} className="flex flex-col gap-5">
            {template.requiredFields.map((field) => {
              const config = fieldConfig[field] || { label: field };
              const isTextarea = config.rows && config.rows > 2;

              return (
                <div key={`field-${field}`}>
                  <label className="label" htmlFor={`field-${field}`}>
                    {config.label}
                    <span className="text-red-500 ml-1" aria-hidden>*</span>
                  </label>
                  {config.helper && (
                    <p className="helper-text mb-2">{config.helper}</p>
                  )}
                  {isTextarea ? (
                    <textarea
                      id={`field-${field}`}
                      rows={config.rows}
                      className={`input-field resize-none ${errors[field] ? 'border-red-400 focus:border-red-400' : ''}`}
                      placeholder={`Saisissez ${config.label.toLowerCase()}...`}
                      aria-describedby={errors[field] ? `error-${field}` : undefined}
                      {...register(field, { required: 'Ce champ est obligatoire.' })}
                    />
                  ) : (
                    <input
                      id={`field-${field}`}
                      type={config.type || 'text'}
                      className={`input-field ${errors[field] ? 'border-red-400 focus:border-red-400' : ''}`}
                      placeholder={`Saisissez ${config.label.toLowerCase()}...`}
                      aria-describedby={errors[field] ? `error-${field}` : undefined}
                      {...register(field, { required: 'Ce champ est obligatoire.' })}
                    />
                  )}
                  {errors[field] && (
                    <p id={`error-${field}`} className="error-text" role="alert">
                      {errors[field]?.message as string}
                    </p>
                  )}
                </div>
              );
            })}

            {/* Actions */}
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
                {isGenerating ? (
                  <>
                    <Icon name="ArrowPathIcon" size={16} className="animate-spin" />
                    Génération en cours...
                  </>
                ) : (
                  <>
                    <Icon name="DocumentTextIcon" size={16} />
                    Générer le document
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Sidebar info */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-4">
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Champs obligatoires</h3>
          <div className="space-y-2">
            {template.requiredFields.map((field) => (
              <div key={`req-${field}`} className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-accent rounded-full flex-shrink-0" />
                <span className="text-xs text-foreground">
                  {fieldConfig[field]?.label || field}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Fondements juridiques</h3>
          <div className="space-y-1.5">
            {template.legalBasis.map((basis) => (
              <span
                key={`legal-${basis.slice(0, 20)}`}
                className="block font-mono-ref text-xs px-2 py-1 bg-primary/5 text-primary rounded"
              >
                {basis}
              </span>
            ))}
          </div>
        </div>

        <div className="card p-4 border-amber-200 bg-amber-50">
          <div className="flex items-start gap-2">
            <Icon name="InformationCircleIcon" size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-amber-700 mb-1">Avant de générer</p>
              <p className="text-xs text-amber-600 leading-relaxed">
                Vérifiez l'exactitude de toutes les informations saisies. Aucun document ne sera exporté avec des variables non renseignées.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}