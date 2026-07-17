'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import { IngestionJob } from './IngestionPipelineContent';

interface Report {
  id: string;
  jobId: string;
  reportType: string;
  totalDocuments: number;
  successfulDocuments: number;
  failedDocuments: number;
  totalSegments: number;
  totalEmbeddings: number;
  totalIndexed: number;
  correctionsPending: number;
  correctionsDone: number;
  ocrConfidenceAvg: number | null;
  sha256Duplicates: number;
  processingTimeMs: number | null;
  stepSummary: any[];
  generatedAt: string;
}

interface Props {
  jobs: IngestionJob[];
}

export default function IngestionReport({ jobs }: Props) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from('ingestion_reports')
      .select('*')
      .order('generated_at', { ascending: false });

    if (!error && data) {
      const mapped: Report[] = data.map((r: any) => ({
        id: r.id,
        jobId: r.job_id,
        reportType: r.report_type,
        totalDocuments: r.total_documents,
        successfulDocuments: r.successful_documents,
        failedDocuments: r.failed_documents,
        totalSegments: r.total_segments,
        totalEmbeddings: r.total_embeddings,
        totalIndexed: r.total_indexed,
        correctionsPending: r.corrections_pending,
        correctionsDone: r.corrections_done,
        ocrConfidenceAvg: r.ocr_confidence_avg,
        sha256Duplicates: r.sha256_duplicates,
        processingTimeMs: r.processing_time_ms,
        stepSummary: r.step_summary ?? [],
        generatedAt: r.generated_at,
      }));
      setReports(mapped);
      if (mapped.length > 0) setSelectedReport(mapped[0]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const getJobTitle = (jobId: string) =>
    jobs.find(j => j.id === jobId)?.title ?? 'Job inconnu';

  const formatDuration = (ms: number | null) => {
    if (!ms) return '—';
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m`;
    if (m > 0) return `${m}m ${s % 60}s`;
    return `${s}s`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (reports.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-xl p-10 text-center">
        <Icon name="ChartBarIcon" size={36} className="text-foreground/15 mx-auto mb-3" />
        <p className="text-sm text-foreground/40">Aucun rapport disponible</p>
        <p className="text-xs text-foreground/30 mt-1">Les rapports sont générés automatiquement à la fin de chaque job</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Report list */}
      <div className="lg:col-span-1 space-y-2">
        <p className="text-xs font-semibold text-foreground/50 uppercase tracking-wider px-1">Rapports disponibles</p>
        {reports.map((r) => (
          <button
            key={r.id}
            onClick={() => setSelectedReport(r)}
            className={`w-full text-left bg-surface border rounded-xl p-3 transition-all hover:shadow-sm ${
              selectedReport?.id === r.id ? 'border-primary ring-1 ring-primary/20' : 'border-border'
            }`}
          >
            <p className="text-xs font-semibold text-foreground line-clamp-2">{getJobTitle(r.jobId)}</p>
            <p className="text-[10px] text-foreground/40 mt-1">
              {new Date(r.generatedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </p>
            <div className="flex items-center gap-1 mt-1.5">
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                r.failedDocuments === 0 ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'
              }`}>
                {r.failedDocuments === 0 ? '✓ Succès' : `${r.failedDocuments} erreurs`}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Report detail */}
      {selectedReport && (
        <div className="lg:col-span-3 space-y-5">
          <div className="bg-surface border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">{getJobTitle(selectedReport.jobId)}</h3>
                <p className="text-xs text-foreground/50 mt-0.5">
                  Rapport généré le {new Date(selectedReport.generatedAt).toLocaleString('fr-FR')}
                </p>
              </div>
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">
                {selectedReport.reportType === 'full' ? 'Rapport complet' : selectedReport.reportType}
              </span>
            </div>

            {/* KPIs */}
            <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Documents traités', value: `${selectedReport.successfulDocuments}/${selectedReport.totalDocuments}`, icon: 'DocumentTextIcon', color: 'text-blue-600 bg-blue-50' },
                { label: 'Segments créés', value: selectedReport.totalSegments, icon: 'ScissorsIcon', color: 'text-indigo-600 bg-indigo-50' },
                { label: 'Embeddings', value: selectedReport.totalEmbeddings, icon: 'CpuChipIcon', color: 'text-purple-600 bg-purple-50' },
                { label: 'Indexés', value: selectedReport.totalIndexed, icon: 'CircleStackIcon', color: 'text-green-600 bg-green-50' },
                { label: 'Confiance OCR', value: selectedReport.ocrConfidenceAvg ? `${selectedReport.ocrConfidenceAvg}%` : '—', icon: 'DocumentMagnifyingGlassIcon', color: 'text-amber-600 bg-amber-50' },
                { label: 'Doublons SHA-256', value: selectedReport.sha256Duplicates, icon: 'FingerPrintIcon', color: 'text-slate-600 bg-slate-100' },
                { label: 'Corrections', value: `${selectedReport.correctionsDone}/${selectedReport.correctionsPending + selectedReport.correctionsDone}`, icon: 'WrenchScrewdriverIcon', color: 'text-orange-600 bg-orange-50' },
                { label: 'Durée totale', value: formatDuration(selectedReport.processingTimeMs), icon: 'ClockIcon', color: 'text-teal-600 bg-teal-50' },
              ].map((kpi) => (
                <div key={kpi.label} className="flex items-center gap-3 bg-background rounded-xl p-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${kpi.color}`}>
                    <Icon name={kpi.icon as any} size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{kpi.value}</p>
                    <p className="text-[10px] text-foreground/40">{kpi.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Step summary */}
          {selectedReport.stepSummary.length > 0 && (
            <div className="bg-surface border border-border rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-border">
                <h4 className="text-sm font-semibold text-foreground">Résumé par étape</h4>
              </div>
              <div className="divide-y divide-border">
                {selectedReport.stepSummary.map((step: any, idx: number) => (
                  <div key={idx} className="px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        step.status === 'completed' ? 'bg-green-500' : step.status === 'failed' ? 'bg-red-500' : 'bg-slate-300'
                      }`} />
                      <span className="text-sm text-foreground capitalize">{step.step}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-foreground/50">
                      {step.items !== undefined && <span>{step.items} éléments</span>}
                      {step.segments !== undefined && <span>{step.segments} segments</span>}
                      {step.vectors !== undefined && <span>{step.vectors} vecteurs</span>}
                      {step.indexed !== undefined && <span>{step.indexed} indexés</span>}
                      {step.duplicates !== undefined && <span>{step.duplicates} doublons</span>}
                      {step.confidence !== undefined && <span>confiance {step.confidence}%</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
