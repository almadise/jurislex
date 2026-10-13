'use client';

import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import Icon from '@/components/ui/AppIcon';

const PdfArticleViewer = dynamic(() => import('@/components/PdfArticleViewer'), {
  ssr: false,
  loading: () => (
    <div className="rounded-lg border border-border p-8 text-center text-sm text-muted-foreground min-h-[420px] flex items-center justify-center">
      Chargement du lecteur PDF…
    </div>
  ),
});

interface SourceReaderProps {
  sourcePath: string | null | undefined;
  page?: number | null;
  pageEnd?: number | null;
  article?: string | null;
  title?: string | null;
  excerpt?: string | null;
  className?: string;
}

/**
 * Lecteur de source C2b : pdf.js + highlight article + multi-pages.
 */
export default function SourceReader({
  sourcePath,
  page,
  pageEnd,
  article,
  title,
  excerpt,
  className = '',
}: SourceReaderProps) {
  const pdfUrl = useMemo(() => {
    if (!sourcePath) return null;
    const q = new URLSearchParams({ path: sourcePath.replace(/\\/g, '/') });
    return `/api/sources/file?${q.toString()}`;
  }, [sourcePath]);

  if (!sourcePath) {
    return (
      <div
        className={`rounded-lg border border-border bg-muted/40 p-4 text-xs text-muted-foreground ${className}`}
      >
        Chemin source indisponible pour cette disposition.
      </div>
    );
  }

  const isPdf = sourcePath.toLowerCase().endsWith('.pdf');
  const isMd = sourcePath.toLowerCase().endsWith('.md');

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          {title && <p className="text-sm font-semibold text-foreground truncate">{title}</p>}
          <p className="font-mono-ref text-[11px] text-muted-foreground break-all">{sourcePath}</p>
          <div className="flex gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
            {article && (
              <span className="font-mono-ref text-primary bg-primary/10 px-2 py-0.5 rounded">
                {article}
              </span>
            )}
            {page != null && page > 0 && (
              <span>
                page {page}
                {pageEnd != null && pageEnd > page ? `–${pageEnd}` : ''}
              </span>
            )}
          </div>
        </div>
        {pdfUrl && (
          <a
            href={page && page > 0 ? `${pdfUrl}#page=${page}` : pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary text-xs flex-shrink-0"
          >
            <Icon name="ArrowTopRightOnSquareIcon" size={14} />
            Ouvrir le fichier
          </a>
        )}
      </div>

      {excerpt && (
        <div className="rounded-lg bg-amber-50 border border-amber-200/80 p-3">
          <p className="text-[10px] font-semibold uppercase text-amber-800/80 mb-1">
            Extrait indexé {article ? `(${article})` : ''} — surligné dans le PDF si couche texte
          </p>
          <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{excerpt}</p>
        </div>
      )}

      {pdfUrl && isPdf && (
        <PdfArticleViewer
          url={pdfUrl}
          page={page}
          pageEnd={pageEnd}
          highlightText={excerpt || article}
          article={article}
        />
      )}

      {pdfUrl && isMd && (
        <div className="rounded-lg border border-border p-3 text-xs text-muted-foreground">
          Source Markdown —{' '}
          <a href={pdfUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline">
            ouvrir le texte
          </a>
          {excerpt && (
            <pre className="mt-2 whitespace-pre-wrap text-foreground font-sans text-xs max-h-64 overflow-auto">
              {excerpt}
            </pre>
          )}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground">
        Lecteur pdf.js (C2b) : navigation multi-pages, zoom, surlignage de l&apos;extrait / n° d&apos;article
        lorsque la couche texte est disponible. Les scans sans OCR restent visualisables page par page.
      </p>
    </div>
  );
}
