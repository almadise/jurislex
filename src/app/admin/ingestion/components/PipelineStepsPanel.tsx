'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { IngestionJob, IngestionStep } from './IngestionPipelineContent';

const STEP_ICONS: Record<string, string> = {
  discovery:    'MagnifyingGlassIcon',
  sha256:       'FingerPrintIcon',
  ocr:          'DocumentTextIcon',
  cleaning:     'SparklesIcon',
  segmentation: 'ScissorsIcon',
  structure:    'Squares2X2Icon',
  metadata:     'TagIcon',
  embedding:    'CpuChipIcon',
  vector_index: 'CircleStackIcon',
  fts_index:    'MagnifyingGlassCircleIcon',
  validation:   'ShieldCheckIcon',
  registry:     'BookOpenIcon',
  report:       'ChartBarIcon',
};

const STEP_STATUS_STYLE: Record<string, { ring: string; icon: string; bg: string; label: string }> = {
  pending:   { ring: 'border-border',   icon: 'text-foreground/30', bg: 'bg-surface',    label: 'En attente' },
  running:   { ring: 'border-blue-400', icon: 'text-blue-500',      bg: 'bg-blue-50',    label: 'En cours' },
  completed: { ring: 'border-green-400',icon: 'text-green-600',     bg: 'bg-green-50',   label: 'Terminé' },
  failed:    { ring: 'border-red-400',  icon: 'text-red-500',       bg: 'bg-red-50',     label: 'Échoué' },
  skipped:   { ring: 'border-slate-300',icon: 'text-slate-400',     bg: 'bg-slate-50',   label: 'Ignoré' },
};

interface Props {
  job: IngestionJob;
}

export default function PipelineStepsPanel({ job }: Props) {
  const [steps, setSteps] = useState<IngestionStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  const fetchSteps = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('ingestion_steps')
      .select('*')
      .eq('job_id', job.id)
      .order('step_number', { ascending: true });

    if (!error && data) {
      setSteps(data.map((s: any) => ({
        id: s.id,
        jobId: s.job_id,
        stepNumber: s.step_number,
        stepName: s.step_name,
        stepKey: s.step_key,
        stepStatus: s.step_status,
        itemsTotal: s.items_total,
        itemsProcessed: s.items_processed,
        itemsFailed: s.items_failed,
        durationMs: s.duration_ms,
        errorDetails: s.error_details,
        outputSummary: s.output_summary ?? {},
        startedAt: s.started_at,
        completedAt: s.completed_at,
      })));
    }
    setLoading(false);
  }, [job.id]);

  useEffect(() => { fetchSteps(); }, [fetchSteps]);

  const completedCount = steps.filter(s => s.stepStatus === 'completed').length;
  const overallProgress = steps.length > 0 ? Math.round((completedCount / steps.length) * 100) : 0;

  return (
    <div className="bg-surface border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-foreground truncate">{job.title}</h3>
            <p className="text-xs text-foreground/50 mt-0.5">{job.domain} · {job.jurisdiction}</p>
          </div>
          <button onClick={fetchSteps} className="text-foreground/40 hover:text-foreground transition-colors">
            <Icon name="ArrowPathIcon" size={14} />
          </button>
        </div>
        <div className="mt-3">
          <div className="flex justify-between text-[11px] text-foreground/50 mb-1.5">
            <span>{completedCount} / {steps.length} étapes</span>
            <span>{overallProgress}%</span>
          </div>
          <div className="h-2 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="divide-y divide-border max-h-[520px] overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : steps.length === 0 ? (
          <div className="p-6 text-center text-sm text-foreground/40">Aucune étape trouvée</div>
        ) : (
          steps.map((step) => {
            const style = STEP_STATUS_STYLE[step.stepStatus];
            const icon = STEP_ICONS[step.stepKey] ?? 'CogIcon';
            const isExpanded = expandedStep === step.id;
            const durationSec = step.durationMs ? (step.durationMs / 1000).toFixed(1) : null;

            return (
              <div key={step.id} className="px-4 py-3">
                <button
                  onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                  className="w-full flex items-center gap-3 text-left"
                >
                  {/* Step number + icon */}
                  <div className={`w-9 h-9 rounded-lg border-2 flex items-center justify-center flex-shrink-0 ${style.ring} ${style.bg}`}>
                    <Icon name={icon as any} size={16} className={style.icon} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-foreground/30 uppercase tracking-wider">
                        Étape {step.stepNumber}
                      </span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${style.bg} ${style.icon}`}>
                        {style.label}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-foreground truncate">{step.stepName}</p>
                  </div>

                  {/* Metrics */}
                  <div className="text-right flex-shrink-0">
                    {step.itemsTotal > 0 && (
                      <p className="text-xs font-semibold text-foreground">
                        {step.itemsProcessed}<span className="text-foreground/30">/{step.itemsTotal}</span>
                      </p>
                    )}
                    {durationSec && (
                      <p className="text-[10px] text-foreground/40">{durationSec}s</p>
                    )}
                  </div>

                  <Icon
                    name={isExpanded ? 'ChevronUpIcon' : 'ChevronDownIcon'}
                    size={14}
                    className="text-foreground/30 flex-shrink-0"
                  />
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="mt-3 ml-12 space-y-2">
                    {step.itemsTotal > 0 && (
                      <div className="h-1.5 bg-border rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${step.stepStatus === 'failed' ? 'bg-red-400' : 'bg-primary'}`}
                          style={{ width: `${Math.round((step.itemsProcessed / step.itemsTotal) * 100)}%` }}
                        />
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Total', value: step.itemsTotal },
                        { label: 'Traités', value: step.itemsProcessed },
                        { label: 'Erreurs', value: step.itemsFailed },
                      ].map((m) => (
                        <div key={m.label} className="bg-background rounded-lg p-2 text-center">
                          <p className="text-sm font-bold text-foreground">{m.value}</p>
                          <p className="text-[10px] text-foreground/40">{m.label}</p>
                        </div>
                      ))}
                    </div>
                    {step.errorDetails && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-2.5 text-xs text-red-600">
                        <strong>Erreur :</strong> {step.errorDetails}
                      </div>
                    )}
                    {Object.keys(step.outputSummary).length > 0 && (
                      <div className="bg-slate-50 rounded-lg p-2.5">
                        <p className="text-[10px] font-semibold text-foreground/50 uppercase tracking-wider mb-1">Résumé</p>
                        <pre className="text-[10px] text-foreground/60 whitespace-pre-wrap">
                          {JSON.stringify(step.outputSummary, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
