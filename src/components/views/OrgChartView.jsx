import React, { useState, useRef } from 'react';
import { Network, ShieldAlert, Maximize, Loader2, Printer, X, Share2, Copy, Check, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { cn } from '@/lib/utils';
import ViewHeader from '../ui/ViewHeader';

// ── Colors ────────────────────────────────────────────────────────────────────
const NAVY        = '#2d3a5e';
const NAVY_LIGHT  = '#eef0f5';
const NAVY_BORDER = '#c9cfe2';
const NAVY_CONN   = '#a8b2cf';
const TEXT_DARK   = '#1e293b';
const BG          = '#f8fafc';
const HD          = 2;

// ── Layout presets ────────────────────────────────────────────────────────────
const PRESETS = {
  landscape: { nodeW: 165, nodeH: 112, hGap: 14, vGap: 56, pad: 15, fontSize: 14, connectorWidth: 1.5, backgroundColor: '#ffffff' },
  portrait:  { nodeW: 140, nodeH: 100, hGap: 12, vGap: 48, pad: 12, fontSize: 13, connectorWidth: 1.5, backgroundColor: '#ffffff' },
  screen:    { nodeW: 220, nodeH: 92,  hGap: 52, vGap: 68, pad: 48, fontSize: 14, connectorWidth: 1.5, backgroundColor: BG },
};

// ── Canvas helpers ────────────────────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r); ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r); ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r); ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
}

function fitText(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return [text];
  const words = text.split(' ');
  const lines = []; let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = word; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

// ── Layout algorithm (depth-aware hybrid) ────────────────────────────────────
// depth 0→1 : classic horizontal spread (children side-by-side)
// depth 1+  : vertical bracket (children stacked, offset right from parent center)

function subtreeWidth(nodeId, all, opts, depth) {
  const ch = all.filter(n => n.dependeDe === nodeId);
  if (!ch.length) return opts.nodeW;
  if (depth === 0) {
    // classic: children spread horizontally
    return Math.max(opts.nodeW, ch.reduce((s, c) => s + subtreeWidth(c.id, all, opts, depth + 1), 0) + opts.hGap * (ch.length - 1));
  } else {
    // bracket: each child stacks vertically, width = parent + arm + max-child-subtree
    const ARM = 40;
    const maxChildW = Math.max(...ch.map(c => subtreeWidth(c.id, all, opts, depth + 1)));
    return opts.nodeW / 2 + ARM + maxChildW;
  }
}

function layoutTree(node, all, x, y, positions, opts, depth) {
  const children = all.filter(n => n.dependeDe === node.id);
  const sw = subtreeWidth(node.id, all, opts, depth);

  if (depth === 0) {
    // Classic: centre node over its subtree
    positions[node.id] = { x: x + (sw - opts.nodeW) / 2, y, node, depth };
    let cx = x;
    for (const child of children) {
      const cw = subtreeWidth(child.id, all, opts, depth + 1);
      layoutTree(child, all, cx, y + opts.nodeH + opts.vGap, positions, opts, depth + 1);
      cx += cw + opts.hGap;
    }
  } else {
    // Bracket: parent at left, children stacked vertically to the right
    const ARM       = 40;
    const STEM_OFF  = opts.nodeW / 2;       // centre of parent
    const CHILD_X   = x + STEM_OFF + ARM;  // left edge of child boxes
    const CHILD_GAD = 20;                  // vertical gap between stacked children

    positions[node.id] = { x, y, node, depth };

    // Children start BELOW the parent node (nodeH + gap), not at the same Y
    const BRACKET_VGAP = 24;
    let cy = y + opts.nodeH + BRACKET_VGAP;
    for (const child of children) {
      layoutTree(child, all, CHILD_X, cy, positions, opts, depth + 1);
      const childH = subtreeHeight(child.id, all, opts, depth + 1, CHILD_GAD);
      cy += childH + CHILD_GAD;
    }
  }
}

// Helper: total height consumed by a node's subtree in bracket mode
function subtreeHeight(nodeId, all, opts, depth, gap) {
  const ch = all.filter(n => n.dependeDe === nodeId);
  if (!ch.length) return opts.nodeH;
  const childrenH = ch.reduce((s, c) => s + subtreeHeight(c.id, all, opts, depth + 1, gap), 0)
                  + gap * (ch.length - 1);
  return Math.max(opts.nodeH, childrenH);
}

// ── Canvas builder ────────────────────────────────────────────────────────────
function buildOrgCanvas(rootNode, allNodes, opts) {
  const positions = {};
  layoutTree(rootNode, allNodes, 0, 0, positions, opts, 0);

  let maxX = 0, maxY = 0;
  for (const { x, y } of Object.values(positions)) {
    maxX = Math.max(maxX, x + opts.nodeW);
    maxY = Math.max(maxY, y + opts.nodeH);
  }

  const totalW = maxX + opts.pad * 2;
  const totalH = maxY + opts.pad * 2;

  const canvas = document.createElement('canvas');
  canvas.width  = totalW * HD;
  canvas.height = totalH * HD;

  const ctx = canvas.getContext('2d');
  ctx.scale(HD, HD);
  ctx.translate(opts.pad, opts.pad);

  // Background
  ctx.fillStyle = opts.backgroundColor;
  ctx.fillRect(-opts.pad, -opts.pad, totalW, totalH);

  // ── Connectors (hybrid: depth 0 classic ↓, depth>0 bracket →) ────────────────
  const ARROW = 5;
  ctx.lineWidth = opts.connectorWidth;

  const drawArrowDown = (cx, tipY) => {
    ctx.beginPath();
    ctx.moveTo(cx, tipY);
    ctx.lineTo(cx - ARROW, tipY - ARROW * 1.8);
    ctx.lineTo(cx + ARROW, tipY - ARROW * 1.8);
    ctx.closePath();
    ctx.fill();
  };

  const drawArrowRight = (tipX, cy) => {
    ctx.beginPath();
    ctx.moveTo(tipX, cy);
    ctx.lineTo(tipX - ARROW * 1.8, cy - ARROW);
    ctx.lineTo(tipX - ARROW * 1.8, cy + ARROW);
    ctx.closePath();
    ctx.fill();
  };

  for (const { x, y, node, depth } of Object.values(positions)) {
    const children = allNodes.filter(n => n.dependeDe === node.id);
    if (!children.length) continue;

    ctx.strokeStyle = NAVY_CONN;
    ctx.fillStyle   = NAVY_CONN;

    if (depth === 0) {
      // ── Classic: horizontal bar + vertical drops with ↓ arrows ──
      const pcx  = x + opts.nodeW / 2;
      const pby  = y + opts.nodeH;
      const midY = pby + opts.vGap / 2;

      ctx.beginPath(); ctx.moveTo(pcx, pby); ctx.lineTo(pcx, midY); ctx.stroke();

      if (children.length > 1) {
        const first = positions[children[0].id];
        const last  = positions[children[children.length - 1].id];
        ctx.beginPath();
        ctx.moveTo(first.x + opts.nodeW / 2, midY);
        ctx.lineTo(last.x  + opts.nodeW / 2, midY);
        ctx.stroke();
      }

      for (const child of children) {
        const cp  = positions[child.id];
        const ccx = cp.x + opts.nodeW / 2;
        ctx.beginPath();
        ctx.moveTo(ccx, midY);
        ctx.lineTo(ccx, cp.y - ARROW * 1.8);
        ctx.stroke();
        drawArrowDown(ccx, cp.y);
      }
    } else {
      // ── Bracket: vertical stem centred, horizontal arms → children ──
      const ARM      = 40;
      const CHILD_GAD = 20;
      const stemX    = x + opts.nodeW / 2;  // vertical line x
      const stemTopY = y + opts.nodeH;       // bottom of parent

      // Compute vertical centre of each child row
      const childCentres = children.map(child => {
        const cp = positions[child.id];
        return cp.y + opts.nodeH / 2;
      });

      const lastCY = childCentres[childCentres.length - 1];

      // Vertical stem from parent bottom to last child centre
      ctx.beginPath();
      ctx.moveTo(stemX, stemTopY);
      ctx.lineTo(stemX, lastCY);
      ctx.stroke();

      for (let i = 0; i < children.length; i++) {
        const midY  = childCentres[i];
        const tipX  = stemX + ARM;
        // Horizontal arm
        ctx.beginPath();
        ctx.moveTo(stemX, midY);
        ctx.lineTo(tipX - ARROW * 1.8, midY);
        ctx.stroke();
        drawArrowRight(tipX, midY);
      }
    }
  }

  // Node cards
  for (const { x, y, node } of Object.values(positions)) {
    ctx.save();
    ctx.shadowColor = 'rgba(45,58,94,0.12)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3;
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, x, y, opts.nodeW, opts.nodeH, 10); ctx.fill();
    ctx.restore();

    ctx.strokeStyle = NAVY_BORDER; ctx.lineWidth = 2;
    roundRect(ctx, x, y, opts.nodeW, opts.nodeH, 10); ctx.stroke();

    ctx.fillStyle = TEXT_DARK;
    ctx.textAlign = 'center';
    // Dynamic font: short names get larger text, long names scale down gracefully
    const dynFs = node.nombre.length <= 10 ? Math.min(opts.fontSize + 3, 18)
                : node.nombre.length <= 22 ? Math.min(opts.fontSize + 1, 16)
                : node.nombre.length <= 38 ? opts.fontSize
                : Math.max(opts.fontSize - 1, 10);
    ctx.font = `${dynFs}px Arial, sans-serif`;
    const lines = fitText(ctx, node.nombre, opts.nodeW - 16);
    const lineH = dynFs + 4;
    const maxLines = 3;
    const visibleLines = lines.slice(0, maxLines);
    // Centre text block above the badge; reserve 22px at bottom for badge
    const textBlockH = visibleLines.length * lineH;
    const textAreaH  = opts.nodeH - 22;
    const textY = y + (textAreaH - textBlockH) / 2 + dynFs;
    visibleLines.forEach((ln, i) => ctx.fillText(ln, x + opts.nodeW / 2, textY + i * lineH));

    ctx.font = '10px Arial, sans-serif';
    const bw = Math.max(48, ctx.measureText(node.codigo).width + 18);
    const bx = x + opts.nodeW / 2 - bw / 2;
    const by = y + opts.nodeH - 24;
    ctx.fillStyle = NAVY_LIGHT;
    roundRect(ctx, bx, by, bw, 17, 8); ctx.fill();
    ctx.fillStyle = NAVY;
    ctx.font = '10px "Courier New", monospace';
    ctx.fillText(node.codigo, x + opts.nodeW / 2, by + 12);
  }

  return { canvas, totalW, totalH };
}

// ── Connector A: Classic top-down (depth 0 → direct children of root) ─────────
// Horizontal spread, vertical drops, ↓ arrowheads
const OrgConnectorClassic = ({ children }) => {
  const childrenArr = React.Children.toArray(children);
  const count = childrenArr.length;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: 2, height: 20, background: NAVY_CONN }} />
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        {childrenArr.map((child, i) => {
          const isFirst = i === 0;
          const isLast  = i === count - 1;
          const isOnly  = count === 1;
          return (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', paddingLeft: 20, paddingRight: 20 }}>
              {!isOnly && (
                <div style={{ position: 'absolute', top: 0, height: 2, background: NAVY_CONN, left: isFirst ? '50%' : 0, right: isLast ? '50%' : 0 }} />
              )}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: 2, height: 20, background: NAVY_CONN }} />
                <svg width="10" height="8" viewBox="0 0 10 8" style={{ display: 'block', marginTop: -1 }} aria-hidden>
                  <path d="M0,0 L10,0 L5,8 Z" fill={NAVY_CONN} />
                </svg>
              </div>
              {child}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Connector B: Vertical bracket (depth > 0 → sub-children) ──────────────────
// Children stacked vertically, horizontal arms, → arrowheads.
// STEM_OFFSET centers the vertical line under the parent node.
const OrgConnectorBracket = ({ children }) => {
  const childrenArr = React.Children.toArray(children);
  const count = childrenArr.length;
  const ARM         = 40;  // horizontal arm length in px
  const STEM_OFFSET = 90;  // ≈ half of parent min-width (180px) → centers stem

  return (
    // paddingLeft pushes the whole bracket so the stem sits at the parent's center
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', paddingLeft: STEM_OFFSET }}>
      {/* Vertical stem from parent center-bottom */}
      <div style={{ width: 2, height: 20, background: NAVY_CONN }} />

      {childrenArr.map((child, i) => {
        const isLast = i === count - 1;
        // ARM_TOP: offset from row top to where the arm should appear.
        // We target the vertical center of the child CARD (not the full subtree).
        // The card top is at marginTop: 0 inside the child, so half card height ≈ 36px.
        const CARD_HALF = 42;
        return (
          <div key={i} style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', position: 'relative', paddingTop: 16, paddingBottom: 16 }}>
            {/* Vertical line: full height except last stops at arm level */}
            <div style={{ position: 'absolute', left: 0, top: 0, bottom: isLast ? `calc(100% - ${16 + CARD_HALF}px)` : 0, width: 2, background: NAVY_CONN }} />
            {/* Arm + arrow at card-centre height */}
            <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', marginTop: CARD_HALF - 1, flexShrink: 0 }}>
              <div style={{ width: ARM, height: 2, background: NAVY_CONN }} />
              <svg width="8" height="12" viewBox="0 0 8 12" style={{ marginLeft: -1 }} aria-hidden>
                <path d="M0,0 L0,12 L8,6 Z" fill={NAVY_CONN} />
              </svg>
            </div>
            {/* Child node */}
            <div style={{ marginLeft: 6 }}>{child}</div>
          </div>
        );
      })}
    </div>
  );
};

// ── Screen TreeNode ───────────────────────────────────────────────────────────
const TreeNode = ({ node, allNodes, onEdit, isRoot = false, depth = 0 }) => {
  const children = allNodes.filter(n => n.dependeDe === node.id);
  const [hovered, setHovered] = useState(false);

  // depth 0 = root connecting to its direct children → classic horizontal layout
  // depth > 0 = any sub-dependency → bracket vertical layout
  const useClassic = depth === 0;
  const Connector = useClassic ? OrgConnectorClassic : OrgConnectorBracket;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: useClassic ? 'center' : 'flex-start' }}>
      <div
        onClick={() => onEdit && onEdit('dependencias', node)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          'relative z-10 cursor-pointer rounded-xl border-2 p-5 text-center transition-all duration-200 select-none',
          isRoot
            ? 'min-w-[220px] max-w-[300px] border-primary bg-primary/5 shadow-lg shadow-primary/10'
            : 'min-w-[180px] max-w-[250px] bg-card',
          !isRoot && (hovered ? 'border-primary shadow-md -translate-y-1' : 'border-border shadow-sm')
        )}
      >
        <p
          className={cn('font-normal leading-tight', isRoot || hovered ? 'text-primary' : 'text-foreground')}
          style={{
            fontSize: node.nombre.length <= 12 ? '17px'
                    : node.nombre.length <= 28 ? '15px'
                    : node.nombre.length <= 45 ? '13px'
                    : '12px'
          }}
        >
          {node.nombre}
        </p>
        <span className={cn(
          'inline-block mt-2 px-2.5 py-0.5 rounded-full text-[11.5px] font-normal tracking-wider transition-colors',
          isRoot || hovered ? 'bg-primary text-primary-foreground' : 'bg-secondary text-primary'
        )}>
          {node.codigo}
        </span>
        {node.sigla && (
          <p className="mt-1 text-[11px] uppercase text-muted-foreground font-normal tracking-wider">
            {node.sigla}
          </p>
        )}
      </div>

      {children.length > 0 && (
        <Connector>
          {children.map((child) => (
            <TreeNode key={child.id} node={child} allNodes={allNodes} onEdit={onEdit} depth={depth + 1} />
          ))}
        </Connector>
      )}
    </div>
  );
};

// ── Print Modal ───────────────────────────────────────────────────────────────
function PrintModal({ orientation, setOrientation, isPrinting, onExport, onClose }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-lg rounded-xl border border-border shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
              <Printer className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-[15px] font-semibold text-foreground">Exportar PDF</h3>
              <p className="text-[12px] text-muted-foreground">Selecciona orientación y descarga</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 flex flex-col gap-3">
          {[
            { key: 'landscape', label: 'Horizontal (Landscape)', desc: 'Ideal para organigramas anchos con muchas dependencias.', icon: '⬛' },
            { key: 'portrait',  label: 'Vertical (Portrait)',    desc: 'Ideal para estructuras simples o pocas dependencias.',   icon: '📄' },
          ].map(({ key, label, desc, icon }) => (
            <div
              key={key}
              onClick={() => setOrientation(key)}
              className={cn(
                'p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-4',
                orientation === key ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
              )}
            >
              <div className={cn(
                'h-10 w-10 rounded-lg flex items-center justify-center text-xl',
                orientation === key ? 'bg-primary/10' : 'bg-secondary'
              )}>
                {icon}
              </div>
              <div className="flex-1">
                <p className="text-[14px] font-semibold text-foreground">{label}</p>
                <p className="text-[12px] text-muted-foreground">{desc}</p>
              </div>
              <div className={cn(
                'h-5 w-5 rounded-full border-2 flex items-center justify-center transition-all',
                orientation === key ? 'border-primary bg-primary' : 'border-border'
              )}>
                {orientation === key && <div className="h-2 w-2 rounded-full bg-white" />}
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 pb-6 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-input rounded-md text-[13px] font-medium hover:bg-secondary transition-colors">
            Cancelar
          </button>
          <button
            onClick={onExport}
            disabled={isPrinting}
            className="px-5 py-2 bg-primary text-primary-foreground rounded-md text-[13px] font-semibold hover:bg-primary/90 transition-all flex items-center gap-2 disabled:opacity-60"
          >
            {isPrinting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            {isPrinting ? 'Generando...' : 'Descargar PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Share Modal ───────────────────────────────────────────────────────────────
function buildHTML(rootNode, allNodes) {
  // depth 0→1: classic horizontal; depth>0: bracket vertical
  const buildTree = (node, depth) => {
    const ch = allNodes.filter(n => n.dependeDe === node.id);
    const card = `<div class="card"><div class="name">${node.nombre}</div><div class="code">${node.codigo}</div></div>`;
    if (!ch.length) return `<div class="nc">${card}</div>`;

    if (depth === 0) {
      // Classic: stem + horizontal row
      return `<div class="nc">${card}<div class="cv"></div><div class="row">${ch.map(c => buildTree(c, depth + 1)).join('')}</div></div>`;
    } else {
      // Bracket: stem centred + children stacked vertically with → arms
      const childrenHTML = ch.map(c => `<div class="brow">${buildTree(c, depth + 1)}</div>`).join('');
      return `<div class="nc-b">${card}<div class="bracket"><div class="bstem"></div><div class="bchildren">${childrenHTML}</div></div></div>`;
    }
  };

  const style = `
    body{font-family:sans-serif;background:#f8fafc;padding:40px;display:flex;justify-content:center}
    .nc{display:flex;flex-direction:column;align-items:center}
    .nc-b{display:flex;flex-direction:column;align-items:flex-start}
    .card{background:#fff;border:2px solid #c9cfe2;border-radius:12px;padding:14px 18px;min-width:180px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.06)}
    .name{font-weight:400;color:#1e293b;font-size:13px}
    .code{margin-top:6px;display:inline-block;background:#eef0f5;color:#2d3a5e;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:400}
    .cv{width:2px;height:28px;background:#a8b2cf;align-self:center}
    .row{display:flex;border-top:2px solid #a8b2cf;padding-top:18px;gap:16px}
    .bracket{display:flex;flex-direction:row;padding-left:90px}
    .bstem{width:2px;background:#a8b2cf;flex-shrink:0}
    .bchildren{display:flex;flex-direction:column}
    .brow{display:flex;flex-direction:row;align-items:center;padding:10px 0;position:relative}
    .brow::before{content:'';position:absolute;left:-40px;top:50%;width:40px;height:2px;background:#a8b2cf}
    .brow::after{content:'▶';position:absolute;left:-4px;top:50%;transform:translateY(-50%);font-size:8px;color:#a8b2cf;line-height:1}
  `;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${style}</style></head><body>${buildTree(rootNode, 0)}</body></html>`;
}

// ── Main View ─────────────────────────────────────────────────────────────────
export default function OrgChartView({ dependencias, onEdit, currentUser, entities = [] }) {
  const [selectedRootId, setSelectedRootId] = useState('');
  const [isPrinting, setIsPrinting]         = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [orientation, setOrientation]       = useState('landscape');
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedType, setCopiedType]         = useState(null);
  const [isDragging, setIsDragging]         = useState(false);
  const [drag, setDrag]                     = useState({ startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });
  const [zoom, setZoom]                     = useState(1);
  const scrollRef = useRef(null);

  const rootNode = dependencias.find(d => d.id === selectedRootId);

  // Filter dependencias to max 2 visible levels below the root.
  // Level 0 = root, level 1 = direct children, level 2 = grandchildren.
  // Deeper nodes are excluded from rendering but NOT deleted from the system.
  const filterByMaxDepth = (root, all, maxDepth) => {
    if (!root) return [];
    const result = [root];
    const visit = (nodeId, depth) => {
      if (depth >= maxDepth) return;
      all.filter(n => n.dependeDe === nodeId).forEach(child => {
        result.push(child);
        visit(child.id, depth + 1);
      });
    };
    visit(root.id, 0);
    return result;
  };

  const visibleDeps = rootNode ? filterByMaxDepth(rootNode, dependencias, 2) : [];

  // Zoom handlers
  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.1, 2));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.5));
  const handleResetZoom = () => setZoom(1);

  // Drag-to-pan
  const onMouseDown = e => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setDrag({ startX: e.pageX - scrollRef.current.offsetLeft, startY: e.pageY - scrollRef.current.offsetTop, scrollLeft: scrollRef.current.scrollLeft, scrollTop: scrollRef.current.scrollTop });
  };
  const onMouseUp    = () => setIsDragging(false);
  const onMouseLeave = () => setIsDragging(false);
  const onMouseMove  = e => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const y = e.pageY - scrollRef.current.offsetTop;
    scrollRef.current.scrollLeft = drag.scrollLeft - (x - drag.startX) * 1.4;
    scrollRef.current.scrollTop  = drag.scrollTop  - (y - drag.startY) * 1.4;
  };

  // PDF export – structured document with border + metadata
  const handleExportPDF = async () => {
    if (!rootNode) return;
    setIsPrinting(true);
    try {
      const opts = PRESETS[orientation];
      const { canvas } = buildOrgCanvas(rootNode, visibleDeps, opts);

      const pdfDir = orientation === 'landscape' ? 'l' : 'p';
      const pdf    = new jsPDF(pdfDir, 'mm', 'letter');
      const pW     = pdf.internal.pageSize.getWidth();
      const pH     = pdf.internal.pageSize.getHeight();

      // ── Resolve entity name ───────────────────────────────────────────────
      const userEntity   = entities.find(e => e.id === currentUser?.entity_id);
      const entityLabel  = userEntity?.razonSocial || userEntity?.nombre || 'Organización';
      const dateLabel    = new Date().toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });

      // ── Page layout constants (mm) ────────────────────────────────────────
      const MARGIN   = 8;    // gap between page edge and border box (mm)
      const PAD      = 5;    // internal padding inside border box
      const LW       = 0.5;  // line width for borders / separators

      // Border box
      const boxX = MARGIN;
      const boxY = MARGIN;
      const boxW = pW - MARGIN * 2;
      const boxH = pH - MARGIN * 2;


      // Thin gray border matching the reference aesthetic
      pdf.setDrawColor(150, 150, 150);
      pdf.setLineWidth(0.3);
      pdf.rect(boxX, boxY, boxW, boxH);

      const metaX = boxX + PAD;
      let   metaY = boxY + PAD;

      // Entity name
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(11);
      pdf.setTextColor(30, 41, 59);   // TEXT_DARK equivalent
      pdf.text(entityLabel, metaX, metaY + 5);
      metaY += 9;

      // Date
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);
      pdf.setTextColor(100, 116, 139); // muted
      pdf.text(`Fecha de generación: ${dateLabel}`, metaX, metaY + 3);
      metaY += 8;

      // Separator line (full box width)
      pdf.setDrawColor(180, 180, 180);
      pdf.setLineWidth(0.2);
      const sepY = metaY + 2;
      pdf.line(boxX + 1, sepY, boxX + boxW - 1, sepY);

      // Chart area - minimal lateral padding so chart uses full width
      const chartPad   = 2;
      const chartAreaX = boxX + chartPad;
      const chartAreaY = sepY + chartPad;
      const chartAreaW = boxW - chartPad * 2;
      const chartAreaH = boxH - (sepY - boxY) - chartPad * 2;

      // Always fill full width first; constrain by height only if needed
      const chartAspect = canvas.width / canvas.height;
      let chartW = chartAreaW;
      let chartH = chartW / chartAspect;
      if (chartH > chartAreaH) {
        chartH = chartAreaH;
        chartW = chartH * chartAspect;
      }

      // Density-aware cap: few nodes → don't stretch to full page, leave breathing room
      const nodeCount = visibleDeps.length;
      const densityFactor = Math.min(1, 0.50 + nodeCount * 0.037); // ~0.54 for 1 node, ~1.0 for 14+ nodes
      chartW = Math.min(chartW, chartAreaW * densityFactor);
      chartH = Math.min(chartH, chartAreaH * densityFactor);
      // Maintain aspect ratio after density cap
      if (chartW / chartH > chartAspect) { chartW = chartH * chartAspect; }
      else { chartH = chartW / chartAspect; }

      // Center horizontally; center vertically so whitespace is balanced above/below
      const chartX = chartAreaX + (chartAreaW - chartW) / 2;
      const chartY = chartAreaY + (chartAreaH - chartH) / 2;

      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', chartX, chartY, chartW, chartH);
      pdf.save(`Organigrama_${rootNode.nombre.replace(/\s+/g, '_')}_${orientation}.pdf`);
      setShowPrintModal(false);
    } catch (err) {
      console.error(err);
      alert('Error al exportar: ' + (err.message || err));
    } finally {
      setIsPrinting(false);
    }
  };

  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">

      {/* Print Modal */}
      {showPrintModal && (
        <PrintModal
          orientation={orientation}
          setOrientation={setOrientation}
          isPrinting={isPrinting}
          onExport={handleExportPDF}
          onClose={() => setShowPrintModal(false)}
        />
      )}

      {/* Share Modal */}
      {showShareModal && rootNode && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-xl rounded-xl border border-border shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 bg-primary/10 rounded-lg flex items-center justify-center text-primary"><Share2 className="h-5 w-5" /></div>
                <div><h3 className="text-[15px] font-semibold">Compartir Organigrama</h3><p className="text-[12px] text-muted-foreground">Exporta el diseño como HTML</p></div>
              </div>
              <button onClick={() => setShowShareModal(false)} className="p-2 text-muted-foreground hover:text-foreground transition-colors"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              {[
                { label: 'EMBED', content: `<iframe src="data:text/html;charset=utf-8,${encodeURIComponent(buildHTML(rootNode, visibleDeps))}" width="100%" height="600" frameborder="0"></iframe>`, key: 'embed' },
                { label: 'HTML',  content: buildHTML(rootNode, visibleDeps), key: 'html' },
              ].map(({ label, content, key }) => (
                <div key={key} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-muted-foreground uppercase">{label}</label>
                    <button onClick={() => handleCopy(content, key)} className="text-[12px] font-semibold text-primary flex items-center gap-1.5 hover:underline">
                      {copiedType === key ? <><Check className="h-3.5 w-3.5" />Copiado!</> : <><Copy className="h-3.5 w-3.5" />Copiar</>}
                    </button>
                  </div>
                  <div className="bg-secondary/50 border border-border rounded-lg p-3 text-[11px] font-mono text-muted-foreground h-16 overflow-y-auto break-all">{content.slice(0, 200)}…</div>
                </div>
              ))}
            </div>
            <div className="p-6 bg-secondary/30 border-t border-border flex justify-end">
              <button onClick={() => setShowShareModal(false)} className="px-6 py-2 bg-foreground text-background rounded-md text-[13px] font-semibold hover:bg-primary transition-all">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <ViewHeader
        icon={Network}
        title="Organigrama"
        subtitle="Visualización jerárquica de dependencias"
        actions={
          <div className="flex items-center gap-2">
            <select
              value={selectedRootId}
              onChange={e => setSelectedRootId(e.target.value)}
              className="h-8 min-w-[180px] rounded-md border border-input bg-card px-2 text-[12.5px] font-medium focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">Selecciona raíz…</option>
              {dependencias.map(dep => (
                <option key={dep.id} value={dep.id}>{dep.codigo} — {dep.nombre}</option>
              ))}
            </select>
            {rootNode && (
              <>
                <button onClick={() => setShowShareModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 border border-input bg-card text-[12.5px] font-medium rounded-md hover:bg-secondary transition-all">
                  <Share2 className="h-3.5 w-3.5" /> Web
                </button>
                <button onClick={() => setShowPrintModal(true)} className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-primary-foreground text-[12.5px] font-semibold rounded-md hover:bg-primary/90 transition-all active:scale-95">
                  <Printer className="h-3.5 w-3.5" /> PDF
                </button>
              </>
            )}
          </div>
        }
      />

      {/* Canvas area */}
      <div className="flex-1 min-h-0 bg-secondary/20 relative overflow-hidden">
        {rootNode ? (
          <div
            ref={scrollRef}
            onMouseDown={onMouseDown} onMouseUp={onMouseUp} onMouseLeave={onMouseLeave} onMouseMove={onMouseMove}
            className={cn('flex-1 h-full overflow-auto p-10 select-none custom-scrollbar', isDragging ? 'cursor-grabbing' : 'cursor-grab')}
          >
            <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
              <div className="bg-card/90 backdrop-blur border border-border px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-3">
                <button 
                  onClick={handleZoomOut}
                  className="p-1.5 hover:bg-secondary rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                  title="Alejar"
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <div className="w-12 text-center text-[12px] font-bold text-foreground tabular-nums">
                  {Math.round(zoom * 100)}%
                </div>
                <button 
                  onClick={handleZoomIn}
                  className="p-1.5 hover:bg-secondary rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                  title="Acercar"
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
                <div className="w-[1px] h-4 bg-border mx-1" />
                <button 
                  onClick={handleResetZoom}
                  className="p-1.5 hover:bg-secondary rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                  title="Restablecer (100%)"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              </div>
              
              <div className="bg-card/80 backdrop-blur border border-border px-3 py-1 rounded-full text-[10px] text-muted-foreground flex items-center gap-1.5 shadow-sm pointer-events-none self-end">
                <Maximize className="h-3 w-3" /> Arrastra para navegar
              </div>
            </div>

            <div 
              className="inline-flex justify-center min-w-full pb-10 transition-transform duration-200 ease-out"
              style={{ 
                transform: `scale(${zoom})`,
                transformOrigin: 'top center'
              }}
            >
              <TreeNode node={rootNode} allNodes={visibleDeps} onEdit={onEdit} isRoot />
            </div>
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-10 text-muted-foreground text-center">
            <ShieldAlert className="h-12 w-12 opacity-20 mb-4 mx-auto" />
            <p className="text-[14px] font-medium">Selecciona una dependencia raíz</p>
            <p className="text-[12px] opacity-60 mt-1">Mapeo jerárquico automático</p>
          </div>
        )}
      </div>
    </div>
  );
}
