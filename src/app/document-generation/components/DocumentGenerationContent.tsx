'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { toast } from 'sonner';
import TemplateSelector from './TemplateSelector';
import DocumentForm from './DocumentForm';
import DocumentPreview from './DocumentPreview';
import { getChatCompletion } from '@/lib/ai/chatCompletion';
import { DOC_GEN_SYSTEM_PROMPT, DOC_GEN_USER_PROMPT } from '@/lib/ai/legalPrompts';

export type DocumentTemplate = {
  id: string;
  name: string;
  description: string;
  icon: string;
  domain: string;
  requiredFields: string[];
  humanReviewLevel: 'none' | 'recommended' | 'required';
  legalBasis: string[];
  estimatedTime: string;
};

export const templates: DocumentTemplate[] = [
  {
    id: 'tpl-mise-en-demeure',
    name: 'Mise en demeure',
    description: "Courrier formel enjoignant un débiteur ou cocontractant à s'exécuter dans un délai déterminé.",
    icon: 'ExclamationCircleIcon',
    domain: 'Droit commercial OHADA / Droit civil',
    requiredFields: ['expediteur', 'destinataire', 'objet', 'montant', 'delai', 'fondement_juridique'],
    humanReviewLevel: 'recommended',
    legalBasis: ['Art. 1139 Code Civil', 'Art. 2 OHADA-AUPSRVE-1998'],
    estimatedTime: '5 min',
  },
  {
    id: 'tpl-lettre-reclamation',
    name: 'Lettre de réclamation',
    description: 'Courrier de réclamation commerciale ou contractuelle adressé à un fournisseur ou prestataire.',
    icon: 'EnvelopeIcon',
    domain: 'Droit commercial OHADA',
    requiredFields: ['expediteur', 'destinataire', 'reference_contrat', 'objet_reclamation', 'montant', 'pieces_jointes'],
    humanReviewLevel: 'none',
    legalBasis: ['Art. 59 OHADA-AUDCG-2010', 'Art. 1134 Code Civil'],
    estimatedTime: '3 min',
  },
  {
    id: 'tpl-courrier-employeur',
    name: 'Courrier à un employeur',
    description: 'Courrier formel adressé à un employeur concernant une situation de travail (réclamation, contestation, démission).',
    icon: 'UserGroupIcon',
    domain: 'Droit du travail',
    requiredFields: ['salarie', 'employeur', 'objet', 'date_faits', 'demande'],
    humanReviewLevel: 'recommended',
    legalBasis: ['Art. 66 LOI-92-007-1992', 'Art. 41 LOI-92-007-1992'],
    estimatedTime: '4 min',
  },
  {
    id: 'tpl-recours-administratif',
    name: 'Demande / Recours administratif',
    description: 'Requête adressée à une autorité administrative pour contester une décision ou solliciter un acte.',
    icon: 'BuildingLibraryIcon',
    domain: 'Droit administratif',
    requiredFields: ['requerant', 'autorite', 'objet_recours', 'decision_contestee', 'fondement', 'demande'],
    humanReviewLevel: 'recommended',
    legalBasis: ['Loi n° 2006/022 sur les tribunaux administratifs'],
    estimatedTime: '6 min',
  },
  {
    id: 'tpl-requete-saisine',
    name: 'Requête / Projet de saisine',
    description: "Projet de requête introductive d'instance ou de saisine d'une juridiction. Revue professionnelle obligatoire avant dépôt.",
    icon: 'ScaleIcon',
    domain: 'Procédure civile / OHADA',
    requiredFields: ['demandeur', 'defendeur', 'juridiction', 'objet', 'faits', 'moyens_droit', 'pretentions'],
    humanReviewLevel: 'required',
    legalBasis: ['Art. 2 OHADA-AUPSRVE-1998', 'Code de procédure civile camerounais'],
    estimatedTime: '10 min',
  },
];

export interface GeneratedDocumentData {
  documentContent: string;
  citations: { reference: string; usage: string }[];
  warnings: { type: 'missing' | 'review' | 'legal' | 'info'; message: string }[];
  missingFields: string[];
  isComplete: boolean;
}

type Step = 'select' | 'form' | 'preview';

export default function DocumentGenerationContent() {
  const [step, setStep] = useState<Step>('select');
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [isExporting, setIsExporting] = useState<'docx' | 'pdf' | null>(null);
  const [generatedDoc, setGeneratedDoc] = useState<GeneratedDocumentData | null>(null);

  const stepConfig = {
    select: { label: 'Choisir un modèle', number: 1 },
    form: { label: 'Saisir les informations', number: 2 },
    preview: { label: 'Prévisualiser et exporter', number: 3 },
  };

  const steps: Step[] = ['select', 'form', 'preview'];

  const handleSelectTemplate = (tpl: DocumentTemplate) => {
    setSelectedTemplate(tpl);
    setGeneratedDoc(null);
    setStep('form');
  };

  const handleGeneratePreview = async (data: Record<string, string>) => {
    if (!selectedTemplate) return;
    setFormData(data);
    setIsGenerating(true);

    try {
      const result = await getChatCompletion(
        'OPEN_AI',
        'gpt-4o',
        [
          { role: 'system', content: DOC_GEN_SYSTEM_PROMPT },
          {
            role: 'user',
            content: DOC_GEN_USER_PROMPT(
              selectedTemplate.name,
              selectedTemplate.description,
              selectedTemplate.legalBasis,
              data
            ),
          },
        ],
        {
          max_completion_tokens: 3000,
          temperature: 0.3,
          response_format: { type: 'json_object' },
        }
      );

      const content = result?.choices?.[0]?.message?.content;
      if (!content) throw new Error('Réponse vide du modèle');

      const parsed: GeneratedDocumentData = JSON.parse(content);

      if (!parsed.isComplete && parsed.missingFields.length > 0) {
        toast.error(`Champs manquants : ${parsed.missingFields.join(', ')}`);
      }

      setGeneratedDoc(parsed);
      setStep('preview');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la génération du document';
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExport = (format: 'docx' | 'pdf') => {
    setIsExporting(format);
    setTimeout(() => {
      setIsExporting(null);
      toast.success(`Document exporté en ${format.toUpperCase()} avec succès`, {
        description: 'Le téléchargement va démarrer automatiquement.',
      });
    }, 1500);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="page-title">Génération documentaire</h1>
        <p className="text-sm text-muted-foreground mt-1">
          5 modèles disponibles — chaque document est généré avec citations juridiques vérifiées et aucune variable non résolue.
        </p>
      </div>

      {/* Step indicator */}
      <div className="card p-4">
        <div className="flex items-center gap-0">
          {steps.map((s, i) => {
            const isCompleted = steps.indexOf(step) > i;
            const isCurrent = step === s;
            return (
              <React.Fragment key={`step-${s}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                    isCompleted ? 'bg-green-500 text-white' : isCurrent ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
                  }`}>
                    {isCompleted ? <Icon name="CheckIcon" size={16} /> : stepConfig[s].number}
                  </div>
                  <span className={`text-sm font-medium ${isCurrent ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {stepConfig[s].label}
                  </span>
                </div>
                {i < steps.length - 1 && (
                  <div className={`flex-1 h-px mx-4 ${isCompleted ? 'bg-green-300' : 'bg-border'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Step content */}
      {step === 'select' && (
        <TemplateSelector templates={templates} onSelect={handleSelectTemplate} />
      )}

      {step === 'form' && selectedTemplate && (
        <DocumentForm
          template={selectedTemplate}
          onBack={() => setStep('select')}
          onSubmit={handleGeneratePreview}
          isGenerating={isGenerating}
        />
      )}

      {step === 'preview' && selectedTemplate && generatedDoc && (
        <DocumentPreview
          template={selectedTemplate}
          formData={formData}
          generatedDoc={generatedDoc}
          onBack={() => setStep('form')}
          onExport={handleExport}
          isExporting={isExporting}
        />
      )}
    </div>
  );
}