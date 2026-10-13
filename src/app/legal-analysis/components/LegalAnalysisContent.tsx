'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { toast } from 'sonner';
import ClarificationWizard from './ClarificationWizard';
import AnalysisOutput from './AnalysisOutput';
import { fetchCurrentUser } from '@/lib/auth/client';

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
  hypotheses?: string[];
  domainGuess?: string;
}

export interface DeterministicCalc {
  id: string;
  label: string;
  result: string;
  unit?: string;
  formula: string;
  assumptions: string[];
  legalReferences: string[];
  status: 'computed' | 'blocked_missing_input' | 'hypothesis_only';
}

export interface StructuredAnalysis {
  id?: string;
  factObject: FactObject;
  applicableLaw: {
    reference: string;
    article: string;
    relevance: string;
    sourceId?: string;
    page?: number | null;
    excerpt?: string;
    verified?: boolean;
  }[];
  qualification: string;
  risks: { level: 'low' | 'medium' | 'high'; description: string }[];
  evidence: { item: string; status: 'available' | 'to_gather' | 'missing' }[];
  nextSteps: { priority: number; action: string; deadline?: string }[];
  overallRisk: 'low' | 'medium' | 'high';
  confidenceLevel: number;
  calculations?: DeterministicCalc[];
  userFacts?: string[];
  systemHypotheses?: string[];
  warningMessage?: string;
  matterId?: string | null;
  engine?: string;
}

interface ClarificationQuestion {
  id: string;
  question: string;
  impact: string;
  required: boolean;
  category?: string;
}

interface MatterOption {
  id: string;
  reference: string;
  title: string;
  parties?: string[];
  domain?: string;
}

function buildNarrativeFromMatter(m: MatterOption): string {
  const parties = (m.parties || []).join(' / ');
  return [
    `Dossier ${m.reference} — ${m.title}.`,
    m.domain ? `Domaine : ${m.domain}.` : '',
    parties ? `Parties : ${parties}.` : '',
    'Complétez ici les faits chronologiques, montants, objectif et pièces disponibles.',
  ]
    .filter(Boolean)
    .join(' ');
}

export default function LegalAnalysisContent() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<AnalysisStep>('input');
  const [factNarrative, setFactNarrative] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [factObject, setFactObject] = useState<FactObject | null>(null);
  const [questions, setQuestions] = useState<ClarificationQuestion[]>([]);
  const [analysis, setAnalysis] = useState<StructuredAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [matters, setMatters] = useState<MatterOption[]>([]);
  const [matterId, setMatterId] = useState<string>('');
  const [loggedIn, setLoggedIn] = useState(false);
  const [prefillNote, setPrefillNote] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const qMatter = searchParams.get('matterId') || '';
      const user = await fetchCurrentUser();
      setLoggedIn(Boolean(user));
      if (!user) {
        if (qMatter) {
          setPrefillNote('Connectez-vous pour rattacher l’analyse à un dossier.');
        }
        return;
      }
      const res = await fetch('/api/matters', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      const list: MatterOption[] = (data.matters || []).map(
        (m: {
          id: string;
          reference: string;
          title: string;
          parties?: string[];
          domain?: string;
        }) => ({
          id: m.id,
          reference: m.reference,
          title: m.title,
          parties: m.parties,
          domain: m.domain,
        })
      );
      setMatters(list);

      if (qMatter) {
        const found = list.find((m) => m.id === qMatter);
        if (found) {
          setMatterId(found.id);
          setFactNarrative((prev) =>
            prev.trim().length >= 20 ? prev : buildNarrativeFromMatter(found)
          );
          setPrefillNote(
            `Dossier pré-sélectionné : ${found.reference} — complétez le récit puis lancez l’analyse.`
          );
        } else {
          setPrefillNote('Dossier introuvable ou non accessible (isolation propriétaire).');
        }
      }
    })();
  }, [searchParams]);

  const handleNarrativeSubmit = async () => {
    if (factNarrative.trim().length < 20) {
      toast.error('Décrivez la situation plus en détail (20 caractères min.).');
      return;
    }
    setIsProcessing(true);
    setError(null);
    try {
      const res = await fetch('/api/analysis/extract-facts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          narrative: factNarrative,
          matterId: matterId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erreur || 'Extraction impossible');

      setFactObject(data.factObject);
      const qs: ClarificationQuestion[] = data.questions || [];
      setQuestions(qs);

      if (!qs.length || data.needsClarification === false) {
        await runAnalyze(data.factObject, {});
      } else {
        setStep('clarification');
        toast.message('Clarifications nécessaires', {
          description: `${qs.length} question(s) susceptibles de modifier l’analyse`,
        });
      }
    } catch (e) {
      setError((e as Error).message);
      toast.error((e as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const runAnalyze = async (
    facts: FactObject | null,
    answers: Record<string, string>
  ) => {
    setIsProcessing(true);
    setError(null);
    try {
      const res = await fetch('/api/analysis/analyze', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          narrative: factNarrative,
          factObject: facts,
          answers,
          matterId: matterId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.erreur || 'Analyse impossible');

      setAnalysis(data.analysis);
      setStep('result');
      toast.success('Analyse structurée prête', {
        description: data.saved
          ? data.linkedMatterId
            ? 'Enregistrée et rattachée au dossier'
            : 'Enregistrée dans votre historique'
          : `${data.analysis.applicableLaw?.length || 0} source(s) corpus`,
      });
      if (data.saveError) {
        toast.message('Analyse non rattachée', { description: data.saveError });
      }
    } catch (e) {
      setError((e as Error).message);
      toast.error((e as Error).message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClarificationComplete = (finalAnswers: Record<string, string>) => {
    void runAnalyze(factObject, finalAnswers);
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
          Récit → faits structurés → clarifications ciblées → droit corpus + calculs déterministes.
          Aucune indemnité inventée par un modèle libre.
        </p>
      </div>

      <div className="card p-4">
        <div className="flex items-center gap-0">
          {allSteps.map((s, i) => {
            const currentIdx = allSteps.indexOf(step);
            const isCompleted = currentIdx > i;
            const isCurrent = step === s;
            return (
              <React.Fragment key={`analysis-step-${s}`}>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-colors ${
                      isCompleted
                        ? 'bg-primary text-white'
                        : isCurrent
                          ? 'bg-primary/15 text-primary ring-2 ring-primary'
                          : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {isCompleted ? <Icon name="CheckIcon" size={14} /> : i + 1}
                  </div>
                  <span
                    className={`text-xs font-medium hidden sm:inline ${
                      isCurrent ? 'text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    {stepLabels[s]}
                  </span>
                </div>
                {i < allSteps.length - 1 && (
                  <div
                    className={`flex-1 h-px mx-3 ${isCompleted ? 'bg-primary' : 'bg-border'}`}
                  />
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

      {step === 'input' && (
        <div className="card p-5 flex flex-col gap-4">
          {prefillNote && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-foreground">
              {prefillNote}
            </div>
          )}

          {loggedIn && matters.length > 0 && (
            <div>
              <label className="label" htmlFor="matter-link">
                Rattacher à un dossier (optionnel)
              </label>
              <select
                id="matter-link"
                className="input-field"
                value={matterId}
                onChange={(e) => {
                  const id = e.target.value;
                  setMatterId(id);
                  const found = matters.find((m) => m.id === id);
                  if (found && factNarrative.trim().length < 40) {
                    setFactNarrative(buildNarrativeFromMatter(found));
                  }
                }}
              >
                <option value="">— Aucun —</option>
                {matters.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.reference} — {m.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="label" htmlFor="narrative">
              Décrivez les faits
            </label>
            <p className="helper-text mb-2">
              Parties, dates, montants, objectif. Les questions de clarification ne portent que sur
              ce qui peut changer la qualification, le délai, la preuve ou le document.
            </p>
            <textarea
              id="narrative"
              value={factNarrative}
              onChange={(e) => setFactNarrative(e.target.value)}
              rows={8}
              className="input-field resize-y min-h-[160px]"
              placeholder="Ex: Je suis salariée chez SARL X depuis le 03/01/2019. Le 28/05/2026 j'ai reçu une lettre de licenciement. Salaire 450 000 FCFA. Je conteste…"
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => void handleNarrativeSubmit()}
              disabled={isProcessing || factNarrative.trim().length < 20}
              className="btn-primary"
            >
              {isProcessing ? (
                <>
                  <Icon name="ArrowPathIcon" size={16} className="animate-spin" />
                  Extraction des faits…
                </>
              ) : (
                <>
                  <Icon name="SparklesIcon" size={16} />
                  Analyser la situation
                </>
              )}
            </button>
            <span className="text-xs text-muted-foreground font-mono-ref">
              {factNarrative.trim().length} car.
            </span>
          </div>
        </div>
      )}

      {step === 'clarification' && questions.length > 0 && (
        <ClarificationWizard
          questions={questions}
          factNarrative={factNarrative}
          onComplete={handleClarificationComplete}
          onBack={() => setStep('input')}
          isProcessing={isProcessing}
        />
      )}

      {step === 'result' && analysis && (
        <AnalysisOutput
          analysis={analysis}
          onBack={() => {
            setStep('input');
            setAnalysis(null);
          }}
        />
      )}

      {isProcessing && step !== 'input' && (
        <div className="card p-6 animate-pulse">
          <div className="h-4 bg-muted rounded w-1/3 mb-3" />
          <div className="h-3 bg-muted rounded w-full mb-2" />
          <div className="h-3 bg-muted rounded w-5/6" />
          <p className="text-xs text-muted-foreground mt-4">
            Calculs déterministes + retrieval corpus…
          </p>
        </div>
      )}
    </div>
  );
}
