'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import PipelineStepsPanel from './PipelineStepsPanel';
import CorrectionQueue from './CorrectionQueue';
import IngestionReport from './IngestionReport';
import NewJobModal from './NewJobModal';

type Tab = 'jobs' | 'corrections' | 'reports';

export interface IngestionJob {
  id: string;
  title: string;
  description: string | null;
  sourceType: string;
  domain: string;
  jurisdiction: string;
  jobStatus: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  totalDocuments: number;
  processedDocuments: number;
  failedDocuments: number;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface IngestionStep {
  id: string;
  jobId: string;
  stepNumber: number;
  stepName: string;
  stepKey: string;
  stepStatus: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  itemsTotal: number;
  itemsProcessed: number;
  itemsFailed: number;
  durationMs: number | null;
  errorDetails: string | null;
  outputSummary: Record<string, any>;
  startedAt: string | null;
  completedAt: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  pending:   { label: 'En attente',   color: 'text-slate-500',  bg: 'bg-slate-100',  icon: 'ClockIcon' },
  running:   { label: 'En cours',     color: 'text-blue-600',   bg: 'bg-blue-50',    icon: 'ArrowPathIcon' },
  paused:    { label: 'Suspendu',     color: 'text-amber-600',  bg: 'bg-amber-50',   icon: 'PauseIcon' },
  completed: { label: 'Terminé',      color: 'text-green-600',  bg: 'bg-green-50',   icon: 'CheckCircleIcon' },
  failed:    { label: 'Échoué',       color: 'text-red-600',    bg: 'bg-red-50',     icon: 'XCircleIcon' },
  cancelled: { label: 'Annulé',       color: 'text-slate-400',  bg: 'bg-slate-50',   icon: 'XMarkIcon' },
};

export default function IngestionPipelineContent() {
  const { getUserProfile } = useAuth();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('jobs');
  const [jobs, setJobs] = useState<IngestionJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<IngestionJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewJob, setShowNewJob] = useState(false);
  const [stats, setStats] = useState({ total: 0, running: 0, completed: 0, failed: 0, pendingCorrections: 0 });

  useEffect(() => {
    getUserProfile()
      .then((p: any) => setIsAuthorized(p?.role === 'admin'))
      .catch(() => setIsAuthorized(false));
  }, [getUserProfile]);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    try {
      const [jobsRes, corrRes] = await Promise.all([
        supabase.from('ingestion_jobs').select('*').order('created_at', { ascending: false }),
        supabase.from('correction_queue').select('id').eq('correction_status', 'pending'),
      ]);
      if (jobsRes.error) throw jobsRes.error;

      const mapped: IngestionJob[] = (jobsRes.data ?? []).map((j: any) => ({
        id: j.id,
        title: j.title,
        description: j.description,
        sourceType: j.source_type,
        domain: j.domain,
        jurisdiction: j.jurisdiction,
        jobStatus: j.job_status,
        totalDocuments: j.total_documents,
        processedDocuments: j.processed_documents,
        failedDocuments: j.failed_documents,
        startedAt: j.started_at,
        completedAt: j.completed_at,
        errorMessage: j.error_message,
        createdAt: j.created_at,
      }));

      setJobs(mapped);
      setStats({
        total: mapped.length,
        running: mapped.filter(j => j.jobStatus === 'running').length,
        completed: mapped.filter(j => j.jobStatus === 'completed').length,
        failed: mapped.filter(j => j.jobStatus === 'failed').length,
        pendingCorrections: corrRes.data?.length ?? 0,
      });
    } catch (err: any) {
      setError(err.message ?? 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthorized) fetchJobs();
  }, [isAuthorized, fetchJobs]);

  if (isAuthorized === null) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
          <Icon name="LockClosedIcon" size={28} className="text-red-500" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-foreground">Accès restreint</h2>
          <p className="text-sm text-foreground/60 mt-1">
            Le Pipeline d'ingestion est réservé aux <strong>Administrateurs</strong>.
          </p>
        </div>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: string; badge?: number }[] = [
    { id: 'jobs', label: 'Jobs d\'ingestion', icon: 'ServerStackIcon' },
    { id: 'corrections', label: 'File de correction', icon: 'WrenchScrewdriverIcon', badge: stats.pendingCorrections },
    { id: 'reports', label: 'Rapports', icon: 'ChartBarIcon' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pipeline d'ingestion</h1>
          <p className="text-sm text-foreground/60 mt-1">
            Orchestration des 13 étapes d'ingestion documentaire — découverte, OCR, segmentation, embedding, indexation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchJobs}
            className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm text-foreground/70 hover:bg-surface transition-colors"
          >
            <Icon name="ArrowPathIcon" size={15} />
            Actualiser
          </button>
          <button
            onClick={() => setShowNewJob(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Icon name="PlusIcon" size={15} />
            Nouveau job
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: 'Total jobs', value: stats.total, icon: 'ServerStackIcon', color: 'bg-slate-100 text-slate-600' },
          { label: 'En cours', value: stats.running, icon: 'ArrowPathIcon', color: 'bg-blue-50 text-blue-600' },
          { label: 'Terminés', value: stats.completed, icon: 'CheckCircleIcon', color: 'bg-green-50 text-green-600' },
          { label: 'Échoués', value: stats.failed, icon: 'XCircleIcon', color: 'bg-red-50 text-red-600' },
          { label: 'Corrections', value: stats.pendingCorrections, icon: 'WrenchScrewdriverIcon', color: 'bg-amber-50 text-amber-600' },
        ].map((s) => (
          <div key={s.label} className="bg-surface rounded-xl border border-border p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${s.color}`}>
              <Icon name={s.icon as any} size={18} />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{s.value}</p>
              <p className="text-[11px] text-foreground/50">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-primary text-primary' :'border-transparent text-foreground/60 hover:text-foreground'
            }`}
          >
            <Icon name={tab.icon as any} size={15} />
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span className="bg-accent text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'jobs' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Jobs list */}
          <div className="lg:col-span-2 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center h-40">
                <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : error ? (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-600">{error}</div>
            ) : jobs.length === 0 ? (
              <div className="bg-surface border border-border rounded-xl p-8 text-center">
                <Icon name="ServerStackIcon" size={32} className="text-foreground/20 mx-auto mb-3" />
                <p className="text-sm text-foreground/50">Aucun job d'ingestion</p>
              </div>
            ) : (
              jobs.map((job) => {
                const cfg = STATUS_CONFIG[job.jobStatus];
                const progress = job.totalDocuments > 0
                  ? Math.round((job.processedDocuments / job.totalDocuments) * 100)
                  : 0;
                return (
                  <button
                    key={job.id}
                    onClick={() => setSelectedJob(job)}
                    className={`w-full text-left bg-surface border rounded-xl p-4 transition-all hover:shadow-sm ${
                      selectedJob?.id === job.id ? 'border-primary ring-1 ring-primary/20' : 'border-border'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm font-semibold text-foreground line-clamp-2 flex-1">{job.title}</p>
                      <span className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${cfg.bg} ${cfg.color}`}>
                        <Icon name={cfg.icon as any} size={11} className={job.jobStatus === 'running' ? 'animate-spin' : ''} />
                        {cfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-foreground/50 mb-3">
                      <span>{job.domain}</span>
                      <span>·</span>
                      <span>{job.jurisdiction}</span>
                      <span>·</span>
                      <span>{job.totalDocuments} docs</span>
                    </div>
                    {(job.jobStatus === 'running' || job.jobStatus === 'completed') && (
                      <div>
                        <div className="flex justify-between text-[10px] text-foreground/40 mb-1">
                          <span>{job.processedDocuments}/{job.totalDocuments} traités</span>
                          <span>{progress}%</span>
                        </div>
                        <div className="h-1.5 bg-border rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${job.jobStatus === 'completed' ? 'bg-green-500' : 'bg-primary'}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Steps panel */}
          <div className="lg:col-span-3">
            {selectedJob ? (
              <PipelineStepsPanel job={selectedJob} />
            ) : (
              <div className="bg-surface border border-border rounded-xl p-8 flex flex-col items-center justify-center h-full min-h-[300px] text-center">
                <Icon name="CursorArrowRaysIcon" size={36} className="text-foreground/15 mb-3" />
                <p className="text-sm text-foreground/40">Sélectionnez un job pour voir les étapes du pipeline</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'corrections' && <CorrectionQueue onRefresh={fetchJobs} />}
      {activeTab === 'reports' && <IngestionReport jobs={jobs} />}

      {showNewJob && (
        <NewJobModal
          onClose={() => setShowNewJob(false)}
          onCreated={() => { setShowNewJob(false); fetchJobs(); }}
        />
      )}
    </div>
  );
}
