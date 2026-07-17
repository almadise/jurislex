'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import StatusBadge from '@/components/ui/StatusBadge';
import QAResponseSection from './QAResponseSection';
import CitationPanel from './CitationPanel';

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
}

const mockResponse: QAResponse = {
  question: "Quelles sont les obligations d'un employeur en cas de licenciement économique au Cameroun ?",
  summary:
    "En droit camerounais du travail, le licenciement économique est soumis à des conditions de forme et de fond strictes. L'employeur doit respecter une procédure préalable impliquant une consultation des représentants du personnel, une déclaration à l'Inspection du travail, et le versement d'une indemnité de licenciement calculée selon l'ancienneté du salarié.",
  legalRule:
    "Selon l'article 40 du Code du Travail (Loi n° 92-007), le licenciement pour motif économique est autorisé lorsque l'entreprise fait face à des difficultés économiques sérieuses ou à des mutations technologiques nécessitant une réduction des effectifs. La procédure impose une consultation préalable des délégués du personnel et une notification à l'Inspection du travail quinze (15) jours avant toute décision.",
  application:
    "L'indemnité de licenciement est due dès lors que le salarié justifie d'au moins deux (2) ans d'ancienneté. Son calcul est basé sur le salaire moyen des douze (12) derniers mois : 20% du salaire mensuel par année d'ancienneté pour les 10 premières années, puis 25% au-delà. Le non-respect de la procédure rend le licenciement abusif, exposant l'employeur à des dommages-intérêts.",
  uncertainties: [
    "Le seuil de salariés à partir duquel la procédure collective s'applique n'est pas clairement défini dans le texte consulté.",
    "Les modalités de calcul de l'indemnité pour les contrats à durée déterminée non renouvelés pour motif économique restent ambiguës dans le corpus disponible.",
  ],
  conflicts: [
    "Le Décret n° 93-572 (source secondaire) mentionne un délai de préavis de 30 jours, en contradiction avec les 15 jours indiqués par l'article 40 du Code du Travail. La source officielle prévaut.",
  ],
  riskLevel: 'medium',
  warningMessage:
    "Cette analyse est fondée sur les textes indexés au 17/07/2026. Elle ne constitue pas un avis juridique. Les situations individuelles de licenciement économique impliquent des enjeux significatifs — une consultation avec un avocat spécialisé en droit social est recommandée avant toute décision.",
  citations: [
    {
      id: 'cit-001',
      reference: 'LOI-92-007-1992',
      article: 'Art. 40',
      title: 'Code du Travail du Cameroun',
      excerpt: "Le licenciement pour motif économique est autorisé lorsque l'entreprise fait face à des difficultés économiques sérieuses ou à des mutations technologiques...",
      page: 28,
      authority: 'République du Cameroun',
      legalStatus: 'verified',
      claimStatus: 'supported',
      domain: 'Droit du travail',
    },
    {
      id: 'cit-002',
      reference: 'LOI-92-007-1992',
      article: 'Art. 41',
      title: 'Code du Travail du Cameroun',
      excerpt: "L'indemnité de licenciement est due au travailleur licencié qui justifie d'une ancienneté d'au moins deux ans dans l'entreprise...",
      page: 29,
      authority: 'République du Cameroun',
      legalStatus: 'verified',
      claimStatus: 'supported',
      domain: 'Droit du travail',
    },
    {
      id: 'cit-003',
      reference: 'LOI-92-007-1992',
      article: 'Art. 42',
      title: 'Code du Travail du Cameroun',
      excerpt: "La procédure de licenciement collectif pour motif économique nécessite une consultation préalable des délégués du personnel...",
      page: 30,
      authority: 'République du Cameroun',
      legalStatus: 'verified',
      claimStatus: 'supported',
      domain: 'Droit du travail',
    },
    {
      id: 'cit-004',
      reference: 'DECRET-93-572',
      article: 'Art. 7',
      title: 'Décret n° 93-572 portant application du Code du Travail',
      excerpt: "La notification à l'Inspection du travail doit intervenir au moins trente jours avant la date prévue des licenciements...",
      page: 4,
      authority: 'République du Cameroun',
      legalStatus: 'probable',
      claimStatus: 'conflicting',
      domain: 'Droit du travail',
    },
    {
      id: 'cit-005',
      reference: 'LOI-92-007-1992',
      article: 'Art. 39',
      title: 'Code du Travail du Cameroun',
      excerpt: "Constitue un licenciement abusif, le licenciement effectué sans motif légitime ou sans respect de la procédure légale...",
      page: 27,
      authority: 'République du Cameroun',
      legalStatus: 'verified',
      claimStatus: 'inferred',
      domain: 'Droit du travail',
    },
    {
      id: 'cit-006',
      reference: 'CC-CMR-1981',
      article: 'Art. 1382',
      title: 'Code Civil camerounais',
      excerpt: "Tout fait quelconque de l'homme qui cause à autrui un dommage oblige celui par la faute duquel il est arrivé à le réparer...",
      page: 389,
      authority: 'République du Cameroun',
      legalStatus: 'probable',
      claimStatus: 'inferred',
      domain: 'Droit civil',
    },
  ],
  missingTexts: [
    "Convention collective applicable au secteur d'activité (non indexée dans le corpus actuel)",
    "Jurisprudence de la Cour d'Appel de Yaoundé sur les litiges de licenciement économique",
  ],
};

const suggestedQuestions = [
  "Quel est le délai de prescription pour une action en paiement d\'indemnité de licenciement ?",
  "Quelles sont les conditions de validité d\'un contrat de travail à durée déterminée en droit camerounais ?",
  "Comment calculer les intérêts de retard sur une créance commerciale selon l\'OHADA ?",
  "Quelles sont les formalités de création d'une SARL au Cameroun selon l'Acte uniforme ?",
];

export default function LegalQAContent() {
  const [question, setQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<QAResponse | null>(mockResponse);
  const [selectedCitation, setSelectedCitation] = useState<QACitation | null>(null);
  const [showAllCitations, setShowAllCitations] = useState(false);

  // Backend integration point: POST /api/qa with { question, domain_filter?, matter_id? }
  const handleSubmit = () => {
    if (!question.trim()) return;
    setIsLoading(true);
    setResponse(null);
    setTimeout(() => {
      setResponse(mockResponse);
      setIsLoading(false);
    }, 1200);
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
        {!response && (
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
        <div className="card p-6 animate-pulse">
          <div className="h-4 bg-muted rounded w-1/3 mb-4" />
          <div className="space-y-2 mb-6">
            <div className="h-3 bg-muted rounded w-full" />
            <div className="h-3 bg-muted rounded w-5/6" />
            <div className="h-3 bg-muted rounded w-4/5" />
          </div>
          <div className="h-4 bg-muted rounded w-1/4 mb-3" />
          <div className="space-y-2">
            <div className="h-3 bg-muted rounded w-full" />
            <div className="h-3 bg-muted rounded w-3/4" />
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
              <p className="text-sm font-medium text-foreground leading-relaxed">
                {response.question}
              </p>
            </div>

            {/* Risk banner */}
            <div className={`flex items-start gap-3 p-3 rounded-lg border ${
              response.riskLevel === 'high' ? 'bg-red-50 border-red-200' :
              response.riskLevel === 'medium'? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'
            }`}>
              <Icon
                name={response.riskLevel === 'high' ? 'ExclamationCircleIcon' : response.riskLevel === 'medium' ? 'ExclamationTriangleIcon' : 'CheckCircleIcon'}
                size={16}
                className={`flex-shrink-0 mt-0.5 ${
                  response.riskLevel === 'high' ? 'text-red-600' :
                  response.riskLevel === 'medium'? 'text-amber-600' : 'text-green-600'
                }`}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <StatusBadge type="risk" value={response.riskLevel} size="sm" />
                  <span className="text-xs font-medium text-foreground">Revue professionnelle recommandée</span>
                </div>
                <p className="text-xs text-muted-foreground">{response.warningMessage}</p>
              </div>
            </div>

            <QAResponseSection response={response} onCitationClick={setSelectedCitation} />

            {/* Conflicts */}
            {response.conflicts.length > 0 && (
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Icon name="ExclamationCircleIcon" size={16} className="text-purple-600" />
                  <h3 className="text-sm font-semibold text-foreground">Conflits détectés</h3>
                  <span className="ml-auto claim-badge-conflicting text-[11px] px-2 py-0.5 rounded-full font-medium">
                    {response.conflicts.length} conflit{response.conflicts.length > 1 ? 's' : ''}
                  </span>
                </div>
                <div className="space-y-2">
                  {response.conflicts.map((conflict, i) => (
                    <div key={`conflict-${i}`} className="flex items-start gap-2 p-3 bg-purple-50 rounded-lg">
                      <Icon name="ArrowsRightLeftIcon" size={14} className="text-purple-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-purple-800">{conflict}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Missing texts */}
            {response.missingTexts.length > 0 && (
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Icon name="DocumentMinusIcon" size={16} className="text-amber-600" />
                  <h3 className="text-sm font-semibold text-foreground">Textes manquants dans le corpus</h3>
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

            {/* Actions */}
            <div className="flex items-center gap-3 flex-wrap">
              <button className="btn-primary">
                <Icon name="DocumentTextIcon" size={16} />
                Générer un document
              </button>
              <button className="btn-secondary">
                <Icon name="FolderPlusIcon" size={16} />
                Ajouter au dossier
              </button>
              <button className="btn-secondary">
                <Icon name="ArrowDownTrayIcon" size={16} />
                Exporter la réponse
              </button>
              <button className="btn-ghost text-muted-foreground">
                <Icon name="FlagIcon" size={16} />
                Signaler une erreur
              </button>
            </div>
          </div>

          {/* Citation panel */}
          <div className="w-80 xl:w-96 flex-shrink-0">
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