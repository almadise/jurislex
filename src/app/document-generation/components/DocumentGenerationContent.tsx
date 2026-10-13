'use client';

import React, { useEffect, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { toast } from 'sonner';
import TemplateSelector from './TemplateSelector';
import DocumentForm from './DocumentForm';
import DocumentPreview from './DocumentPreview';

export type DocumentTemplate = {
  id: string;
  version?: string;
  name: string;
  description: string;
  icon: string;
  domain: string;
  requiredFields: string[];
  fields?: {
    key: string;
    label: string;
    helper?: string;
    required: boolean;
    rows?: number;
    type?: string;
  }[];
  humanReviewLevel: 'none' | 'recommended' | 'required';
  legalBasis: string[];
  estimatedTime: string;
  conditions?: string;
  structure?: string[];
  attachments?: string[];
};

export type GeneratedDocument = {
  id: string;
  templateId: string;
  templateVersion: string;
  title: string;
  body: string;
  fields: Record<string, string>;
  legalBasis: string[];
  attachments: string[];
  humanReviewLevel: 'none' | 'recommended' | 'required';
  warnings: string[];
  unresolvedPlaceholders: string[];
  blocked: boolean;
  blockReason?: string;
  watermark?: string;
  createdAt: string;
};

type Step = 'select' | 'form' | 'confirm' | 'preview';

export default function DocumentGenerationContent() {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loadingTpl, setLoadingTpl] = useState(true);
  const [step, setStep] = useState<Step>('select');
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [generated, setGenerated] = useState<GeneratedDocument | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState<'docx' | 'pdf' | null>(null);
  const [confirmReview, setConfirmReview] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch('/api/documents/templates')
      .then((r) => r.json())
      .then((data) => {
        setTemplates(data.templates || []);
      })
      .catch(() => toast.error('Impossible de charger les modèles'))
      .finally(() => setLoadingTpl(false));
  }, []);

  const stepConfig: Record<Step, { label: string; number: number }> = {
    select: { label: 'Choisir un modèle', number: 1 },
    form: { label: 'Saisir les informations', number: 2 },
    confirm: { label: 'Confirmer les faits', number: 3 },
    preview: { label: 'Prévisualiser et exporter', number: 4 },
  };

  const steps: Step[] = ['select', 'form', 'confirm', 'preview'];

  const handleSelectTemplate = (tpl: DocumentTemplate) => {
    setSelectedTemplate(tpl);
    setFormData({});
    setGenerated(null);
    setConfirmReview(false);
    setError(null);
    setStep('form');
  };

  const handleFormSubmit = (data: Record<string, string>) => {
    setFormData(data);
    setStep('confirm');
  };

  const handleConfirmGenerate = async () => {
    if (!selectedTemplate) return;
    setIsGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/documents/generate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          fields: formData,
          confirmProfessionalReview: confirmReview,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erreur || 'Génération impossible');
      setGenerated(data.document);
      setStep('preview');
      toast.success('Document généré', {
        description:
          data.document.unresolvedPlaceholders?.length === 0
            ? 'Aucune variable non résolue'
            : 'Attention aux variables',
      });
    } catch (e) {
      setError((e as Error).message);
      toast.error((e as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExport = async (format: 'docx' | 'pdf') => {
    if (!selectedTemplate) return;
    setIsExporting(format);
    setError(null);
    try {
      const res = await fetch('/api/documents/export', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          fields: formData,
          format,
          confirmProfessionalReview: confirmReview,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.erreur || `Export ${format} refusé`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedTemplate.id}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Export ${format.toUpperCase()} téléchargé`, {
        description: 'Document sans variable non résolue.',
      });
    } catch (e) {
      setError((e as Error).message);
      toast.error((e as Error).message);
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="page-title">Génération documentaire</h1>
        <p className="text-sm text-muted-foreground mt-1">
          5 modèles versionnés — validation des champs obligatoires, aucune variable non résolue à
          l’export, DOCX et PDF réels.
        </p>
      </div>

      <div className="card p-4">
        <div className="flex items-center gap-0 flex-wrap">
          {steps.map((s, i) => {
            const isCompleted = steps.indexOf(step) > i;
            const isCurrent = step === s;
            return (
              <React.Fragment key={`step-${s}`}>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                      isCompleted
                        ? 'bg-green-500 text-white'
                        : isCurrent
                          ? 'bg-primary text-white'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {isCompleted ? <Icon name="CheckIcon" size={16} /> : stepConfig[s].number}
                  </div>
                  <span
                    className={`text-sm font-medium hidden md:inline ${
                      isCurrent ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {stepConfig[s].label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`flex-1 h-px mx-3 min-w-[16px] ${isCompleted ? 'bg-green-300' : 'bg-border'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {step === 'select' &&
        (loadingTpl ? (
          <div className="card p-8 text-sm text-muted-foreground">Chargement des modèles…</div>
        ) : (
          <TemplateSelector templates={templates} onSelect={handleSelectTemplate} />
        ))}

      {step === 'form' && selectedTemplate && (
        <DocumentForm
          template={selectedTemplate}
          onBack={() => setStep('select')}
          onSubmit={handleFormSubmit}
          isGenerating={false}
          initialValues={formData}
        />
      )}

      {step === 'confirm' && selectedTemplate && (
        <div className="card p-6 max-w-2xl space-y-4">
          <h2 className="text-base font-semibold">Confirmation avant génération</h2>
          <p className="text-sm text-muted-foreground">
            Vérifiez les faits, montants, dates, destinataire et pièces. Aucun export ne sera
            possible avec un champ obligatoire vide.
          </p>
          <div className="space-y-2 border border-border rounded-lg p-4 bg-muted/30">
            {Object.entries(formData).map(([k, v]) => (
              <div key={k} className="grid grid-cols-3 gap-2 text-sm">
                <span className="text-muted-foreground font-mono-ref text-xs col-span-1">{k}</span>
                <span className="col-span-2 text-foreground whitespace-pre-wrap">{v}</span>
              </div>
            ))}
          </div>

          {selectedTemplate.humanReviewLevel === 'required' && (
            <label className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={confirmReview}
                onChange={(e) => setConfirmReview(e.target.checked)}
              />
              <span>
                Je confirme que ce <strong>projet de saisine</strong> sera revu par un professionnel
                habilité avant tout dépôt. L’export restera filigrané PROJET.
              </span>
            </label>
          )}

          {selectedTemplate.humanReviewLevel === 'recommended' && (
            <label className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={confirmReview}
                onChange={(e) => setConfirmReview(e.target.checked)}
              />
              <span>J’ai pris connaissance de la recommandation de revue professionnelle.</span>
            </label>
          )}

          {selectedTemplate.attachments && selectedTemplate.attachments.length > 0 && (
            <div className="text-xs text-muted-foreground">
              <p className="font-semibold mb-1">Pièces à joindre</p>
              <ul className="list-disc pl-4">
                {selectedTemplate.attachments.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-secondary" onClick={() => setStep('form')}>
              <Icon name="ArrowLeftIcon" size={16} />
              Modifier
            </button>
            <button
              type="button"
              className="btn-primary ml-auto"
              disabled={
                isGenerating ||
                (selectedTemplate.humanReviewLevel === 'required' && !confirmReview)
              }
              onClick={() => void handleConfirmGenerate()}
            >
              {isGenerating ? (
                <>
                  <Icon name="ArrowPathIcon" size={16} className="animate-spin" />
                  Génération…
                </>
              ) : (
                <>
                  <Icon name="DocumentTextIcon" size={16} />
                  Générer le document
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {step === 'preview' && selectedTemplate && generated && (
        <DocumentPreview
          template={selectedTemplate}
          formData={formData}
          generated={generated}
          onBack={() => setStep('confirm')}
          onExport={(fmt) => void handleExport(fmt)}
          isExporting={isExporting}
          confirmReview={confirmReview}
          onConfirmReviewChange={setConfirmReview}
        />
      )}
    </div>
  );
}
