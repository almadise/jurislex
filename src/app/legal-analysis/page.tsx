import React from 'react';
import AppLayout from '@/components/AppLayout';
import LegalAnalysisContent from './components/LegalAnalysisContent';

export default function LegalAnalysisPage() {
  return (
    <AppLayout
      breadcrumbs={[
        { label: 'JurisLex' },
        { label: 'Analyse de situation' },
      ]}
    >
      <LegalAnalysisContent />
    </AppLayout>
  );
}