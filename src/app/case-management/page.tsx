import React from 'react';
import AppLayout from '@/components/AppLayout';
import CaseManagementContent from './components/CaseManagementContent';

export default function CaseManagementPage() {
  return (
    <AppLayout
      breadcrumbs={[
        { label: 'juriLex' },
        { label: 'Gestion des dossiers' },
      ]}
    >
      <CaseManagementContent />
    </AppLayout>
  );
}