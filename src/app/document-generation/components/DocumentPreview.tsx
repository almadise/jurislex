'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import StatusBadge from '@/components/ui/StatusBadge';
import type { DocumentTemplate, GeneratedDocument } from './DocumentGenerationContent';

interface DocumentPreviewProps {
  template: DocumentTemplate;
  formData: Record<string, string>;
  generated: GeneratedDocument;
  onBack: () => void;
  onExport: (format: 'docx' | 'pdf') => void;
  isExporting: 'docx' | 'pdf' | null;
  confirmReview: boolean;
  onConfirmReviewChange: (v: boolean) => void;
}

export default function DocumentPreview({
  template,
  formData,
  generated,
  onBack,
  onExport,
  isExporting,
  confirmReview,
  onConfirmReviewChange,
}: DocumentPreviewProps) {
  const [activeTab, setActiveTab] = useState<'preview' | 'warnings' | 'citations'>('preview');

  const exportDisabled =
    isExporting !== null ||
    generated.unresolvedPlaceholders.length > 0 ||
    (template.humanReviewLevel === 'required' && !confirmReview);

  const tabs = [
    { id: 'preview' as const, label: 'Aperçu du document' },
    { id: 'warnings' as const, label: `Avertissements (${generated.warnings.length})` },
    { id: 'citations' as const, label: `Citations (${generated.legalBasis.length})` },
  ];

  return (
    <div className="flex gap-6">
      <div className="flex-1 min-w-0 card flex flex-col overflow-hidden">
        <div className="flex border-b border-border flex-shrink-0">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 ${
                activeTab === t.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-6">
          {activeTab === 'preview' && (
            <div className="fade-in max-w-2xl mx-auto">
              <div className="text-center mb-6">
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">
                  Document généré — projet à valider
                </p>
                <h2 className="text-lg font-semibold">{generated.title.toUpperCase()}</h2>
                {generated.watermark && (
                  <p className="text-xs font-semibold text-amber-700 mt-2">{generated.watermark}</p>
                )}
              </div>
              <div className="bg-white border border-border rounded-lg p-8 shadow-sm">
                <pre className="text-sm text-foreground leading-relaxed whitespace-pre-wrap font-sans">
                  {generated.body}
                </pre>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-green-700">
                <Icon name="CheckCircleIcon" size={14} />
                {generated.unresolvedPlaceholders.length === 0
                  ? 'Aucune variable non résolue'
                  : `${generated.unresolvedPlaceholders.length} variable(s) non résolue(s)`}
              </div>
            </div>
          )}

          {activeTab === 'warnings' && (
            <div className="space-y-3 max-w-2xl mx-auto">
              {generated.warnings.map((w, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 p-4 rounded-lg border bg-amber-50 border-amber-200 text-amber-800"
                >
                  <Icon name="ExclamationTriangleIcon" size={16} className="mt-0.5" />
                  <p className="text-sm">{w}</p>
                </div>
              ))}
              {template.humanReviewLevel === 'required' && (
                <label className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={confirmReview}
                    onChange={(e) => onConfirmReviewChange(e.target.checked)}
                  />
                  <span>
                    Confirmer la prise en compte de la revue professionnelle obligatoire (requis
                    pour l’export).
                  </span>
                </label>
              )}
            </div>
          )}

          {activeTab === 'citations' && (
            <div className="space-y-3 max-w-2xl mx-auto">
              {generated.legalBasis.map((ref, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg border border-border"
                >
                  <Icon name="BookOpenIcon" size={16} className="text-primary" />
                  <div className="flex-1">
                    <p className="font-mono-ref text-sm font-medium text-primary">{ref}</p>
                    <p className="text-xs text-muted-foreground">Fondement du modèle versionné</p>
                  </div>
                  <StatusBadge type="claim" value="supported" size="sm" />
                </div>
              ))}
              <p className="text-[11px] text-muted-foreground">
                Les fondements listés sont ceux déclarés dans le modèle. Le rattachement article
                par article au corpus indexé pourra être renforcé en S5+ (citations retrieval).
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 p-4 border-t border-border flex-shrink-0 flex-wrap">
          <button type="button" onClick={onBack} className="btn-secondary">
            <Icon name="ArrowLeftIcon" size={16} />
            Modifier
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => onExport('docx')}
            disabled={exportDisabled}
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
            type="button"
            onClick={() => onExport('pdf')}
            disabled={exportDisabled}
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

      <div className="w-72 flex-shrink-0 flex flex-col gap-4">
        <div className="card p-4">
          <h3 className="text-sm font-semibold mb-3">Récapitulatif</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {Object.entries(formData).map(([key, value]) => (
              <div key={key}>
                <p className="text-[10px] font-semibold uppercase text-muted-foreground">{key}</p>
                <p className="text-xs truncate">{value}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="card p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <Icon name="CheckCircleIcon" size={14} className="text-green-500" />
            Variables résolues
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Icon name="CheckCircleIcon" size={14} className="text-green-500" />
            Modèle v{generated.templateVersion}
          </div>
          <div className="flex items-center gap-2 text-xs">
            {template.humanReviewLevel === 'required' ? (
              <Icon name="ExclamationCircleIcon" size={14} className="text-red-500" />
            ) : (
              <Icon name="ExclamationTriangleIcon" size={14} className="text-amber-500" />
            )}
            {template.humanReviewLevel === 'required'
              ? 'Revue obligatoire'
              : template.humanReviewLevel === 'recommended'
                ? 'Revue recommandée'
                : 'Prêt'}
          </div>
        </div>
      </div>
    </div>
  );
}
