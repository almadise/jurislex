'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';

import ClarificationWizard from './ClarificationWizard';
import AnalysisOutput from './AnalysisOutput';

export type AnalysisStep = 'input' | 'clarification' | 'result';

export interface FactObject {
  parties: { name: string; quality: string }[];
  jurisdiction: string;
  dates: { label: string; date: string }[];
  legalRelation: string;
  admittedFacts: string[];
  disputedFacts: string[];
  amounts: { label: string; amount: string }[];
  objective: string;
  legalIssues: string[];
  missingInfo: string[];
  urgencies: string[];
  confidenceLevel: number;
}

export interface StructuredAnalysis {
  factObject: FactObject;
  applicableLaw: { reference: string; article: string; relevance: string }[];
  qualification: string;
  risks: { level: 'low' | 'medium' | 'high'; description: string }[];
  evidence: { item: string; status: 'available' | 'to_gather' | 'missing' }[];
  nextSteps: { priority: number; action: string; deadline?: string }[];
  overallRisk: 'low' | 'medium' | 'high';
  confidenceLevel: number;
}

const mockAnalysis: StructuredAnalysis = {
  factObject: {
    parties: [
      { name: 'Mme Nkeng Abanda', quality: 'Salariée / Demanderesse potentielle' },
      { name: 'SARL Fotso & Associés', quality: 'Employeur / Défendeur potentiel' },
    ],
    jurisdiction: 'Tribunal de Grande Instance de Douala — Chambre sociale',
    dates: [
      { label: 'Date d\'embauche', date: '03/01/2019' },
      { label: 'Date de notification de licenciement', date: '28/05/2026' },
      { label: 'Fin du préavis (estimée)', date: '12/07/2026' },
    ],
    legalRelation: 'Contrat de travail à durée indéterminée — Droit du travail camerounais',
    admittedFacts: [
      'Contrat de travail à durée indéterminée depuis le 03/01/2019',
      'Notification de licenciement reçue le 28/05/2026',
      'Ancienneté de 7 ans et 5 mois à la date de licenciement',
      'Salaire mensuel brut de 450 000 FCFA',
    ],
    disputedFacts: [
      'Nature exacte du motif invoqué (économique vs personnel)',
      'Consultation préalable des délégués du personnel (non confirmée)',
      'Notification à l\'Inspection du travail (non vérifiée)',
    ],
    amounts: [
      { label: 'Salaire mensuel brut', amount: '450 000 FCFA' },
      { label: 'Indemnité de licenciement estimée', amount: '630 000 FCFA' },
      { label: 'Préavis (3 mois estimé)', amount: '1 350 000 FCFA' },
    ],
    objective: 'Contester le licenciement et obtenir paiement des indemnités dues',
    legalIssues: [
      'Le licenciement respecte-t-il la procédure légale camerounaise ?',
      'L\'indemnité de licenciement est-elle correctement calculée ?',
      'Y a-t-il lieu à licenciement abusif ?',
      'Quel est le délai de prescription de l\'action ?',
    ],
    missingInfo: [
      'Copie du contrat de travail signé',
      'Lettre de licenciement (motif exact)',
      'Preuve de consultation des délégués du personnel',
      'Bulletins de salaire des 12 derniers mois',
    ],
    urgencies: [
      'Délai de prescription de l\'action prud\'homale : 2 ans à compter de la notification — échéance au 28/05/2028',
      'Vérifier si le préavis a été effectué ou payé en lieu et place',
    ],
    confidenceLevel: 72,
  },
  applicableLaw: [
    { reference: 'LOI-92-007-1992', article: 'Art. 39', relevance: 'Définition du licenciement abusif' },
    { reference: 'LOI-92-007-1992', article: 'Art. 40', relevance: 'Conditions du licenciement économique' },
    { reference: 'LOI-92-007-1992', article: 'Art. 41', relevance: 'Calcul de l\'indemnité de licenciement' },
    { reference: 'LOI-92-007-1992', article: 'Art. 42', relevance: 'Procédure de licenciement collectif' },
    { reference: 'LOI-92-007-1992', article: 'Art. 70', relevance: 'Délai de prescription des actions' },
    { reference: 'CC-CMR-1981', article: 'Art. 1382', relevance: 'Responsabilité délictuelle (dommages-intérêts)' },
  ],
  qualification: 'Licenciement potentiellement abusif pour non-respect de la procédure légale (absence de consultation des délégués du personnel et de notification à l\'Inspection du travail). Sous réserve de confirmation des faits disputés, Mme Nkeng Abanda dispose d\'une action en licenciement abusif avec demande d\'indemnisation complémentaire.',
  risks: [
    { level: 'high', description: 'Absence de preuve de consultation des délégués du personnel — élément constitutif du licenciement abusif' },
    { level: 'medium', description: 'Motif de licenciement non clairement établi — peut affecter la qualification juridique' },
    { level: 'low', description: 'Délai de prescription confortable (2 ans) — aucune urgence procédurale immédiate' },
  ],
  evidence: [
    { item: 'Lettre de licenciement', status: 'to_gather' },
    { item: 'Contrat de travail signé', status: 'to_gather' },
    { item: 'Bulletins de salaire (12 mois)', status: 'to_gather' },
    { item: 'Procès-verbal de consultation des délégués', status: 'missing' },
    { item: 'Accusé de réception de la notification à l\'Inspection', status: 'missing' },
    { item: 'Attestation de travail', status: 'available' },
  ],
  nextSteps: [
    { priority: 1, action: 'Rassembler la lettre de licenciement et le contrat de travail', deadline: '31/07/2026' },
    { priority: 2, action: 'Vérifier auprès de l\'Inspection du travail si la notification a été reçue', deadline: '07/08/2026' },
    { priority: 3, action: 'Calculer précisément les indemnités dues sur base des bulletins de salaire', deadline: '15/08/2026' },
    { priority: 4, action: 'Envoyer une mise en demeure à l\'employeur pour paiement des indemnités', deadline: '22/08/2026' },
    { priority: 5, action: 'Saisir le Tribunal de Grande Instance de Douala si absence de réponse', deadline: '28/08/2026' },
  ],
  overallRisk: 'medium',
  confidenceLevel: 72,
};

const clarificationQuestions = [
  {
    id: 'q-001',
    question: "Avez-vous reçu une lettre de licenciement précisant le motif exact ? Si oui, quel motif est mentionné (économique, faute, autre) ?",
    impact: 'Qualification juridique du licenciement et procédure applicable',
    required: true,
  },
  {
    id: 'q-002',
    question: "Y a-t-il des délégués du personnel dans l'entreprise, et avez-vous connaissance d'une réunion de consultation avant votre licenciement ?",
    impact: 'Validité de la procédure — élément constitutif du licenciement abusif',
    required: true,
  },
  {
    id: 'q-003',
    question: "Quel est votre salaire mensuel brut moyen sur les 12 derniers mois ? Avez-vous vos bulletins de salaire ?",
    impact: 'Calcul précis de l\'indemnité de licenciement et du préavis',
    required: true,
  },
  {
    id: 'q-004',
    question: "Avez-vous effectué votre préavis ou a-t-il été payé en lieu et place ? Êtes-vous toujours dans la période de préavis ?",
    impact: 'Urgence procédurale et montant des indemnités',
    required: false,
  },
];

export default function LegalAnalysisContent() {
  const [step, setStep] = useState<AnalysisStep>('input');
  const [factNarrative, setFactNarrative] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [analysis, setAnalysis] = useState<StructuredAnalysis | null>(null);

  // Backend integration point: POST /api/analysis/extract-facts with { narrative }
  const handleNarrativeSubmit = () => {
    if (!factNarrative.trim()) return;
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setStep('clarification');
    }, 900);
  };

  // Backend integration point: POST /api/analysis/analyze with { fact_object, answers }
  const handleClarificationComplete = (finalAnswers: Record<string, string>) => {
    setAnswers(finalAnswers);
    setIsProcessing(true);
    setTimeout(() => {
      setAnalysis(mockAnalysis);
      setIsProcessing(false);
      setStep('result');
    }, 1200);
  };

  const stepLabels: Record<AnalysisStep, string> = {
    input: 'Décrire la situation',
    clarification: 'Questions de clarification',
    result: 'Analyse structurée',
  };

  const allSteps: AnalysisStep[] = ['input', 'clarification', 'result'];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="page-title">Analyse de situation juridique</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Décrivez votre situation — le système identifiera les questions juridiques, le droit applicable et les prochaines démarches.
        </p>
      </div>

      {/* Step indicator */}
      <div className="card p-4">
        <div className="flex items-center gap-0">
          {allSteps.map((s, i) => {
            const currentIdx = allSteps.indexOf(step);
            const isCompleted = currentIdx > i;
            const isCurrent = step === s;
            return (
              <React.Fragment key={`analysis-step-${s}`}>
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                    isCompleted ? 'bg-green-500 text-white' : isCurrent ?'bg-primary text-white': 'bg-muted text-muted-foreground'
                  }`}>
                    {isCompleted ? <Icon name="CheckIcon" size={14} /> : i + 1}
                  </div>
                  <span className={`text-sm font-medium ${isCurrent ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {stepLabels[s]}
                  </span>
                </div>
                {i < allSteps.length - 1 && (
                  <div className={`flex-1 h-px mx-4 ${isCompleted ? 'bg-green-300' : 'bg-border'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Step: Input */}
      {step === 'input' && (
        <div className="flex gap-6">
          <div className="flex-1 card p-6">
            <label className="label" htmlFor="fact-narrative">
              Décrivez la situation factuelle
            </label>
            <p className="helper-text mb-4">
              Exposez les faits de manière chronologique : qui sont les parties, quand les faits se sont-ils produits, quel est votre objectif. Ne qualifiez pas juridiquement — décrivez simplement ce qui s'est passé.
            </p>
            <textarea
              id="fact-narrative"
              value={factNarrative}
              onChange={(e) => setFactNarrative(e.target.value)}
              placeholder="Ex: Je suis salariée chez SARL Fotso & Associés depuis janvier 2019. Le 28 mai 2026, j'ai reçu une lettre de licenciement sans que les délégués du personnel aient été consultés à ma connaissance. Mon salaire est de 450 000 FCFA par mois. Je souhaite contester ce licenciement et obtenir mes indemnités..."
              className="input-field resize-none w-full"
              rows={10}
            />
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs text-muted-foreground">
                {factNarrative.length} caractère{factNarrative.length !== 1 ? 's' : ''}
              </p>
              <button
                onClick={handleNarrativeSubmit}
                disabled={isProcessing || factNarrative.trim().length < 50}
                className="btn-primary min-w-[200px] justify-center"
              >
                {isProcessing ? (
                  <>
                    <Icon name="ArrowPathIcon" size={16} className="animate-spin" />
                    Extraction des faits...
                  </>
                ) : (
                  <>
                    <Icon name="DocumentMagnifyingGlassIcon" size={16} />
                    Analyser la situation
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Guidance */}
          <div className="w-72 flex-shrink-0 flex flex-col gap-4">
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">Informations utiles à inclure</h3>
              <div className="space-y-2.5">
                {[
                  { icon: 'UserIcon', label: 'Identité des parties et leur qualité' },
                  { icon: 'CalendarIcon', label: 'Dates clés et chronologie' },
                  { icon: 'MapPinIcon', label: 'Lieu des faits ou juridiction' },
                  { icon: 'CurrencyDollarIcon', label: 'Montants en jeu' },
                  { icon: 'DocumentTextIcon', label: 'Documents existants' },
                  { icon: 'FlagIcon', label: 'Votre objectif (récupérer, contester, prévenir)' },
                ].map((item, i) => (
                  <div key={`guide-${i}`} className="flex items-center gap-2">
                    <Icon name={item.icon as Parameters<typeof Icon>[0]['name']} size={14} className="text-primary flex-shrink-0" />
                    <span className="text-xs text-foreground">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card p-4 bg-blue-50 border-blue-200">
              <div className="flex items-start gap-2">
                <Icon name="LightBulbIcon" size={14} className="text-blue-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700 leading-relaxed">
                  Le système posera uniquement les questions qui peuvent modifier la qualification juridique, la compétence, le délai ou la preuve à produire.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step: Clarification */}
      {step === 'clarification' && (
        <ClarificationWizard
          questions={clarificationQuestions}
          factNarrative={factNarrative}
          onComplete={handleClarificationComplete}
          onBack={() => setStep('input')}
          isProcessing={isProcessing}
        />
      )}

      {/* Step: Result */}
      {step === 'result' && analysis && (
        <AnalysisOutput
          analysis={analysis}
          onBack={() => setStep('clarification')}
        />
      )}
    </div>
  );
}