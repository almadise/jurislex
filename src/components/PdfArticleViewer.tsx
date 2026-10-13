'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Icon from '@/components/ui/AppIcon';

interface PdfArticleViewerProps {
  /** URL du PDF (ex. /api/sources/file?path=…) */
  url: string;
  page?: number | null;
  pageEnd?: number | null;
  /** Texte à surligner (extrait article / label) */
  highlightText?: string | null;
  article?: string | null;
  className?: string;
  minHeight?: number;
}

/**
 * Lecteur PDF C2b : pdf.js + navigation multi-pages + highlight texte (text layer).
 */
export default function PdfArticleViewer({
  url,
  page = 1,
  pageEnd,
  highlightText,
  article,
  className = '',
  minHeight = 480,
}: PdfArticleViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const [pdfDoc, setPdfDoc] = useState<import('pdfjs-dist').PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(Math.max(1, page || 1));
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.15);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matchCount, setMatchCount] = useState(0);

  const endPage = pageEnd && pageEnd >= (page || 1) ? pageEnd : page || 1;

  useEffect(() => {
    setCurrentPage(Math.max(1, page || 1));
  }, [page, url]);

  useEffect(() => {
    let cancelled = false;
    let doc: import('pdfjs-dist').PDFDocumentProxy | null = null;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const pdfjs = await import('pdfjs-dist');
        // Worker CDN (évite config webpack complexe en Next)
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
        const loadingTask = pdfjs.getDocument({ url, withCredentials: true });
        doc = await loadingTask.promise;
        if (cancelled) {
          await doc.destroy();
          return;
        }
        setPdfDoc(doc);
        setNumPages(doc.numPages);
      } catch (e) {
        if (!cancelled) setError((e as Error).message || 'Chargement PDF impossible');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
      void doc?.destroy();
    };
  }, [url]);

  const renderPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current || !textLayerRef.current) return;
    const pageObj = await pdfDoc.getPage(currentPage);
    const viewport = pageObj.getViewport({ scale });
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.height = viewport.height;
    canvas.width = viewport.width;
    await pageObj.render({ canvasContext: ctx, viewport }).promise;

    // Text layer for highlight
    const textContent = await pageObj.getTextContent();
    const layer = textLayerRef.current;
    layer.innerHTML = '';
    layer.style.width = `${viewport.width}px`;
    layer.style.height = `${viewport.height}px`;

    const query = (highlightText || article || '').trim();
    const needles = buildNeedles(query);
    let matches = 0;

    for (const item of textContent.items) {
      if (!('str' in item) || !item.str) continue;
      const tx = item as {
        str: string;
        transform: number[];
        width?: number;
        height?: number;
      };
      const span = document.createElement('span');
      span.textContent = tx.str;
      span.style.position = 'absolute';
      span.style.whiteSpace = 'pre';
      span.style.color = 'transparent';
      span.style.transformOrigin = '0% 0%';

      // pdf.js text transform: [scaleX, skewY, skewX, scaleY, x, y]
      const [a, , , d, e, f] = tx.transform;
      const left = e * scale;
      const top = viewport.height - f * scale - Math.abs(d) * scale;
      const fontHeight = Math.abs(d) * scale;
      span.style.left = `${left}px`;
      span.style.top = `${top}px`;
      span.style.fontSize = `${fontHeight}px`;
      span.style.fontFamily = 'sans-serif';

      if (needles.some((n) => n && normalize(tx.str).includes(n))) {
        span.style.backgroundColor = 'rgba(250, 204, 21, 0.45)';
        span.style.boxShadow = '0 0 0 2px rgba(250, 204, 21, 0.35)';
        span.style.borderRadius = '2px';
        matches += 1;
      }
      layer.appendChild(span);
    }
    setMatchCount(matches);
  }, [pdfDoc, currentPage, scale, highlightText, article]);

  useEffect(() => {
    void renderPage();
  }, [renderPage]);

  const multiPage = endPage > (page || 1);

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-ghost p-1.5"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            aria-label="Page précédente"
          >
            <Icon name="ChevronLeftIcon" size={16} />
          </button>
          <span className="tabular-nums text-muted-foreground">
            p. {currentPage}
            {numPages ? ` / ${numPages}` : ''}
            {multiPage && (
              <span className="ml-1 text-primary">
                (article p.{page}–{endPage})
              </span>
            )}
          </span>
          <button
            type="button"
            className="btn-ghost p-1.5"
            disabled={numPages > 0 && currentPage >= numPages}
            onClick={() => setCurrentPage((p) => p + 1)}
            aria-label="Page suivante"
          >
            <Icon name="ChevronRightIcon" size={16} />
          </button>
          {multiPage && (
            <button
              type="button"
              className="btn-secondary text-[11px] py-1"
              onClick={() => setCurrentPage(Math.max(1, page || 1))}
            >
              Début article
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-ghost p-1.5"
            onClick={() => setScale((s) => Math.max(0.6, s - 0.15))}
            aria-label="Zoom −"
          >
            <Icon name="MinusIcon" size={14} />
          </button>
          <span className="tabular-nums w-10 text-center text-muted-foreground">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            className="btn-ghost p-1.5"
            onClick={() => setScale((s) => Math.min(2.5, s + 0.15))}
            aria-label="Zoom +"
          >
            <Icon name="PlusIcon" size={14} />
          </button>
          {(highlightText || article) && (
            <span className="text-muted-foreground">
              {matchCount > 0 ? (
                <span className="text-amber-700 font-medium">
                  {matchCount} surlignage(s)
                </span>
              ) : (
                'Recherche texte…'
              )}
            </span>
          )}
        </div>
      </div>

      <div
        className="relative overflow-auto rounded-lg border border-border bg-neutral-100"
        style={{ minHeight }}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground z-10 bg-background/60">
            Chargement du PDF…
          </div>
        )}
        {error && (
          <div className="p-4 text-sm text-destructive">
            {error}
            <p className="text-xs text-muted-foreground mt-2">
              Repli :{' '}
              <a href={url} target="_blank" rel="noopener noreferrer" className="underline">
                ouvrir le fichier
              </a>
            </p>
          </div>
        )}
        <div className="relative inline-block m-2 shadow-sm">
          <canvas ref={canvasRef} className="block max-w-full" />
          <div
            ref={textLayerRef}
            className="absolute left-0 top-0 pointer-events-none overflow-hidden"
            aria-hidden
          />
        </div>
      </div>
    </div>
  );
}

function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function buildNeedles(query: string): string[] {
  if (!query) return [];
  const n = normalize(query);
  const out = new Set<string>();
  // phrases courtes (label article)
  if (n.length <= 80) out.add(n);
  // tokens significatifs
  for (const t of n.split(/[^a-z0-9]+/)) {
    if (t.length >= 4) out.add(t);
  }
  // "article 74" variants
  const art = n.match(/art(?:icle)?\.?\s*(\d+[a-z]*)/i);
  if (art) {
    out.add(`article ${art[1]}`);
    out.add(`art.${art[1]}`);
    out.add(`art ${art[1]}`);
    out.add(art[1]);
  }
  return [...out].filter(Boolean);
}
