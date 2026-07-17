'use client';

import React, { useState, useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';
import StatusBadge from '@/components/ui/StatusBadge';
import QAResponseSection from './QAResponseSection';
import CitationPanel from './CitationPanel';
import AbstentionNotice from '@/components/ui/AbstentionNotice';
import { getChatCompletion } from '@/lib/ai/chatCompletion';
import { QA_SYSTEM_PROMPT, QA_USER_PROMPT } from '@/lib/ai/legalPrompts';
import { toast } from 'sonner';

export interface QACitation {
  id: string;
  reference: string;
  article: string;
  title: string;
  excerpt: string;
  page: number;
  authority: string;
  legalStatus: 'verified' | 'probable' | 'unknown' | 'repealed' | 'superseded';
  claimStatus: 'supported' | 'inferred' | 'uncertain' | 'unsupported' | 'conflicting';
  domain: string;
}

export interface QAResponse {
  question: string;
  summary: string;
  legalRule: string;
  application: string;
  uncertainties: string[];
  conflicts: string[];
  riskLevel: 'low' | 'medium' | 'high';
  warningMessage: string;
  citations: QACitation[];
  missingTexts: string[];
  abstractionMode?: boolean;
}

const suggestedQuestions = [
  "Quelles sont les obligations d\'un employeur en cas de licenciement économique au Cameroun ?",
  "Quel est le délai de prescription pour une action en paiement d\'indemnité de licenciement ?",
  "Comment calculer les intérêts de retard sur une créance commerciale selon l\'OHADA ?",
  "Quelles sont les formalités de création d'une SARL au Cameroun selon l'Acte uniforme ?",
];

export default function LegalQAContent() {
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<QAResponse | null>(null);
  const [selectedCitation, setSelectedCitation] = useState<QACitation | null>(null);
  const [showAllCitations, setShowAllCitations] = useState(false);

  const handleSubmit = async () => {
    if (!question.trim()) return;
    setIsLoading(true);
    setResponse(null);
    setSelectedCitation(null);

    try {
      const result = await getChatCompletion(
        'OPEN_AI',
        'gpt-4o',
        [
          { role: 'system', content: QA_SYSTEM_PROMPT },
          { role: 'user', content: QA_USER_PROMPT(question) },
        ],
        {
          max_completion_tokens: 3000,
          temperature: 0.2,
          response_format: { type: 'json_object' },
        }
      );

      const content = result?.choices?.[0]?.message?.content;
      if (!content) throw new Error('Réponse vide du modèle');

      const parsed: QAResponse = JSON.parse(content);
      setResponse(parsed);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erreur lors de la génération de la réponse';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="page-title">Questions & Réponses juridiques</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Chaque réponse est exclusivement fondée sur le corpus indexé — toute affirmation est sourcée ou explicitement marquée incertaine.
        </p>
      </div>

      {/* Question input */}
      <div className="card p-4">
        <label className="label" htmlFor="qa-input">
          Posez votre question juridique
        </label>
        <p className="helper-text mb-3">
          Formulez votre question en langage naturel. Le système identifiera les dispositions pertinentes et structurera une réponse sourcée.
        </p>
        <div className="flex gap-3">
          <textarea
            id="qa-input"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ex: Quelles sont les obligations d'un employeur en cas de licenciement économique au Cameroun ?"
            className="input-field flex-1 resize-none"
            rows={3}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
            }}
          />
          <div className="flex flex-col gap-2">
            <button
              onClick={handleSubmit}
              disabled={isLoading || !question.trim()}
              className="btn-primary h-full px-5 justify-center"
            >
              {isLoading ? (
                <Icon name="ArrowPathIcon" size={18} className="animate-spin" />
              ) : (
                <Icon name="PaperAirplaneIcon" size={18} />
              )}
            </button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-[10px] font-mono">⌘↵</kbd> pour envoyer
        </p>

        {/* Suggested questions */}
        {!response && !isLoading && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Questions fréquentes</p>
            <div className="flex flex-wrap gap-2">
              {suggestedQuestions.map((q) => (
                <button
                  key={`suggested-${q.slice(0, 20)}`}
                  onClick={() => setQuestion(q)}
                  className="text-xs px-3 py-1.5 bg-muted hover:bg-secondary border border-border rounded-full text-foreground transition-colors"
                >
                  {q.length > 60 ? q.slice(0, 60) + '…' : q}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <Icon name="ArrowPathIcon" size={16} className="text-primary animate-spin" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Analyse juridique en cours…</p>
              <p className="text-xs text-muted-foreground">Recherche dans le corpus camerounais et OHADA</p>
            </div>
          </div>
          <div className="animate-pulse space-y-3">
            <div className="h-3 bg-muted rounded w-full" />
            <div className="h-3 bg-muted rounded w-5/6" />
            <div className="h-3 bg-muted rounded w-4/5" />
            <div className="h-3 bg-muted rounded w-3/4 mt-4" />
            <div className="h-3 bg-muted rounded w-full" />
          </div>
        </div>
      )}

      {/* Response */}
      {response && !isLoading && (
        <div className="flex gap-6">
          {/* Main response */}
          <div className="flex-1 min-w-0 flex flex-col gap-4">
            {/* Question recap */}
            <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
                <Icon name="QuestionMarkCircleIcon" size={16} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Question analysée</p>
                <p className="text-sm text-foreground font-medium">{response.question}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <StatusBadge type="risk" value={response.riskLevel} size="sm" />
              </div>
            </div>

            {/* Abstention mode — full panel replaces normal response */}
            {response.abstractionMode ? (
              <AbstentionNotice
                moduleLabel="Q&A Juridique"
                explanation={response.summary}
                missingElements={response.missingTexts}
                referralMessage={response.warningMessage}
                onReset={() => { setResponse(null); setQuestion(''); }}
                resetLabel="Poser une nouvelle question"
              />
            ) : (
              <>
                <QAResponseSection
                  response={response}
                  onCitationClick={(c) => setSelectedCitation(c)}
                />

                {/* Conflicts */}
                {response.conflicts.length > 0 && (
                  <div className="card p-4 border-purple-200 bg-purple-50">
                    <div className="flex items-center gap-2 mb-3">
                      <Icon name="ExclamationCircleIcon" size={16} className="text-purple-600" />
                      <span className="text-sm font-semibold text-purple-800">Conflits entre sources détectés</span>
                    </div>
                    <div className="space-y-2">
                      {response.conflicts.map((conflict, i) => (
                        <p key={`conflict-${i}`} className="text-xs text-purple-700 leading-relaxed">{conflict}</p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Missing texts */}
                {response.missingTexts.length > 0 && (
                  <div className="card p-4 border-gray-200 bg-gray-50">
                    <div className="flex items-center gap-2 mb-3">
                      <Icon name="DocumentMinusIcon" size={16} className="text-gray-500" />
                      <span className="text-sm font-semibold text-gray-700">Textes non disponibles dans le corpus</span>
                    </div>
                    <div className="space-y-1">
                      {response.missingTexts.map((text, i) => (
                        <p key={`missing-${i}`} className="text-xs text-gray-600">• {text}</p>
                      ))}
                    </div>
                  </div>
                )}

                {/* Warning */}
                <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <Icon name="ShieldExclamationIcon" size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800 leading-relaxed">{response.warningMessage}</p>
                </div>

                {/* New question button */}
                <button
                  onClick={() => { setResponse(null); setQuestion(''); }}
                  className="btn-secondary self-start"
                >
                  <Icon name="PlusIcon" size={16} />
                  Nouvelle question
                </button>
              </>
            )}
          </div>

          {/* Citation panel — hidden in abstention mode */}
          {!response.abstractionMode && (
            <div className="w-80 flex-shrink-0">
              <CitationPanel
                citations={response.citations}
                selectedCitation={selectedCitation}
                onSelect={setSelectedCitation}
                showAll={showAllCitations}
                onToggleShowAll={() => setShowAllCitations((v) => !v)}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}