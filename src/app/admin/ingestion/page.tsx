'use client';

import React from 'react';
import AppLayout from '@/components/AppLayout';
import IngestionPipelineContent from './components/IngestionPipelineContent';

export default function IngestionPipelinePage() {
  return (
    <AppLayout
      title="Pipeline d'ingestion"
      breadcrumbs={[{ label: 'Administration' }, { label: "Pipeline d'ingestion" }]}
    >
      <IngestionPipelineContent />
    </AppLayout>
  );
}
