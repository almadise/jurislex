'use client';

import { createClient } from '@/lib/supabase/client';
import type { Matter } from '@/app/case-management/components/CaseManagementContent';

// ─── helpers ────────────────────────────────────────────────────────────────

function isSchemaError(error: any): boolean {
  if (!error) return false;
  if (error.code && typeof error.code === 'string') {
    const cls = error.code.substring(0, 2);
    if (cls === '42') return true;
    if (cls === '23') return false;
    if (cls === '08') return true;
  }
  if (error.message) {
    const patterns = [
      /relation.*does not exist/i,
      /column.*does not exist/i,
      /function.*does not exist/i,
      /syntax error/i,
      /type.*does not exist/i,
    ];
    return patterns.some((p) => p.test(error.message));
  }
  return false;
}

function rowToMatter(row: any): Matter {
  return {
    id: row.id,
    reference: row.reference,
    title: row.title,
    domain: row.domain,
    parties: row.parties ?? [],
    status: row.matter_status as Matter['status'],
    analyses: row.analyses_count ?? 0,
    documents: row.documents_count ?? 0,
    lastActivity: row.last_activity_at
      ? new Date(row.last_activity_at).toLocaleDateString('fr-FR')
      : '',
    createdAt: row.created_at
      ? new Date(row.created_at).toLocaleDateString('fr-FR')
      : '',
    assignedTo: row.assigned_to ?? '',
    riskLevel: row.risk_level as Matter['riskLevel'],
    tags: row.tags ?? [],
  };
}

// ─── service ────────────────────────────────────────────────────────────────

export const caseService = {
  /** Fetch all cases for the authenticated lawyer */
  async getAll(): Promise<Matter[]> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    try {
      const { data, error } = await supabase
        .from('cases')
        .select('*')
        .eq('lawyer_id', user.id)
        .order('last_activity_at', { ascending: false });

      if (error) {
        if (isSchemaError(error)) throw error;
        console.warn('caseService.getAll error:', error.message);
        return [];
      }
      return (data ?? []).map(rowToMatter);
    } catch (err: any) {
      console.error('caseService.getAll fatal:', err.message);
      throw err;
    }
  },

  /** Create a new case */
  async create(payload: {
    title: string;
    domain: string;
    parties: string[];
    riskLevel: Matter['riskLevel'];
    tags: string[];
  }): Promise<Matter | null> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Generate reference: DOS-YYYY-XXXX
    const year = new Date().getFullYear();
    const seq = String(Math.floor(Math.random() * 9000) + 1000);
    const reference = `DOS-${year}-${seq}`;

    try {
      const { data, error } = await supabase
        .from('cases')
        .insert({
          lawyer_id: user.id,
          reference,
          title: payload.title,
          domain: payload.domain,
          parties: payload.parties,
          matter_status: 'draft',
          risk_level: payload.riskLevel,
          tags: payload.tags,
          assigned_to: user.email ?? '',
          analyses_count: 0,
          documents_count: 0,
        })
        .select()
        .single();

      if (error) {
        if (isSchemaError(error)) throw error;
        console.warn('caseService.create error:', error.message);
        return null;
      }

      // Insert creation timeline event
      await supabase.from('case_timeline_events').insert({
        case_id: data.id,
        lawyer_id: user.id,
        event_type: 'create',
        label: 'Dossier créé',
        user_name: user.email ?? '',
      });

      return rowToMatter(data);
    } catch (err: any) {
      console.error('caseService.create fatal:', err.message);
      throw err;
    }
  },

  /** Update case status (bulk or single) */
  async updateStatus(ids: string[], status: Matter['status']): Promise<void> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    try {
      const { error } = await supabase
        .from('cases')
        .update({ matter_status: status, last_activity_at: new Date().toISOString() })
        .in('id', ids)
        .eq('lawyer_id', user.id);

      if (error) {
        if (isSchemaError(error)) throw error;
        console.warn('caseService.updateStatus error:', error.message);
      }
    } catch (err: any) {
      console.error('caseService.updateStatus fatal:', err.message);
      throw err;
    }
  },

  /** Fetch timeline events for a case */
  async getTimeline(caseId: string) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    try {
      const { data, error } = await supabase
        .from('case_timeline_events')
        .select('*')
        .eq('case_id', caseId)
        .eq('lawyer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        if (isSchemaError(error)) throw error;
        return [];
      }
      return (data ?? []).map((row) => ({
        id: row.id,
        date: new Date(row.created_at).toLocaleDateString('fr-FR'),
        time: new Date(row.created_at).toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        type: row.event_type,
        label: row.label,
        user: row.user_name,
      }));
    } catch (err: any) {
      console.error('caseService.getTimeline fatal:', err.message);
      return [];
    }
  },

  /** Fetch parties for a case */
  async getParties(caseId: string) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    try {
      const { data, error } = await supabase
        .from('case_parties')
        .select('*')
        .eq('case_id', caseId);

      if (error) {
        if (isSchemaError(error)) throw error;
        return [];
      }
      return data ?? [];
    } catch {
      return [];
    }
  },

  /** Fetch evidence for a case */
  async getEvidence(caseId: string) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    try {
      const { data, error } = await supabase
        .from('case_evidence')
        .select('*')
        .eq('case_id', caseId);

      if (error) {
        if (isSchemaError(error)) throw error;
        return [];
      }
      return (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        status: row.evidence_status as 'available' | 'to_gather' | 'missing',
        notes: row.notes ?? '',
      }));
    } catch {
      return [];
    }
  },

  /** Fetch analyses for a case */
  async getAnalyses(caseId: string) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    try {
      const { data, error } = await supabase
        .from('case_analyses')
        .select('*')
        .eq('case_id', caseId)
        .eq('lawyer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        if (isSchemaError(error)) throw error;
        return [];
      }
      return (data ?? []).map((row) => ({
        id: row.id,
        title: row.title,
        date: new Date(row.created_at).toLocaleDateString('fr-FR'),
        confidence: row.confidence_score ?? 0,
        risk: row.risk_level as 'low' | 'medium' | 'high',
      }));
    } catch {
      return [];
    }
  },

  /** Fetch documents for a case */
  async getDocuments(caseId: string) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    try {
      const { data, error } = await supabase
        .from('case_documents')
        .select('*')
        .eq('case_id', caseId)
        .eq('lawyer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        if (isSchemaError(error)) throw error;
        return [];
      }
      return (data ?? []).map((row) => ({
        id: row.id,
        name: row.name,
        type: row.file_type ?? 'docx',
        size: row.file_size ?? '',
        date: new Date(row.created_at).toLocaleDateString('fr-FR'),
      }));
    } catch {
      return [];
    }
  },

  /** Fetch audit log for a case */
  async getAuditLog(caseId: string) {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return [];

    try {
      const { data, error } = await supabase
        .from('audit_events')
        .select('*')
        .eq('case_id', caseId)
        .eq('lawyer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        if (isSchemaError(error)) throw error;
        return [];
      }
      return (data ?? []).map((row) => ({
        id: row.id,
        action: row.action as string,
        entityType: row.entity_type ?? 'case',
        label: row.label,
        details: (row.details as Record<string, any>) ?? {},
        userName: row.user_name ?? '',
        userEmail: row.user_email ?? '',
        createdAt: new Date(row.created_at).toLocaleDateString('fr-FR'),
        createdTime: new Date(row.created_at).toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      }));
    } catch {
      return [];
    }
  },

  /** Log an audit event for a case */
  async logAuditEvent(params: {
    caseId: string;
    action: string;
    entityType?: string;
    entityId?: string;
    label: string;
    details?: Record<string, any>;
  }): Promise<void> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    try {
      await supabase.from('audit_events').insert({
        case_id: params.caseId,
        lawyer_id: user.id,
        action: params.action,
        entity_type: params.entityType ?? 'case',
        entity_id: params.entityId ?? null,
        label: params.label,
        details: params.details ?? {},
        user_name: user.user_metadata?.full_name ?? '',
        user_email: user.email ?? '',
      });
    } catch {
      // Non-blocking: audit failures should not break the main flow
    }
  },

  /** Delete a case and all its related data */
  async deleteCase(caseId: string): Promise<void> {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    // Log the deletion before deleting (cascade will remove audit_events too)
    try {
      await supabase.from('audit_events').insert({
        case_id: caseId,
        lawyer_id: user.id,
        action: 'delete',
        entity_type: 'case',
        label: 'Dossier supprimé définitivement',
        details: { deleted_by: user.email ?? '' },
        user_name: user.user_metadata?.full_name ?? '',
        user_email: user.email ?? '',
      });
    } catch {
      // Non-blocking
    }

    const { error } = await supabase
      .from('cases')
      .delete()
      .eq('id', caseId)
      .eq('lawyer_id', user.id);

    if (error) {
      if (isSchemaError(error)) throw error;
      throw new Error(error.message);
    }
  },
};
