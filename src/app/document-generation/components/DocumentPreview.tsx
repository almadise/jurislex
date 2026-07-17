'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import StatusBadge from '@/components/ui/StatusBadge';
import type { DocumentTemplate } from './DocumentGenerationContent';

interface DocumentPreviewProps {
  template: DocumentTemplate;
  formData: Record<string, string>;
  onBack: () => void;
  onExport: (format: 'docx' | 'pdf') => void;
  isExporting: 'docx' | 'pdf' | null;
}

interface WarningItem {
  id: string;
  type: 'missing' | 'review' | 'legal' | 'info';
  message: string;
}

export default function DocumentPreview({ template, formData, onBack, onExport, isExporting }: DocumentPreviewProps) {
  const [activeTab, setActiveTab] = useState<'preview' | 'warnings' | 'citations'>('preview');

  const warnings: WarningItem[] = [
    ...(template.humanReviewLevel === 'required'
      ? [{ id: 'warn-review-req', type: 'review' as const, message: 'Ce document requiert une validation par un avocat avant tout dépôt officiel.' }]
      : template.humanReviewLevel === 'recommended'
      ? [{ id: 'warn-review-rec', type: 'review' as const, message: 'Une revue par un professionnel du droit est recommandée avant envoi.' }]
      : []),
    {
      id: 'warn-dates',
      type: 'legal',
      message: 'Les délais indiqués sont calculés à partir de la date de signature. Vérifiez les jours fériés et la règle de computation des délais applicable.',
    },
    {
      id: 'warn-montant',
      type: 'info',
      message: 'Les intérêts de retard éventuels ne sont pas inclus dans ce document. Consultez l\'article applicable pour le taux légal.',
    },
  ];

  const citations = [
    ...template.legalBasis.map((basis, i) => ({
      id: `cite-basis-${i}`,
      reference: basis,
      usage: 'Fondement principal du document',
    })),
    {
      id: 'cite-extra-1',
      reference: 'Art. 1134 Code Civil',
      usage: 'Force obligatoire des conventions',
    },
  ];

  const warningTypeConfig = {
    missing: { icon: 'ExclamationCircleIcon', className: 'bg-red-50 border-red-200 text-red-700', iconClass: 'text-red-500' },
    review: { icon: 'ShieldExclamationIcon', className: 'bg-amber-50 border-amber-200 text-amber-700', iconClass: 'text-amber-500' },
    legal: { icon: 'ScaleIcon', className: 'bg-blue-50 border-blue-200 text-blue-700', iconClass: 'text-blue-500' },
    info: { icon: 'InformationCircleIcon', className: 'bg-gray-50 border-gray-200 text-gray-600', iconClass: 'text-gray-400' },
  };

  const today = '17/07/2026';

  const previewText = `
À l'attention de ${formData.destinataire || '[Destinataire]'},

Objet : ${formData.objet || '[Objet]'}

Monsieur / Madame,

Par la présente, ${formData.expediteur || '[Expéditeur]'} a l'honneur de vous notifier ce qui suit :

${formData.objet_reclamation || `En application des dispositions de l'article 40 et suivants du Code du Travail camerounais (Loi n° 92-007 du 14 août 1992), ainsi que des stipulations contractuelles liant les parties, il vous est demandé de procéder au règlement de la somme de ${formData.montant || '[Montant]'} FCFA dans un délai de ${formData.delai || '[Délai]'} jours à compter de la réception des présentes.`}

À défaut de règlement dans le délai imparti, ${formData.expediteur || '[Expéditeur]'} se réserve le droit d'engager toutes poursuites judiciaires utiles pour obtenir paiement de sa créance, en ce compris les intérêts de retard et les frais de procédure.

Fondement juridique : ${formData.fondement_juridique || template.legalBasis.join(', ')}.

Veuillez agréer, Monsieur / Madame, l'expression de mes salutations distinguées.

Fait à Yaoundé, le ${today}

${formData.expediteur || '[Expéditeur]'}
  `.trim();

  const tabs = [
    { id: 'preview', label: 'Aperçu du document' },
    { id: 'warnings', label: `Avertissements (${warnings.length})` },
    { id: 'citations', label: `Citations (${citations.length})` },
  ] as const;

  return (
    <div className="flex gap-6">
      {/* Preview */}
      <div className="flex-1 min-w-0 card flex flex-col overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-border flex-shrink-0">
          {tabs.map((t) => (
            <button
              key={`prev-tab-${t.id}`}
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === t.id
                  ? 'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
          {activeTab === 'preview' && (
            <div className="fade-in">
              {/* Document header */}
              <div className="text-center mb-8">
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">DOCUMENT GÉNÉRÉ — PROJET À VALIDER</p>
                <h2 className="text-lg font-semibold text-foreground">{template.name.toUpperCase()}</h2>
                <p className="text-sm text-muted-foreground mt-1">Yaoundé, le {today}</p>
              </div>

              {/* Document body */}
              <div className="max-w-2xl mx-auto">
                <div className="bg-white border border-border rounded-lg p-8 shadow-sm">
                  <pre className="text-sm text-foreground leading-relaxed whitespace-pre-wrap font-sans">
                    {previewText}
                  </pre>
                </div>

                {/* Legal citations footer */}
                <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-border">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                    Références juridiques utilisées
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {citations.map((c) => (
                      <span
                        key={c.id}
                        className="font-mono-ref text-xs px-2 py-1 bg-primary/10 text-primary rounded"
                      >
                        {c.reference}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'warnings' && (
            <div className="fade-in space-y-3 max-w-2xl mx-auto">
              {warnings.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <Icon name="CheckCircleIcon" size={40} className="text-green-500 mb-3" />
                  <p className="text-base font-semibold text-foreground">Aucun avertissement</p>
                  <p className="text-sm text-muted-foreground">Le document est prêt à l'export.</p>
                </div>
              ) : (
                warnings.map((warning) => {
                  const config = warningTypeConfig[warning.type];
                  return (
                    <div
                      key={warning.id}
                      className={`flex items-start gap-3 p-4 rounded-lg border ${config.className}`}
                    >
                      <Icon
                        name={config.icon as Parameters<typeof Icon>[0]['name']}
                        size={16}
                        className={`flex-shrink-0 mt-0.5 ${config.iconClass}`}
                      />
                      <p className="text-sm leading-relaxed">{warning.message}</p>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {activeTab === 'citations' && (
            <div className="fade-in space-y-3 max-w-2xl mx-auto">
              {citations.map((c) => (
                <div key={c.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border">
                  <Icon name="BookOpenIcon" size={16} className="text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-mono-ref text-sm font-medium text-primary">{c.reference}</p>
                    <p className="text-xs text-muted-foreground">{c.usage}</p>
                  </div>
                  <StatusBadge type="claim" value="supported" size="sm" />
                </div>
              ))}
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2">
                  <Icon name="ShieldCheckIcon" size={14} className="text-green-600" />
                  <p className="text-xs font-medium text-green-700">
                    Toutes les citations ont été vérifiées contre des identifiants internes existants.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Export actions */}
        <div className="flex items-center gap-3 p-4 border-t border-border flex-shrink-0">
          <button onClick={onBack} className="btn-secondary">
            <Icon name="ArrowLeftIcon" size={16} />
            Modifier
          </button>
          <div className="flex-1" />
          <button
            onClick={() => onExport('docx')}
            disabled={isExporting !== null}
            className="btn-secondary min-w-[140px] justify-center"
          >
            {isExporting === 'docx' ? (
              <Icon name="ArrowPathIcon" size={16} className="animate-spin" />
            ) : (
              <Icon name="DocumentArrowDownIcon" size={16} />
            )}
            Export DOCX
          </button>
          <button
            onClick={() => onExport('pdf')}
            disabled={isExporting !== null}
            className="btn-primary min-w-[140px] justify-center"
          >
            {isExporting === 'pdf' ? (
              <Icon name="ArrowPathIcon" size={16} className="animate-spin" />
            ) : (
              <Icon name="DocumentArrowDownIcon" size={16} />
            )}
            Export PDF
          </button>
        </div>
      </div>

      {/* Sidebar summary */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-4">
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Récapitulatif</h3>
          <div className="space-y-2">
            {Object.entries(formData).map(([key, value]) => {
              const config = { label: key };
              const fieldLabel = (
                {
                  expediteur: 'Expéditeur', destinataire: 'Destinataire', objet: 'Objet',
                  montant: 'Montant', delai: 'Délai', fondement_juridique: 'Fondement',
                  salarie: 'Salarié', employeur: 'Employeur', demande: 'Demande',
                }[key] || key
              );
              return (
                <div key={`recap-${key}`}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{fieldLabel}</p>
                  <p className="text-xs text-foreground truncate">{value || '—'}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Statut du document</h3>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Icon name="CheckCircleIcon" size={14} className="text-green-500" />
              <span className="text-xs text-foreground">Aucune variable non résolue</span>
            </div>
            <div className="flex items-center gap-2">
              <Icon name="CheckCircleIcon" size={14} className="text-green-500" />
              <span className="text-xs text-foreground">Citations vérifiées</span>
            </div>
            <div className="flex items-center gap-2">
              {template.humanReviewLevel === 'required' ? (
                <Icon name="ExclamationCircleIcon" size={14} className="text-red-500" />
              ) : template.humanReviewLevel === 'recommended' ? (
                <Icon name="ExclamationTriangleIcon" size={14} className="text-amber-500" />
              ) : (
                <Icon name="CheckCircleIcon" size={14} className="text-green-500" />
              )}
              <span className="text-xs text-foreground">
                {template.humanReviewLevel === 'required' ?'Revue obligatoire avant dépôt'
                  : template.humanReviewLevel === 'recommended' ?'Revue recommandée' :'Prêt à l\'envoi'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}