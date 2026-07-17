'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';

export interface AbstentionNoticeProps {
  /** What is missing or insufficient */
  missingElements: string[];
  /** Explanation of why the system abstains */
  explanation: string;
  /** Optional professional referral message */
  referralMessage?: string;
  /** Module context label */
  moduleLabel?: string;
  /** Callback to reset / ask a new question */
  onReset?: () => void;
  resetLabel?: string;
}

/**
 * AbstentionNotice — displayed when JurisLex cannot provide a reliable answer
 * because the available legal corpus is insufficient for the question asked.
 *
 * Implements the "Mode Abstention" defined in Prompt_Codex_JurisLex_MVP:
 *  1. Explain what is missing
 *  2. Abstain from answering
 *  3. Propose a referral to a professional
 */
export default function AbstentionNotice({
  missingElements,
  explanation,
  referralMessage,
  moduleLabel,
  onReset,
  resetLabel = 'Poser une nouvelle question',
}: AbstentionNoticeProps) {
  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-300">
      {/* Header banner */}
      <div className="flex items-start gap-4 p-5 bg-amber-50 border border-amber-300 rounded-xl">
        <div className="w-10 h-10 bg-amber-100 border border-amber-300 rounded-xl flex items-center justify-center flex-shrink-0">
          <Icon name="HandRaisedIcon" size={20} className="text-amber-700" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold uppercase tracking-widest text-amber-700">
              Mode Abstention
            </span>
            {moduleLabel && (
              <span className="text-[10px] px-2 py-0.5 bg-amber-200 text-amber-800 rounded-full font-medium">
                {moduleLabel}
              </span>
            )}
          </div>
          <h3 className="text-sm font-semibold text-amber-900 mb-1">
            Sources insuffisantes — réponse non fournie
          </h3>
          <p className="text-xs text-amber-800 leading-relaxed">{explanation}</p>
        </div>
      </div>

      {/* Missing elements */}
      {missingElements.length > 0 && (
        <div className="card p-4 border-orange-200 bg-orange-50">
          <div className="flex items-center gap-2 mb-3">
            <Icon name="DocumentMinusIcon" size={16} className="text-orange-600" />
            <span className="text-sm font-semibold text-orange-800">
              Éléments manquants dans le corpus
            </span>
          </div>
          <ul className="space-y-1.5">
            {missingElements.map((item, i) => (
              <li key={`missing-${i}`} className="flex items-start gap-2">
                <Icon
                  name="MinusCircleIcon"
                  size={14}
                  className="text-orange-500 flex-shrink-0 mt-0.5"
                />
                <span className="text-xs text-orange-800 leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Professional referral */}
      <div className="flex items-start gap-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <Icon name="UserGroupIcon" size={16} className="text-blue-700" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-blue-800 mb-1">
            Consultation professionnelle recommandée
          </p>
          <p className="text-xs text-blue-700 leading-relaxed">
            {referralMessage ||
              'Pour cette question, nous vous recommandons de consulter un avocat inscrit au Barreau du Cameroun ou un juriste spécialisé. JurisLex ne peut pas fournir de réponse fiable sans les textes de référence nécessaires.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href="https://www.barreaucameroun.org"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg transition-colors font-medium"
            >
              <Icon name="BuildingLibraryIcon" size={12} />
              Barreau du Cameroun
            </a>
            <a
              href="https://www.ohada.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg transition-colors font-medium"
            >
              <Icon name="GlobeAltIcon" size={12} />
              OHADA.com
            </a>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="flex items-start gap-3 p-3 bg-muted/50 border border-border rounded-lg">
        <Icon name="ShieldExclamationIcon" size={14} className="text-muted-foreground flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          JurisLex s'abstient de répondre lorsque les sources disponibles dans le corpus indexé sont insuffisantes pour garantir une réponse fiable. Cette décision vise à éviter toute information juridique erronée ou incomplète.
        </p>
      </div>

      {/* Reset action */}
      {onReset && (
        <div className="flex justify-start">
          <button onClick={onReset} className="btn-secondary">
            <Icon name="ArrowUturnLeftIcon" size={16} />
            {resetLabel}
          </button>
        </div>
      )}
    </div>
  );
}
