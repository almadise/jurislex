'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import ClarificationWizard from './ClarificationWizard';
import AnalysisOutput from './AnalysisOutput';
import { getChatCompletion } from '@/lib/ai/chatCompletion';
import {
  ANALYSIS_EXTRACT_SYSTEM_PROMPT,
  ANALYSIS_EXTRACT_USER_PROMPT,
  ANALYSIS_FULL_SYSTEM_PROMPT,
  ANALYSIS_FULL_USER_PROMPT,
} from '@/lib/ai/legalPrompts';
import { toast } from 'sonner';

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

interface ClarificationQuestion {
  id: string;
  question: string;
  impact: string;
  required: boolean;
}

export default function LegalAnalysisContent() {
  const [step, setStep] = useState<AnalysisStep>('input');
  const [factNarrative, setFactNarrative] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [clarificationQuestions, setClarificationQuestions] = useState<ClarificationQuestion[]>([]);
  const [extractedFactObject, setExtractedFactObject] = useState<FactObject | null>(null);
  const [analysis, setAnalysis] = useState<StructuredAnalysis | null>(null);

  // Step 1: Extract facts + generate clarification questions via LLM
  const handleNarrativeSubmit = async () => {
    if (!factNarrative.trim()) return;
    setIsProcessing(true);

    try {
      const result = await getChatCompletion(
        'OPEN_AI',
        'gpt-4o',
        [
          { role: 'system', content: ANALYSIS_EXTRACT_SYSTEM_PROMPT },
          { role: 'user', content: ANALYSIS_EXTRACT_USER_PROMPT(factNarrative) },
        ],
        {
          max_completion_tokens: 2000,
          temperature: 0.2,
          response_format: { type: 'json_object' },
        }
      );

      const content = result?.choices?.[0]?.message?.content;
      if (!content) throw new Error('Réponse vide du modèle');

      const parsed = JSON.parse(content);
      setExtractedFactObject(parsed.factObject);
      setClarificationQuestions(parsed.clarificationQuestions || []);
      setStep('clarification');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur lors de l'extraction des faits";
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
  };

  // Step 2: Full analysis with clarification answers via LLM
  const handleClarificationComplete = async (answers: Record<string, string>) => {
    if (!extractedFactObject) return;
    setIsProcessing(true);

    try {
      const result = await getChatCompletion(
        'OPEN_AI',
        'gpt-4o',
        [
          { role: 'system', content: ANALYSIS_FULL_SYSTEM_PROMPT },
          { role: 'user', content: ANALYSIS_FULL_USER_PROMPT(extractedFactObject, answers) },
        ],
        {
          max_completion_tokens: 3000,
          temperature: 0.2,
          response_format: { type: 'json_object' },
        }
      );

      const content = result?.choices?.[0]?.message?.content;
      if (!content) throw new Error('Réponse vide du modèle');

      const parsed: StructuredAnalysis = JSON.parse(content);
      setAnalysis(parsed);
      setStep('result');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erreur lors de l'analyse juridique";
      toast.error(message);
    } finally {
      setIsProcessing(false);
    }
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
                    isCompleted ? 'bg-green-500 text-white' : isCurrent ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
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
                    Extraction des faits…
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