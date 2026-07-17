'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import type { Matter } from './CaseManagementContent';

// ─── Types ──────────────────────────────────────────────────────────────────

type NodeType = 'dossier' | 'partie' | 'fait' | 'preuve' | 'question' | 'article';

interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  sublabel?: string;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
}

interface GraphEdge {
  source: string;
  target: string;
  label?: string;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ─── Config ──────────────────────────────────────────────────────────────────

const NODE_CONFIG: Record<NodeType, { color: string; border: string; textColor: string; icon: string; radius: number }> = {
  dossier:  { color: '#ede9fe', border: '#7c3aed', textColor: '#5b21b6', icon: '📁', radius: 36 },
  partie:   { color: '#dbeafe', border: '#2563eb', textColor: '#1d4ed8', icon: '👤', radius: 28 },
  fait:     { color: '#fef3c7', border: '#d97706', textColor: '#92400e', icon: '📋', radius: 26 },
  preuve:   { color: '#dcfce7', border: '#16a34a', textColor: '#166534', icon: '🔍', radius: 26 },
  question: { color: '#fce7f3', border: '#db2777', textColor: '#9d174d', icon: '⚖️', radius: 28 },
  article:  { color: '#e0f2fe', border: '#0284c7', textColor: '#075985', icon: '📜', radius: 26 },
};

const NODE_TYPE_LABELS: Record<NodeType, string> = {
  dossier:  'Dossier',
  partie:   'Partie',
  fait:     'Fait',
  preuve:   'Preuve',
  question: 'Question juridique',
  article:  'Article applicable',
};

// ─── Build graph from matter ─────────────────────────────────────────────────

function buildGraphData(matter: Matter): GraphData {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  const cx = 400;
  const cy = 280;

  // Central dossier node
  nodes.push({
    id: 'dossier',
    type: 'dossier',
    label: matter.reference,
    sublabel: matter.title.length > 22 ? matter.title.slice(0, 22) + '…' : matter.title,
    x: cx,
    y: cy,
  });

  // Parties — top arc
  const partiesCount = matter.parties.length;
  matter.parties.forEach((p, i) => {
    const angle = -Math.PI / 2 + (partiesCount > 1 ? ((i / (partiesCount - 1)) - 0.5) * Math.PI * 0.8 : 0);
    const r = 170;
    const id = `partie-${i}`;
    nodes.push({
      id,
      type: 'partie',
      label: p.length > 18 ? p.slice(0, 18) + '…' : p,
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    });
    edges.push({ source: 'dossier', target: id, label: 'implique' });
  });

  // Facts — left side
  const facts = [
    'Faits établis',
    'Chronologie',
    'Contexte',
  ];
  facts.forEach((f, i) => {
    const angle = Math.PI * 0.6 + i * 0.45;
    const r = 175;
    const id = `fait-${i}`;
    nodes.push({
      id,
      type: 'fait',
      label: f,
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    });
    edges.push({ source: 'dossier', target: id, label: 'repose sur' });
  });

  // Evidence — bottom-right
  const evidenceItems = [
    'Pièces disponibles',
    'Preuves à rassembler',
    'Documents clés',
  ];
  evidenceItems.forEach((e, i) => {
    const angle = -0.3 + i * 0.5;
    const r = 175;
    const id = `preuve-${i}`;
    nodes.push({
      id,
      type: 'preuve',
      label: e,
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    });
    edges.push({ source: 'dossier', target: id, label: 'étayé par' });
    // Link evidence to facts
    if (i < facts.length) {
      edges.push({ source: id, target: `fait-${i}`, label: 'supporte' });
    }
  });

  // Legal questions — bottom-left
  const questions = [
    `Qualification ${matter.domain.split(' ')[1] ?? 'juridique'}`,
    'Responsabilité',
    'Recours possibles',
  ];
  questions.forEach((q, i) => {
    const angle = Math.PI + 0.2 - i * 0.45;
    const r = 175;
    const id = `question-${i}`;
    nodes.push({
      id,
      type: 'question',
      label: q,
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    });
    edges.push({ source: 'dossier', target: id, label: 'soulève' });
  });

  // Articles — right side
  const domainArticles: Record<string, string[]> = {
    'OHADA': ['AUDCG Art. 1', 'AUDCG Art. 15', 'OHADA Traité'],
    'travail': ['CT Art. 28', 'CT Art. 66', 'CT Art. 92'],
    'civil': ['CC Art. 1382', 'CC Art. 1147', 'CC Art. 544'],
    'sociétés': ['AUSC Art. 5', 'AUSC Art. 12', 'AUSC Art. 200'],
    'foncier': ['CF Art. 1', 'CF Art. 17', 'CF Art. 45'],
    'bancaire': ['COBAC R-2014', 'COBAC R-2019', 'COBAC R-2021'],
  };
  const domainKey = Object.keys(domainArticles).find(k => matter.domain.toLowerCase().includes(k)) ?? 'civil';
  const articleList = domainArticles[domainKey];

  articleList.forEach((a, i) => {
    const angle = -Math.PI / 2 + 0.6 + i * 0.55;
    const r = 195;
    const id = `article-${i}`;
    nodes.push({
      id,
      type: 'article',
      label: a,
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    });
    edges.push({ source: `question-${i % questions.length}`, target: id, label: 'fondé sur' });
  });

  return { nodes, edges };
}

// ─── Component ───────────────────────────────────────────────────────────────

interface CaseDossierGraphProps {
  matter: Matter;
}

export default function CaseDossierGraph({ matter }: CaseDossierGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [graphData, setGraphData] = useState<GraphData>(() => buildGraphData(matter));
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, w: 800, h: 560 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef<{ mx: number; my: number; vx: number; vy: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [activeFilter, setActiveFilter] = useState<NodeType | 'all'>('all');

  useEffect(() => {
    setGraphData(buildGraphData(matter));
    setSelectedNode(null);
  }, [matter.id]);

  // ── Drag node ──
  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    const svg = svgRef.current;
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    const node = graphData.nodes.find(n => n.id === nodeId);
    if (!node) return;
    setDragging({ id: nodeId, offsetX: svgP.x - node.x, offsetY: svgP.y - node.y });
  }, [graphData.nodes]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const svg = svgRef.current;
    if (!svg) return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM()!.inverse());

    if (dragging) {
      setGraphData(prev => ({
        ...prev,
        nodes: prev.nodes.map(n =>
          n.id === dragging.id
            ? { ...n, x: svgP.x - dragging.offsetX, y: svgP.y - dragging.offsetY }
            : n
        ),
      }));
    } else if (isPanning && panStart.current) {
      const dx = (e.clientX - panStart.current.mx) / zoom;
      const dy = (e.clientY - panStart.current.my) / zoom;
      setViewBox(v => ({ ...v, x: panStart.current!.vx - dx, y: panStart.current!.vy - dy }));
    }
  }, [dragging, isPanning, zoom]);

  const handleMouseUp = useCallback(() => {
    setDragging(null);
    setIsPanning(false);
    panStart.current = null;
  }, []);

  const handleSvgMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === svgRef.current || (e.target as SVGElement).tagName === 'rect') {
      setIsPanning(true);
      panStart.current = { mx: e.clientX, my: e.clientY, vx: viewBox.x, vy: viewBox.y };
    }
  }, [viewBox]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.1 : 0.9;
    const newZoom = Math.min(3, Math.max(0.4, zoom * factor));
    const newW = 800 / newZoom;
    const newH = 560 / newZoom;
    setZoom(newZoom);
    setViewBox(v => ({
      x: v.x + (v.w - newW) / 2,
      y: v.y + (v.h - newH) / 2,
      w: newW,
      h: newH,
    }));
  }, [zoom]);

  const resetView = () => {
    setViewBox({ x: 0, y: 0, w: 800, h: 560 });
    setZoom(1);
  };

  const visibleNodes = activeFilter === 'all'
    ? graphData.nodes
    : graphData.nodes.filter(n => n.type === activeFilter || n.type === 'dossier');

  const visibleNodeIds = new Set(visibleNodes.map(n => n.id));
  const visibleEdges = graphData.edges.filter(
    e => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target)
  );

  const getNodeById = (id: string) => graphData.nodes.find(n => n.id === id);

  const isConnectedToSelected = (nodeId: string) => {
    if (!selectedNode) return false;
    return graphData.edges.some(
      e => (e.source === selectedNode.id && e.target === nodeId) ||
           (e.target === selectedNode.id && e.source === nodeId)
    );
  };

  const filterButtons: { type: NodeType | 'all'; label: string }[] = [
    { type: 'all', label: 'Tout' },
    { type: 'partie', label: 'Parties' },
    { type: 'fait', label: 'Faits' },
    { type: 'preuve', label: 'Preuves' },
    { type: 'question', label: 'Questions' },
    { type: 'article', label: 'Articles' },
  ];

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1 flex-wrap">
          {filterButtons.map(fb => (
            <button
              key={fb.type}
              onClick={() => setActiveFilter(fb.type)}
              className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors ${
                activeFilter === fb.type
                  ? 'bg-primary text-white' :'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              {fb.type !== 'all' && (
                <span
                  className="inline-block w-2 h-2 rounded-full mr-1"
                  style={{ backgroundColor: NODE_CONFIG[fb.type as NodeType]?.border }}
                />
              )}
              {fb.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              const factor = 1.2;
              const newZoom = Math.min(3, zoom * factor);
              const newW = 800 / newZoom;
              const newH = 560 / newZoom;
              setZoom(newZoom);
              setViewBox(v => ({ x: v.x + (v.w - newW) / 2, y: v.y + (v.h - newH) / 2, w: newW, h: newH }));
            }}
            className="btn-ghost p-1.5" title="Zoom avant"
          >
            <Icon name="MagnifyingGlassPlusIcon" size={14} />
          </button>
          <button
            onClick={() => {
              const factor = 0.8;
              const newZoom = Math.max(0.4, zoom * factor);
              const newW = 800 / newZoom;
              const newH = 560 / newZoom;
              setZoom(newZoom);
              setViewBox(v => ({ x: v.x + (v.w - newW) / 2, y: v.y + (v.h - newH) / 2, w: newW, h: newH }));
            }}
            className="btn-ghost p-1.5" title="Zoom arrière"
          >
            <Icon name="MagnifyingGlassMinusIcon" size={14} />
          </button>
          <button onClick={resetView} className="btn-ghost p-1.5" title="Réinitialiser la vue">
            <Icon name="ArrowsPointingOutIcon" size={14} />
          </button>
        </div>
      </div>

      {/* SVG Graph */}
      <div className="relative flex-1 bg-muted/30 rounded-xl border border-border overflow-hidden" style={{ minHeight: 380 }}>
        <svg
          ref={svgRef}
          className="w-full h-full"
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onMouseDown={handleSvgMouseDown}
          onWheel={handleWheel}
          style={{ cursor: isPanning ? 'grabbing' : dragging ? 'grabbing' : 'grab', userSelect: 'none' }}
        >
          <defs>
            <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="#94a3b8" />
            </marker>
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.12" />
            </filter>
          </defs>

          {/* Background grid */}
          <rect x={viewBox.x - 100} y={viewBox.y - 100} width={viewBox.w + 200} height={viewBox.h + 200} fill="transparent" />

          {/* Edges */}
          {visibleEdges.map((edge, i) => {
            const src = getNodeById(edge.source);
            const tgt = getNodeById(edge.target);
            if (!src || !tgt) return null;
            const dx = tgt.x - src.x;
            const dy = tgt.y - src.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist === 0) return null;
            const srcR = NODE_CONFIG[src.type].radius;
            const tgtR = NODE_CONFIG[tgt.type].radius + 8;
            const x1 = src.x + (dx / dist) * srcR;
            const y1 = src.y + (dy / dist) * srcR;
            const x2 = tgt.x - (dx / dist) * tgtR;
            const y2 = tgt.y - (dy / dist) * tgtR;
            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2;

            const isHighlighted = selectedNode &&
              (edge.source === selectedNode.id || edge.target === selectedNode.id);
            const isConnected = selectedNode && isHighlighted;

            return (
              <g key={`edge-${i}`}>
                <line
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={isConnected ? '#7c3aed' : '#cbd5e1'}
                  strokeWidth={isConnected ? 2 : 1.5}
                  strokeDasharray={isConnected ? undefined : '4 3'}
                  markerEnd="url(#arrow)"
                  opacity={selectedNode && !isConnected ? 0.25 : 1}
                />
                {edge.label && (
                  <text
                    x={mx} y={my - 4}
                    textAnchor="middle"
                    fontSize="8"
                    fill={isConnected ? '#7c3aed' : '#94a3b8'}
                    opacity={selectedNode && !isConnected ? 0.25 : 1}
                    style={{ pointerEvents: 'none' }}
                  >
                    {edge.label}
                  </text>
                )}
              </g>
            );
          })}

          {/* Nodes */}
          {visibleNodes.map((node) => {
            const cfg = NODE_CONFIG[node.type];
            const isSelected = selectedNode?.id === node.id;
            const isHovered = hoveredNode === node.id;
            const isConnected = isConnectedToSelected(node.id);
            const isDimmed = selectedNode && !isSelected && !isConnected;
            const r = cfg.radius;

            return (
              <g
                key={node.id}
                transform={`translate(${node.x},${node.y})`}
                style={{ cursor: 'pointer' }}
                onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedNode(prev => prev?.id === node.id ? null : node);
                }}
                opacity={isDimmed ? 0.3 : 1}
                filter={isSelected || isHovered ? 'url(#shadow)' : undefined}
              >
                {/* Outer ring for selected */}
                {isSelected && (
                  <circle r={r + 6} fill="none" stroke={cfg.border} strokeWidth={2} strokeDasharray="4 2" opacity={0.7} />
                )}
                {/* Main circle */}
                <circle
                  r={r}
                  fill={cfg.color}
                  stroke={cfg.border}
                  strokeWidth={isSelected ? 2.5 : isHovered ? 2 : 1.5}
                />
                {/* Icon text */}
                <text
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={node.type === 'dossier' ? 18 : 14}
                  y={node.sublabel ? -8 : 0}
                  style={{ pointerEvents: 'none' }}
                >
                  {cfg.icon}
                </text>
                {/* Label */}
                <text
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={node.type === 'dossier' ? 9 : 8}
                  fontWeight={node.type === 'dossier' ? '700' : '600'}
                  fill={cfg.textColor}
                  y={node.type === 'dossier' ? 12 : (node.sublabel ? 8 : 14)}
                  style={{ pointerEvents: 'none' }}
                >
                  {node.label}
                </text>
                {node.sublabel && (
                  <text
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={7}
                    fill={cfg.textColor}
                    opacity={0.75}
                    y={22}
                    style={{ pointerEvents: 'none' }}
                  >
                    {node.sublabel}
                  </text>
                )}
              </g>
            );
          })}
        </svg>

        {/* Selected node info panel */}
        {selectedNode && (
          <div className="absolute bottom-3 left-3 right-3 bg-white/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: NODE_CONFIG[selectedNode.type].border }}
                />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {NODE_TYPE_LABELS[selectedNode.type]}
                  </p>
                  <p className="text-sm font-semibold text-foreground">{selectedNode.label}</p>
                  {selectedNode.sublabel && (
                    <p className="text-xs text-muted-foreground">{selectedNode.sublabel}</p>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[10px] text-muted-foreground">
                  {graphData.edges.filter(e => e.source === selectedNode.id || e.target === selectedNode.id).length} connexion(s)
                </p>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="text-[10px] text-primary hover:underline mt-0.5"
                >
                  Désélectionner
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Zoom hint */}
        <div className="absolute top-2 right-2 text-[10px] text-muted-foreground bg-white/80 px-2 py-1 rounded-md border border-border">
          Molette pour zoomer · Glisser pour déplacer
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Légende :</span>
        {(Object.entries(NODE_CONFIG) as [NodeType, typeof NODE_CONFIG[NodeType]][]).map(([type, cfg]) => (
          <div key={type} className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cfg.border }} />
            <span className="text-[11px] text-muted-foreground">{NODE_TYPE_LABELS[type]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
