'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';
import type { DocumentTemplate } from './DocumentGenerationContent';

interface TemplateSelectorProps {
  templates: DocumentTemplate[];
  onSelect: (template: DocumentTemplate) => void;
}

const reviewLevelConfig = {
  none: { label: 'Aucune revue requise', className: 'bg-green-100 text-green-700', icon: 'CheckCircleIcon' },
  recommended: { label: 'Revue recommandée', className: 'bg-amber-100 text-amber-700', icon: 'ExclamationTriangleIcon' },
  required: { label: 'Revue professionnelle obligatoire', className: 'bg-red-100 text-red-700', icon: 'ExclamationCircleIcon' },
};

export default function TemplateSelector({ templates, onSelect }: TemplateSelectorProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {templates.map((tpl) => {
          const reviewConfig = reviewLevelConfig[tpl.humanReviewLevel];
          return (
            <div
              key={tpl.id}
              onClick={() => onSelect(tpl)}
              className="card p-5 cursor-pointer hover:shadow-elevated hover:border-primary/30 transition-all duration-150 group flex flex-col gap-4"
              role="button"
              aria-label={`Sélectionner le modèle ${tpl.name}`}
            >
              {/* Icon + name */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
                  <Icon name={tpl.icon as Parameters<typeof Icon>[0]['name']} size={20} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-foreground">{tpl.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{tpl.domain}</p>
                </div>
              </div>

              {/* Description */}
              <p className="text-xs text-muted-foreground leading-relaxed flex-1">
                {tpl.description}
              </p>

              {/* Legal basis */}
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
                  Fondements juridiques
                </p>
                <div className="flex flex-wrap gap-1">
                  {tpl.legalBasis.map((basis) => (
                    <span
                      key={`basis-${tpl.id}-${basis.slice(0, 15)}`}
                      className="font-mono-ref text-[10px] px-2 py-0.5 bg-primary/5 text-primary rounded"
                    >
                      {basis}
                    </span>
                  ))}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3 border-t border-border">
                <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${reviewConfig.className}`}>
                  <Icon name={reviewConfig.icon as Parameters<typeof Icon>[0]['name']} size={11} />
                  {reviewConfig.label}
                </span>
                <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Icon name="ClockIcon" size={11} />
                  {tpl.estimatedTime}
                </span>
              </div>

              {/* CTA */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {tpl.requiredFields.length} champ{tpl.requiredFields.length > 1 ? 's' : ''} requis
                </span>
                <span className="text-xs font-medium text-primary group-hover:underline flex items-center gap-1">
                  Utiliser ce modèle
                  <Icon name="ArrowRightIcon" size={14} className="group-hover:translate-x-0.5 transition-transform" />
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <Icon name="InformationCircleIcon" size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-blue-700 mb-1">À propos de la génération documentaire</p>
          <p className="text-xs text-blue-600 leading-relaxed">
            Les documents générés constituent des projets à vérifier. JurisLex garantit l'absence de variables non résolues dans l'export.
            Les modèles marqués « revue professionnelle obligatoire » ne doivent pas être déposés sans validation par un avocat.
          </p>
        </div>
      </div>
    </div>
  );
}