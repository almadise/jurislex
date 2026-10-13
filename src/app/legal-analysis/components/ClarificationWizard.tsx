'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';

interface ClarificationQuestion {
  id: string;
  question: string;
  impact: string;
  required: boolean;
  category?: string;
}

const categoryLabels: Record<string, string> = {
  qualification: 'Qualification',
  competence: 'Compétence',
  delai: 'Délai',
  preuve: 'Preuve',
  document: 'Document',
};

interface ClarificationWizardProps {
  questions: ClarificationQuestion[];
  factNarrative: string;
  onComplete: (answers: Record<string, string>) => void;
  onBack: () => void;
  isProcessing: boolean;
}

export default function ClarificationWizard({
  questions,
  factNarrative,
  onComplete,
  onBack,
  isProcessing,
}: ClarificationWizardProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [currentAnswer, setCurrentAnswer] = useState('');

  const currentQuestion = questions[currentIdx];
  const isLast = currentIdx === questions.length - 1;
  const progress = ((currentIdx) / questions.length) * 100;

  const handleNext = () => {
    const updated = { ...answers, [currentQuestion.id]: currentAnswer };
    setAnswers(updated);

    if (isLast) {
      onComplete(updated);
    } else {
      setCurrentAnswer(answers[questions[currentIdx + 1]?.id] || '');
      setCurrentIdx((prev) => prev + 1);
    }
  };

  const handleSkip = () => {
    const updated = { ...answers, [currentQuestion.id]: '' };
    setAnswers(updated);
    if (isLast) {
      onComplete(updated);
    } else {
      setCurrentAnswer(answers[questions[currentIdx + 1]?.id] || '');
      setCurrentIdx((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIdx === 0) {
      onBack();
    } else {
      setCurrentAnswer(answers[questions[currentIdx - 1]?.id] || '');
      setCurrentIdx((prev) => prev - 1);
    }
  };

  return (
    <div className="flex gap-6">
      <div className="flex-1 card p-6">
        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground">
              Question {currentIdx + 1} sur {questions.length}
            </span>
            <span className="text-xs text-muted-foreground">{Math.round(progress)}% complété</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question */}
        <div className="mb-6">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
              <Icon name="QuestionMarkCircleIcon" size={16} className="text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-base font-semibold text-foreground leading-snug">
                  {currentQuestion.question}
                </span>
                {currentQuestion.category && (
                  <span className="text-[11px] px-2 py-0.5 bg-primary/10 text-primary rounded-full font-medium flex-shrink-0">
                    {categoryLabels[currentQuestion.category] || currentQuestion.category}
                  </span>
                )}
                {!currentQuestion.required && (
                  <span className="text-[11px] px-2 py-0.5 bg-muted text-muted-foreground rounded-full font-medium flex-shrink-0">
                    Facultatif
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 p-2 bg-amber-50 rounded-lg">
                <Icon name="LightBulbIcon" size={12} className="text-amber-500 flex-shrink-0" />
                <p className="text-xs text-amber-700">
                  <span className="font-semibold">Impact :</span> {currentQuestion.impact}
                </p>
              </div>
            </div>
          </div>

          <textarea
            value={currentAnswer}
            onChange={(e) => setCurrentAnswer(e.target.value)}
            placeholder="Votre réponse..."
            className="input-field resize-none w-full"
            rows={5}
            aria-label={`Réponse à la question ${currentIdx + 1}`}
          />
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-3">
          <button onClick={handlePrev} className="btn-secondary">
            <Icon name="ArrowLeftIcon" size={16} />
            {currentIdx === 0 ? 'Retour' : 'Précédent'}
          </button>

          {!currentQuestion.required && (
            <button onClick={handleSkip} className="btn-ghost text-muted-foreground">
              Passer cette question
            </button>
          )}

          <button
            onClick={handleNext}
            disabled={isProcessing || (currentQuestion.required && !currentAnswer.trim())}
            className="btn-primary ml-auto min-w-[180px] justify-center"
          >
            {isProcessing ? (
              <>
                <Icon name="ArrowPathIcon" size={16} className="animate-spin" />
                Analyse en cours...
              </>
            ) : isLast ? (
              <>
                <Icon name="DocumentMagnifyingGlassIcon" size={16} />
                Lancer l'analyse
              </>
            ) : (
              <>
                Question suivante
                <Icon name="ArrowRightIcon" size={16} />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Sidebar: previous answers */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-4">
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Réponses précédentes</h3>
          {currentIdx === 0 ? (
            <p className="text-xs text-muted-foreground">Aucune réponse encore enregistrée.</p>
          ) : (
            <div className="space-y-3">
              {questions.slice(0, currentIdx).map((q, i) => (
                <div key={`prev-ans-${q.id}`} className="border-b border-border pb-3 last:border-0">
                  <p className="text-[11px] font-semibold text-muted-foreground mb-1">Q{i + 1}</p>
                  <p className="text-xs text-foreground line-clamp-2">{q.question}</p>
                  <p className="text-xs text-primary mt-1 italic">
                    {answers[q.id] ? `"${answers[q.id].slice(0, 80)}${answers[q.id].length > 80 ? '…' : ''}"` : 'Passé'}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Narrative recap */}
        <div className="card p-4 bg-muted/50">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-2">Situation décrite</p>
          <p className="text-xs text-foreground line-clamp-6 leading-relaxed">{factNarrative}</p>
        </div>
      </div>
    </div>
  );
}