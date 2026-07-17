'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import ReviewQueue from './ReviewQueue';
import AnnotationPanel from './AnnotationPanel';
import CorrectionLibrary from './CorrectionLibrary';


export type ReviewStatus = 'pending' | 'in_review' | 'approved' | 'rejected' | 'published';
export type ReviewItemType = 'qa_response' | 'analysis' | 'document';
export type AnnotationType = 'comment' | 'correction' | 'citation_error' | 'qualification_error' | 'validation';

export interface ReviewItem {
  id: string;
  reviewerId: string | null;
  submitterId: string | null;
  itemType: ReviewItemType;
  reviewStatus: ReviewStatus;
  title: string;
  originalContent: Record<string, any>;
  correctedContent: Record<string, any> | null;
  domain: string;
  priority: string;
  submittedAt: string;
  reviewedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
}

export interface ReviewAnnotation {
  id: string;
  reviewItemId: string;
  reviewerId: string;
  annotationType: AnnotationType;
  targetField: string;
  originalText: string;
  correctedText: string | null;
  comment: string;
  citationRef: string | null;
  isResolved: boolean;
  createdAt: string;
}

export interface ReviewCorrection {
  id: string;
  reviewerId: string;
  reviewItemId: string | null;
  domain: string;
  errorPattern: string;
  correctionRule: string;
  citationRef: string | null;
  isPublished: boolean;
  usageCount: number;
  createdAt: string;
}

type Tab = 'queue' | 'annotations' | 'corrections';

const ALLOWED_ROLES = ['reviseur', 'reviewer', 'admin'];

export default function ReviewerContent() {
  const { user, getUserProfile } = useAuth();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('queue');
  const [selectedItem, setSelectedItem] = useState<ReviewItem | null>(null);
  const [stats, setStats] = useState({ pending: 0, inReview: 0, approved: 0, published: 0 });
  const supabase = createClient();

  useEffect(() => {
    const loadRole = async () => {
      try {
        const profile = await getUserProfile();
        setUserRole(profile?.role ?? null);
      } catch {
        setUserRole(null);
      } finally {
        setRoleLoading(false);
      }
    };
    if (user) loadRole();
    else setRoleLoading(false);
  }, [user, getUserProfile]);

  const loadStats = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('review_items')
        .select('review_status');
      if (data) {
        setStats({
          pending: data.filter((r) => r.review_status === 'pending').length,
          inReview: data.filter((r) => r.review_status === 'in_review').length,
          approved: data.filter((r) => r.review_status === 'approved').length,
          published: data.filter((r) => r.review_status === 'published').length,
        });
      }
    } catch {
      // silent
    }
  }, [supabase]);

  useEffect(() => {
    if (userRole && ALLOWED_ROLES.includes(userRole)) {
      loadStats();
    }
  }, [userRole, loadStats]);

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center">
          <Icon name="LockClosedIcon" size={28} className="text-amber-600" />
        </div>
        <p className="text-foreground font-semibold text-lg">Connexion requise</p>
        <p className="text-muted text-sm">Veuillez vous connecter pour accéder à l'interface réviseur.</p>
      </div>
    );
  }

  if (!ALLOWED_ROLES.includes(userRole ?? '')) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
          <Icon name="ShieldExclamationIcon" size={28} className="text-red-600" />
        </div>
        <p className="text-foreground font-semibold text-lg">Accès restreint</p>
        <p className="text-muted text-sm text-center max-w-sm">
          Cette interface est réservée aux juristes réviseurs. Votre rôle actuel ({userRole ?? 'inconnu'}) ne vous donne pas accès à ce module.
        </p>
      </div>
    );
  }

  const tabs: { id: Tab; label: string; icon: string; count?: number }[] = [
    { id: 'queue', label: 'File de révision', icon: 'ClipboardDocumentListIcon', count: stats.pending + stats.inReview },
    { id: 'annotations', label: 'Annotations & Corrections', icon: 'PencilSquareIcon' },
    { id: 'corrections', label: 'Bibliothèque de corrections', icon: 'BookOpenIcon' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Interface Réviseur</h1>
          <p className="text-muted text-sm mt-1">
            Révision des réponses IA, correction des qualifications juridiques et validation documentaire
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold">
          <Icon name="ShieldCheckIcon" size={14} />
          Juriste Réviseur
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'En attente', value: stats.pending, color: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'ClockIcon' },
          { label: 'En révision', value: stats.inReview, color: 'bg-blue-50 text-blue-700 border-blue-200', icon: 'EyeIcon' },
          { label: 'Approuvés', value: stats.approved, color: 'bg-green-50 text-green-700 border-green-200', icon: 'CheckCircleIcon' },
          { label: 'Publiés', value: stats.published, color: 'bg-purple-50 text-purple-700 border-purple-200', icon: 'ArrowUpCircleIcon' },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border p-4 flex items-center gap-3 ${s.color}`}>
            <Icon name={s.icon as any} size={22} />
            <div>
              <p className="text-2xl font-bold leading-none">{s.value}</p>
              <p className="text-xs font-medium mt-0.5 opacity-80">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary' :'border-transparent text-muted hover:text-foreground hover:border-border'
              }`}
            >
              <Icon name={tab.icon as any} size={16} />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="bg-accent text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'queue' && (
        <ReviewQueue
          selectedItem={selectedItem}
          onSelectItem={setSelectedItem}
          onStatusChange={loadStats}
        />
      )}
      {activeTab === 'annotations' && (
        <AnnotationPanel selectedItem={selectedItem} onSelectItem={setSelectedItem} />
      )}
      {activeTab === 'corrections' && (
        <CorrectionLibrary />
      )}
    </div>
  );
}
