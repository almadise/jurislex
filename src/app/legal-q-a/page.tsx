import React from 'react';
import AppLayout from '@/components/AppLayout';
import LegalQAContent from './components/LegalQAContent';

export default function LegalQAPage() {
  return (
    <AppLayout
      breadcrumbs={[
        { label: 'JurisLex' },
        { label: 'Questions & Réponses juridiques' },
      ]}
    >
      <LegalQAContent />
    </AppLayout>
  );
}