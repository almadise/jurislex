import React from 'react';
import AppLayout from '@/components/AppLayout';
import DocumentGenerationContent from './components/DocumentGenerationContent';

export default function DocumentGenerationPage() {
  return (
    <AppLayout
      breadcrumbs={[
        { label: 'JurisLex' },
        { label: 'Génération documentaire' },
      ]}
    >
      <DocumentGenerationContent />
    </AppLayout>
  );
}