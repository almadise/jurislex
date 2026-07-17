'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import VersionComparison from './VersionComparison';
import ArticleChanges from './ArticleChanges';
import QuarantinePanel from './QuarantinePanel';

type Tab = 'versions' | 'changes' | 'quarantine';

export interface TextVersion {
  id: string;
  textReference: string;
  title: string;
  source: string;
  domain: string;
  versionNumber: number;
  versionLabel: string | null;
  contentHash: string;
  versionStatus: 'active' | 'superseded' | 'archived';
  ingestedAt: string;
  effectiveDate: string | null;
  supersededAt: string | null;
}

export interface ArticleChange {
  id: string;
  textReference: string;
  oldVersionId: string | null;
  newVersionId: string | null;
  articleNumber: string;
  articleTitle: string | null;
  changeType: 'addition' | 'modification' | 'deletion' | 'renumbering';
  oldContent: string | null;
  newContent: string | null;
  diffSummary: string | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detectedAt: string;
  isConfirmed: boolean;
}

export interface QuarantinedResponse {
  id: string;
  responseType: string;
  responseReference: string | null;
  originalQuery: string | null;
  originalResponse: string | null;
  affectedArticles: string[];
  affectedTextReferences: string[];
  quarantineReason: string | null;
  quarantineStatus: 'quarantined' | 'reviewed' | 'cleared' | 'invalidated';
  quarantinedAt: string;
  reviewedAt: string | null;
  reviewNotes: string | null;
}

export default function ObservatoireContent() {
  const { getUserProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('versions');
  const [userRole, setUserRole] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  const [versions, setVersions] = useState<TextVersion[]>([]);
  const [changes, setChanges] = useState<ArticleChange[]>([]);
  const [quarantined, setQuarantined] = useState<QuarantinedResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [stats, setStats] = useState({
    totalVersions: 0,
    activeTexts: 0,
    pendingChanges: 0,
    quarantinedCount: 0,
  });

  useEffect(() => {
    getUserProfile()
      .then((p: any) => {
        const role = p?.role ?? null;
        setUserRole(role);
        setIsAuthorized(['reviseur', 'reviewer', 'admin'].includes(role));
      })
      .catch(() => setIsAuthorized(false));
  }, [getUserProfile]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    const supabase = createClient();
    try {
      const [versionsRes, changesRes, quarantineRes] = await Promise.all([
        supabase
          .from('legal_text_versions')
          .select('*')
          .order('ingested_at', { ascending: false }),
        supabase
          .from('article_changes')
          .select('*')
          .order('detected_at', { ascending: false }),
        supabase
          .from('quarantined_responses')
          .select('*')
          .order('quarantined_at', { ascending: false }),
      ]);

      if (versionsRes.error) throw versionsRes.error;
      if (changesRes.error) throw changesRes.error;
      if (quarantineRes.error) throw quarantineRes.error;

      const mappedVersions: TextVersion[] = (versionsRes.data ?? []).map((v: any) => ({
        id: v.id,
        textReference: v.text_reference,
        title: v.title,
        source: v.source,
        domain: v.domain,
        versionNumber: v.version_number,
        versionLabel: v.version_label,
        contentHash: v.content_hash,
        versionStatus: v.version_status,
        ingestedAt: v.ingested_at,
        effectiveDate: v.effective_date,
        supersededAt: v.superseded_at,
      }));

      const mappedChanges: ArticleChange[] = (changesRes.data ?? []).map((c: any) => ({
        id: c.id,
        textReference: c.text_reference,
        oldVersionId: c.old_version_id,
        newVersionId: c.new_version_id,
        articleNumber: c.article_number,
        articleTitle: c.article_title,
        changeType: c.change_type,
        oldContent: c.old_content,
        newContent: c.new_content,
        diffSummary: c.diff_summary,
        severity: c.severity,
        detectedAt: c.detected_at,
        isConfirmed: c.is_confirmed,
      }));

      const mappedQuarantine: QuarantinedResponse[] = (quarantineRes.data ?? []).map((q: any) => ({
        id: q.id,
        responseType: q.response_type,
        responseReference: q.response_reference,
        originalQuery: q.original_query,
        originalResponse: q.original_response,
        affectedArticles: q.affected_articles ?? [],
        affectedTextReferences: q.affected_text_references ?? [],
        quarantineReason: q.quarantine_reason,
        quarantineStatus: q.quarantine_status,
        quarantinedAt: q.quarantined_at,
        reviewedAt: q.reviewed_at,
        reviewNotes: q.review_notes,
      }));

      setVersions(mappedVersions);
      setChanges(mappedChanges);
      setQuarantined(mappedQuarantine);

      const activeRefs = new Set(
        mappedVersions.filter((v) => v.versionStatus === 'active').map((v) => v.textReference)
      );
      setStats({
        totalVersions: mappedVersions.length,
        activeTexts: activeRefs.size,
        pendingChanges: mappedChanges.filter((c) => !c.isConfirmed).length,
        quarantinedCount: mappedQuarantine.filter((q) => q.quarantineStatus === 'quarantined').length,
      });
    } catch (err: any) {
      setError(err.message ?? 'Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthorized) fetchData();
  }, [isAuthorized, fetchData]);

  const tabs: { id: Tab; label: string; icon: string; count?: number }[] = [
    { id: 'versions', label: 'Versions de textes', icon: 'DocumentDuplicateIcon' },
    { id: 'changes', label: 'Articles modifiés', icon: 'ExclamationTriangleIcon', count: stats.pendingChanges },
    { id: 'quarantine', label: 'Quarantaine', icon: 'ShieldExclamationIcon', count: stats.quarantinedCount },
  ];

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
            L'Observatoire est accessible aux rôles <strong>Réviseur</strong> et <strong>Admin</strong> uniquement.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Observatoire des mises à jour</h1>
          <p className="text-sm text-foreground/60 mt-1">
            Surveillance des évolutions législatives, détection des modifications et gestion des réponses affectées
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Icon name="ArrowPathIcon" size={16} />
          Actualiser
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Versions ingérées', value: stats.totalVersions, icon: 'DocumentDuplicateIcon', color: 'bg-blue-50 text-blue-600' },
          { label: 'Textes actifs', value: stats.activeTexts, icon: 'DocumentCheckIcon', color: 'bg-green-50 text-green-600' },
          { label: 'Modifications en attente', value: stats.pendingChanges, icon: 'ExclamationTriangleIcon', color: 'bg-amber-50 text-amber-600' },
          { label: 'Réponses en quarantaine', value: stats.quarantinedCount, icon: 'ShieldExclamationIcon', color: 'bg-red-50 text-red-600' },
        ].map((stat) => (
          <div key={stat.label} className="bg-surface rounded-xl border border-border p-4 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${stat.color}`}>
              <Icon name={stat.icon as any} size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs text-foreground/60">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="flex border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3.5 text-sm font-medium transition-colors relative ${
                activeTab === tab.id
                  ? 'text-primary border-b-2 border-primary bg-primary/5' :'text-foreground/60 hover:text-foreground hover:bg-foreground/5'
              }`}
            >
              <Icon name={tab.icon as any} size={16} />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              <Icon name="ExclamationCircleIcon" size={18} />
              {error}
            </div>
          ) : (
            <>
              {activeTab === 'versions' && (
                <VersionComparison versions={versions} onRefresh={fetchData} />
              )}
              {activeTab === 'changes' && (
                <ArticleChanges changes={changes} versions={versions} onRefresh={fetchData} />
              )}
              {activeTab === 'quarantine' && (
                <QuarantinePanel quarantined={quarantined} onRefresh={fetchData} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
