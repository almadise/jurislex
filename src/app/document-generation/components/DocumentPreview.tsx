'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import StatusBadge from '@/components/ui/StatusBadge';
import type { DocumentTemplate, GeneratedDocumentData } from './DocumentGenerationContent';

interface DocumentPreviewProps {
  template: DocumentTemplate;
  formData: Record<string, string>;
  generatedDoc: GeneratedDocumentData;
  onBack: () => void;
  onExport: (format: 'docx' | 'pdf') => void;
  isExporting: 'docx' | 'pdf' | null;
}

export default function DocumentPreview({ template, formData, generatedDoc, onBack, onExport, isExporting }: DocumentPreviewProps) {
  const [activeTab, setActiveTab] = useState<'preview' | 'warnings' | 'citations'>('preview');

  // Merge LLM warnings with template-level review requirement
  const allWarnings = [
    ...(template.humanReviewLevel === 'required'
      ? [{ id: 'warn-review-req', type: 'review' as const, message: 'Ce document requiert une validation par un avocat avant tout dépôt officiel.' }]
      : template.humanReviewLevel === 'recommended'
      ? [{ id: 'warn-review-rec', type: 'review' as const, message: 'Une revue par un professionnel du droit est recommandée avant envoi.' }]
      : []),
    ...generatedDoc.warnings.map((w, i) => ({ id: `warn-llm-${i}`, ...w })),
  ];

  const warningTypeConfig = {
    missing: { icon: 'ExclamationCircleIcon', className: 'bg-red-50 border-red-200 text-red-700', iconClass: 'text-red-500' },
    review: { icon: 'ShieldExclamationIcon', className: 'bg-amber-50 border-amber-200 text-amber-700', iconClass: 'text-amber-500' },
    legal: { icon: 'ScaleIcon', className: 'bg-blue-50 border-blue-200 text-blue-700', iconClass: 'text-blue-500' },
    info: { icon: 'InformationCircleIcon', className: 'bg-gray-50 border-gray-200 text-gray-600', iconClass: 'text-gray-400' },
  };

  const tabs = [
    { id: 'preview', label: 'Aperçu du document' },
    { id: 'warnings', label: `Avertissements (${allWarnings.length})` },
    { id: 'citations', label: `Citations (${generatedDoc.citations.length})` },
  ] as const;

  const fieldLabels: Record<string, string> = {
    expediteur: 'Expéditeur', destinataire: 'Destinataire', objet: 'Objet',
    montant: 'Montant', delai: 'Délai', fondement_juridique: 'Fondement',
    salarie: 'Salarié', employeur: 'Employeur', demande: 'Demande',
    requerant: 'Requérant', autorite: 'Autorité', objet_recours: 'Objet recours',
    demandeur: 'Demandeur', defendeur: 'Défendeur', juridiction: 'Juridiction',
  };

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
                  ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
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
              </div>

              {/* Missing fields warning */}
              {!generatedDoc.isComplete && generatedDoc.missingFields.length > 0 && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon name="ExclamationCircleIcon" size={16} className="text-red-600" />
                    <p className="text-sm font-semibold text-red-700">Champs manquants détectés</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {generatedDoc.missingFields.map((f, i) => (
                      <span key={`mf-${i}`} className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded font-mono">{f}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Document body */}
              <div className="max-w-2xl mx-auto">
                <div className="bg-white border border-border rounded-lg p-8 shadow-sm">
                  <pre className="text-sm text-foreground leading-relaxed whitespace-pre-wrap font-sans">
                    {generatedDoc.documentContent}
                  </pre>
                </div>

                {/* Legal citations footer */}
                {generatedDoc.citations.length > 0 && (
                  <div className="mt-6 p-4 bg-muted/50 rounded-lg border border-border">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Références juridiques utilisées
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {generatedDoc.citations.map((c, i) => (
                        <span
                          key={`cite-${i}`}
                          className="font-mono-ref text-xs px-2 py-1 bg-primary/10 text-primary rounded"
                        >
                          {c.reference}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'warnings' && (
            <div className="fade-in space-y-3 max-w-2xl mx-auto">
              {allWarnings.length === 0 ? (
                <div className="flex flex-col items-center py-12 text-center">
                  <Icon name="CheckCircleIcon" size={40} className="text-green-500 mb-3" />
                  <p className="text-base font-semibold text-foreground">Aucun avertissement</p>
                  <p className="text-sm text-muted-foreground">Le document est prêt à l'export.</p>
                </div>
              ) : (
                allWarnings.map((warning) => {
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
              {generatedDoc.citations.map((c, i) => (
                <div key={`cit-${i}`} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border">
                  <Icon name="BookOpenIcon" size={16} className="text-primary flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-mono-ref text-sm font-medium text-primary">{c.reference}</p>
                    <p className="text-xs text-muted-foreground">{c.usage}</p>
                  </div>
                  <StatusBadge type="claim" value="supported" size="sm" />
                </div>
              ))}
              {generatedDoc.citations.length > 0 && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Icon name="ShieldCheckIcon" size={14} className="text-green-600" />
                    <p className="text-xs font-medium text-green-700">
                      Citations générées à partir du corpus juridique camerounais et OHADA.
                    </p>
                  </div>
                </div>
              )}
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

          {/* Block export if unresolved variables */}
          {!generatedDoc.isComplete && generatedDoc.missingFields.length > 0 ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                <Icon name="ExclamationCircleIcon" size={14} className="text-red-600 flex-shrink-0" />
                <span className="text-xs font-medium text-red-700">
                  Export bloqué — variables non résolues : {generatedDoc.missingFields.join(', ')}
                </span>
              </div>
              <button disabled className="btn-secondary min-w-[140px] justify-center opacity-40 cursor-not-allowed">
                <Icon name="DocumentArrowDownIcon" size={16} />
                Export DOCX
              </button>
              <button disabled className="btn-primary min-w-[140px] justify-center opacity-40 cursor-not-allowed">
                <Icon name="DocumentArrowDownIcon" size={16} />
                Export PDF
              </button>
            </div>
          ) : (
            <>
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
                {isExporting === 'docx' ? 'Génération...' : 'Export DOCX'}
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
                {isExporting === 'pdf' ? 'Génération...' : 'Export PDF'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Sidebar summary */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-4">
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Récapitulatif</h3>
          <div className="space-y-2">
            {Object.entries(formData).map(([key, value]) => {
              if (!value) return null;
              return (
                <div key={`recap-${key}`}>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {fieldLabels[key] || key}
                  </p>
                  <p className="text-xs text-foreground line-clamp-2">{value}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-2">Statut du document</h3>
          <div className="flex items-center gap-2">
            {generatedDoc.isComplete ? (
              <>
                <Icon name="CheckCircleIcon" size={16} className="text-green-600" />
                <span className="text-xs font-medium text-green-700">Complet — prêt à l'export</span>
              </>
            ) : (
              <>
                <Icon name="ExclamationCircleIcon" size={16} className="text-amber-600" />
                <span className="text-xs font-medium text-amber-700">Incomplet — champs manquants</span>
              </>
            )}
          </div>
        </div>

        {template.humanReviewLevel !== 'none' && (
          <div className={`card p-4 ${template.humanReviewLevel === 'required' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
            <div className="flex items-start gap-2">
              <Icon name="ShieldExclamationIcon" size={16} className={`flex-shrink-0 mt-0.5 ${template.humanReviewLevel === 'required' ? 'text-red-600' : 'text-amber-600'}`} />
              <div>
                <p className={`text-xs font-semibold mb-1 ${template.humanReviewLevel === 'required' ? 'text-red-700' : 'text-amber-700'}`}>
                  {template.humanReviewLevel === 'required' ? 'Revue professionnelle obligatoire' : 'Revue professionnelle recommandée'}
                </p>
                <p className={`text-xs leading-relaxed ${template.humanReviewLevel === 'required' ? 'text-red-600' : 'text-amber-600'}`}>
                  {template.humanReviewLevel === 'required' ?'Ce document ne peut pas être déposé sans validation préalable par un avocat.' :'Une vérification par un professionnel du droit est conseillée avant envoi.'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}