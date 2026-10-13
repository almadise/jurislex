'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import StatusBadge from '@/components/ui/StatusBadge';
import { toast } from 'sonner';
import QAResponseSection from './QAResponseSection';
import CitationPanel from './CitationPanel';

export interface QACitation {
  id: string;
  sourceId?: string;
  chunkId?: string | number | null;
  documentId?: string | null;
  reference: string;
  article: string;
  title: string;
  excerpt: string;
  page: number;
  authority: string;
  legalStatus: 'verified' | 'probable' | 'unknown' | 'repealed' | 'superseded';
  claimStatus: 'supported' | 'inferred' | 'uncertain' | 'unsupported' | 'conflicting';
  domain: string;
  provenance?: string;
  sourcePath?: string | null;
  matchScore?: number;
  verified?: boolean;
}

export interface QAAssertion {
  text: string;
  status: QACitation['claimStatus'];
  citationIds: string[];
}

export interface QAResponse {
  question: string;
  mode: 'answer' | 'abstain';
  summary: string;
  legalRule: string;
  application: string;
  uncertainties: string[];
  conflicts: string[];
  riskLevel: 'low' | 'medium' | 'high';
  warningMessage: string;
  citations: QACitation[];
  missingTexts: string[];
  assertions?: QAAssertion[];
  retrieval?: {
    backend: string;
    effectiveMode: string;
    hitCount: number;
    warnings: string[];
  };
  generation?: {
    engine: 'llm' | 'extractive' | 'none';
    model?: string;
    rejectedUnsupportedClaims: number;
    rejectedFakeCitations: number;
  };
  warnings?: string[];
}

const suggestedQuestions = [
  'Quelles sont les obligations en cas de licenciement selon le Code du travail camerounais ?',
  'Que dit la loi 92-007 sur le contrat de travail ?',
  'Quelles sont les conditions de l\'injonction de payer en droit OHADA ?',
  'Que prévoit le régime foncier camerounais concernant le titre foncier ?',
];

export default function LegalQAContent() {
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<QAResponse | null>(null);
  const [selectedCitation, setSelectedCitation] = useState<QACitation | null>(null);
  const [showAllCitations, setShowAllCitations] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    const q = question.trim();
    if (!q) return;

    setIsLoading(true);
    setResponse(null);
    setSelectedCitation(null);
    setError(null);

    try {
      const res = await fetch('/api/qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, retrievalLimit: 12 }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.erreur || `Erreur HTTP ${res.status}`);
      }

      const qa = data as QAResponse;
      setResponse(qa);
      if (qa.citations?.length) {
        setSelectedCitation(qa.citations[0]);
      }

      if (qa.mode === 'abstain') {
        toast.message('Abstention utile', {
          description: 'Sources insuffisantes pour une conclusion juridique catégorique.',
        });
      } else {
        toast.success('Réponse sourcée', {
          description: `${qa.citations.length} citation(s) vérifiée(s) · moteur ${qa.generation?.engine ?? '—'}`,
        });
      }
    } catch (e) {
      const msg = (e as Error).message;
      setError(msg);
      toast.error('Q&A impossible', { description: msg });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="page-title">Questions & Réponses juridiques</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Chaque réponse est exclusivement fondée sur le corpus indexé — toute affirmation est
          sourcée ou explicitement marquée incertaine. Les citations inventées sont rejetées.
        </p>
      </div>

      <div className="card p-4">
        <label className="label" htmlFor="qa-input">
          Posez votre question juridique
        </label>
        <p className="helper-text mb-3">
          Formulez votre question en langage naturel. Le système récupère les dispositions
          pertinentes, structure une réponse et vérifie chaque citation.
        </p>
        <div className="flex gap-3">
          <textarea
            id="qa-input"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ex: Quelles sont les obligations d'un employeur en cas de licenciement au Cameroun ?"
            className="input-field flex-1 resize-none"
            rows={3}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void handleSubmit();
            }}
          />
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={isLoading || !question.trim()}
              className="btn-primary h-full px-5 justify-center"
              aria-label="Envoyer la question"
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
          <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-[10px] font-mono">
            Ctrl+Entrée
          </kbd>{' '}
          pour envoyer
        </p>

        {!response && !isLoading && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Exemples
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestedQuestions.map((q) => (
                <button
                  key={`suggested-${q.slice(0, 24)}`}
                  type="button"
                  onClick={() => setQuestion(q)}
                  className="text-xs px-3 py-1.5 bg-muted hover:bg-secondary border border-border rounded-full text-foreground transition-colors text-left"
                >
                  {q.length > 70 ? q.slice(0, 70) + '…' : q}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {isLoading && (
        <div className="card p-6 animate-pulse">
          <div className="h-4 bg-muted rounded w-1/3 mb-4" />
          <div className="space-y-2 mb-6">
            <div className="h-3 bg-muted rounded w-full" />
            <div className="h-3 bg-muted rounded w-5/6" />
            <div className="h-3 bg-muted rounded w-4/5" />
          </div>
          <p className="text-xs text-muted-foreground">
            Retrieval hybride puis génération contrainte et vérification des citations…
          </p>
        </div>
      )}

      {response && !isLoading && (
        <div className="flex gap-6 flex-col xl:flex-row">
          <div className="flex-1 min-w-0 flex flex-col gap-4">
            <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
                <Icon name="QuestionMarkCircleIcon" size={16} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground leading-relaxed">
                  {response.question}
                </p>
                <div className="flex flex-wrap gap-2 mt-2 text-[11px] text-muted-foreground font-mono-ref">
                  <span className="px-2 py-0.5 bg-muted rounded">
                    mode: {response.mode}
                  </span>
                  {response.generation && (
                    <span className="px-2 py-0.5 bg-muted rounded">
                      gen: {response.generation.engine}
                      {response.generation.model ? ` (${response.generation.model})` : ''}
                    </span>
                  )}
                  {response.retrieval && (
                    <span className="px-2 py-0.5 bg-muted rounded">
                      retrieval: {response.retrieval.backend} · {response.retrieval.hitCount} hit(s)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {response.mode === 'abstain' && (
              <div className="flex items-start gap-3 p-4 rounded-lg border border-slate-300 bg-slate-50">
                <Icon
                  name="ExclamationCircleIcon"
                  size={18}
                  className="text-slate-700 flex-shrink-0 mt-0.5"
                />
                <div>
                  <p className="text-sm font-semibold text-slate-900 mb-1">Mode hors réponse</p>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    Les sources sont insuffisantes pour une conclusion juridique. Les éléments
                    ci-dessous indiquent ce qui manque et les pistes utiles — aucune règle non
                    fondée n’est affirmée.
                  </p>
                </div>
              </div>
            )}

            <div
              className={`flex items-start gap-3 p-3 rounded-lg border ${
                response.riskLevel === 'high'
                  ? 'bg-red-50 border-red-200'
                  : response.riskLevel === 'medium'
                    ? 'bg-amber-50 border-amber-200'
                    : 'bg-green-50 border-green-200'
              }`}
            >
              <Icon
                name={
                  response.riskLevel === 'high'
                    ? 'ExclamationCircleIcon'
                    : response.riskLevel === 'medium'
                      ? 'ExclamationTriangleIcon'
                      : 'CheckCircleIcon'
                }
                size={16}
                className={`flex-shrink-0 mt-0.5 ${
                  response.riskLevel === 'high'
                    ? 'text-red-600'
                    : response.riskLevel === 'medium'
                      ? 'text-amber-600'
                      : 'text-green-600'
                }`}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <StatusBadge type="risk" value={response.riskLevel} size="sm" />
                  <span className="text-xs font-medium text-foreground">
                    Revue professionnelle recommandée
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{response.warningMessage}</p>
              </div>
            </div>

            {(response.warnings?.length ?? 0) > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <p className="font-semibold mb-1">Avertissements pipeline</p>
                <ul className="list-disc pl-5 space-y-0.5 text-xs">
                  {response.warnings!.map((w, i) => (
                    <li key={`w-${i}`}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            <QAResponseSection response={response} onCitationClick={setSelectedCitation} />

            {response.conflicts.length > 0 && (
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Icon name="ExclamationCircleIcon" size={16} className="text-purple-600" />
                  <h3 className="text-sm font-semibold text-foreground">Conflits détectés</h3>
                </div>
                <div className="space-y-2">
                  {response.conflicts.map((conflict, i) => (
                    <div
                      key={`conflict-${i}`}
                      className="flex items-start gap-2 p-3 bg-purple-50 rounded-lg"
                    >
                      <Icon
                        name="ArrowsRightLeftIcon"
                        size={14}
                        className="text-purple-600 flex-shrink-0 mt-0.5"
                      />
                      <p className="text-xs text-purple-800">{conflict}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {response.missingTexts.length > 0 && (
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Icon name="DocumentMinusIcon" size={16} className="text-amber-600" />
                  <h3 className="text-sm font-semibold text-foreground">
                    Textes manquants / à compléter
                  </h3>
                </div>
                <div className="space-y-2">
                  {response.missingTexts.map((text, i) => (
                    <div key={`missing-${i}`} className="flex items-center gap-2 p-2 bg-amber-50 rounded">
                      <Icon name="MinusCircleIcon" size={12} className="text-amber-500 flex-shrink-0" />
                      <p className="text-xs text-amber-700">{text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 flex-wrap">
              <button type="button" className="btn-secondary text-xs" disabled title="Sprint ultérieur">
                <Icon name="DocumentTextIcon" size={16} />
                Générer un document
              </button>
              <button type="button" className="btn-secondary text-xs" disabled title="Sprint ultérieur">
                <Icon name="FolderPlusIcon" size={16} />
                Ajouter au dossier
              </button>
            </div>
          </div>

          <div className="w-full xl:w-80 2xl:w-96 flex-shrink-0">
            <CitationPanel
              citations={response.citations}
              selectedCitation={selectedCitation}
              onSelect={setSelectedCitation}
              showAll={showAllCitations}
              onToggleShowAll={() => setShowAllCitations(!showAllCitations)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
