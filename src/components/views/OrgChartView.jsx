import React, { useState, useRef } from 'react';
import { Network, ShieldAlert, Maximize, Loader2, Printer, X, Share2, Copy, Check } from 'lucide-react';
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
  landscape: { nodeW: 200, nodeH: 80, hGap: 40, vGap: 60, pad: 40, fontSize: 13, connectorWidth: 2, backgroundColor: '#ffffff' },
  portrait:  { nodeW: 160, nodeH: 68, hGap: 24, vGap: 50, pad: 30, fontSize: 11, connectorWidth: 1.5, backgroundColor: '#ffffff' },
  screen:    { nodeW: 220, nodeH: 86, hGap: 52, vGap: 68, pad: 48, fontSize: 13, connectorWidth: 1.5, backgroundColor: BG },
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

// ── Layout algorithm ──────────────────────────────────────────────────────────
function subtreeWidth(nodeId, all, opts) {
  const ch = all.filter(n => n.dependeDe === nodeId);
  if (!ch.length) return opts.nodeW;
  return Math.max(opts.nodeW, ch.reduce((s, c) => s + subtreeWidth(c.id, all, opts), 0) + opts.hGap * (ch.length - 1));
}

function layoutTree(node, all, x, y, positions, opts) {
  const children = all.filter(n => n.dependeDe === node.id);
  const sw = subtreeWidth(node.id, all, opts);
  positions[node.id] = { x: x + (sw - opts.nodeW) / 2, y, node };
  let cx = x;
  for (const child of children) {
    const cw = subtreeWidth(child.id, all, opts);
    layoutTree(child, all, cx, y + opts.nodeH + opts.vGap, positions, opts);
    cx += cw + opts.hGap;
  }
}

// ── Canvas builder ────────────────────────────────────────────────────────────
function buildOrgCanvas(rootNode, allNodes, opts) {
  const positions = {};
  layoutTree(rootNode, allNodes, 0, 0, positions, opts);

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

  // Connectors
  ctx.strokeStyle = NAVY_CONN;
  ctx.lineWidth = opts.connectorWidth;
  for (const { x, y, node } of Object.values(positions)) {
    const children = allNodes.filter(n => n.dependeDe === node.id);
    if (!children.length) continue;
    const pcx = x + opts.nodeW / 2;
    const pby = y + opts.nodeH;
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
      const cp = positions[child.id];
      ctx.beginPath(); ctx.moveTo(cp.x + opts.nodeW / 2, midY); ctx.lineTo(cp.x + opts.nodeW / 2, cp.y); ctx.stroke();
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
    ctx.font = `bold ${opts.fontSize}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    const lines = fitText(ctx, node.nombre, opts.nodeW - 24);
    const lineH = opts.fontSize + 3;
    const textY = lines.length === 1 ? y + opts.nodeH / 2 - 10 : y + opts.nodeH / 2 - lineH;
    lines.slice(0, 2).forEach((ln, i) => ctx.fillText(ln, x + opts.nodeW / 2, textY + i * lineH));

    ctx.font = 'bold 10px Arial, sans-serif';
    const bw = Math.max(48, ctx.measureText(node.codigo).width + 18);
    const bx = x + opts.nodeW / 2 - bw / 2;
    const by = y + opts.nodeH - 22;
    ctx.fillStyle = NAVY_LIGHT;
    roundRect(ctx, bx, by, bw, 17, 8); ctx.fill();
    ctx.fillStyle = NAVY;
    ctx.font = 'bold 10px "Courier New", monospace';
    ctx.fillText(node.codigo, x + opts.nodeW / 2, by + 12);
  }

  return { canvas, totalW, totalH };
}

// ── Screen TreeNode ───────────────────────────────────────────────────────────
const TreeNode = ({ node, allNodes, onEdit, isRoot = false }) => {
  const children = allNodes.filter(n => n.dependeDe === node.id);
  const [hovered, setHovered] = useState(false);

  return (
    <div className="flex flex-col items-center">
      <div
        onClick={() => onEdit && onEdit('dependencias', node)}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          'relative z-10 cursor-pointer rounded-xl border-2 p-4 text-center transition-all duration-200 select-none',
          isRoot
            ? 'min-w-[220px] max-w-[300px] border-primary bg-primary/5 shadow-lg shadow-primary/10'
            : 'min-w-[180px] max-w-[250px] bg-card',
          !isRoot && (hovered ? 'border-primary shadow-md -translate-y-1' : 'border-border shadow-sm')
        )}
      >
        <p className={cn('text-[13px] font-bold leading-tight', isRoot || hovered ? 'text-primary' : 'text-foreground')}>
          {node.nombre}
        </p>
        <span className={cn(
          'inline-block mt-2 px-2.5 py-0.5 rounded-full text-[10.5px] font-bold tracking-wider transition-colors',
          isRoot || hovered ? 'bg-primary text-primary-foreground' : 'bg-secondary text-primary'
        )}>
          {node.codigo}
        </span>
        {node.sigla && (
          <p className="mt-1 text-[10px] uppercase text-muted-foreground font-semibold tracking-wider">
            {node.sigla}
          </p>
        )}
      </div>

      {children.length > 0 && (
        <div className="flex flex-col items-center">
          <div className="w-px h-8 bg-border" />
          <div className="flex items-start">
            {children.map((child, i) => (
              <div key={child.id} className="flex flex-col items-center relative px-4">
                {children.length > 1 && (
                  <div className={cn(
                    'absolute top-0 h-px bg-border',
                    i === 0 ? 'left-1/2 right-0' :
                    i === children.length - 1 ? 'left-0 right-1/2' : 'left-0 right-0'
                  )} />
                )}
                <div className="w-px h-7 bg-border" />
                <TreeNode node={child} allNodes={allNodes} onEdit={onEdit} />
              </div>
            ))}
          </div>
        </div>
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
  const buildTree = (node) => {
    const ch = allNodes.filter(n => n.dependeDe === node.id);
    return `<div class="nc"><div class="card"><div class="name">${node.nombre}</div><div class="code">${node.codigo}</div></div>${ch.length ? `<div class="cv"></div><div class="row">${ch.map(c => buildTree(c)).join('')}</div>` : ''}</div>`;
  };
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:sans-serif;background:#f8fafc;padding:40px;display:flex;justify-content:center}.nc{display:flex;flex-direction:column;align-items:center}.card{background:#fff;border:2px solid #c9cfe2;border-radius:12px;padding:14px 18px;min-width:180px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,.06)}.name{font-weight:700;color:#1e293b;font-size:13px}.code{margin-top:6px;display:inline-block;background:#eef0f5;color:#2d3a5e;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700}.cv{width:2px;height:28px;background:#a8b2cf}.row{display:flex;border-top:2px solid #a8b2cf;padding-top:18px;gap:16px}</style></head><body>${buildTree(rootNode)}</body></html>`;
}

// ── Main View ─────────────────────────────────────────────────────────────────
export default function OrgChartView({ dependencias, onEdit }) {
  const [selectedRootId, setSelectedRootId] = useState('');
  const [isPrinting, setIsPrinting]         = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [orientation, setOrientation]       = useState('landscape');
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedType, setCopiedType]         = useState(null);
  const [isDragging, setIsDragging]         = useState(false);
  const [drag, setDrag]                     = useState({ startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });
  const scrollRef = useRef(null);

  const rootNode = dependencias.find(d => d.id === selectedRootId);

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

  // PDF export
  const handleExportPDF = async () => {
    if (!rootNode) return;
    setIsPrinting(true);
    try {
      const opts = PRESETS[orientation];
      const { canvas, totalW, totalH } = buildOrgCanvas(rootNode, dependencias, opts);

      const pdfDir = orientation === 'landscape' ? 'l' : 'p';
      const pdf    = new jsPDF(pdfDir, 'mm', 'a4');
      const pW     = pdf.internal.pageSize.getWidth();
      const pH     = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const availW = pW - margin * 2;
      const availH = pH - margin * 2;

      // Scale-to-fit maintaining aspect ratio
      const aspect = totalW / totalH;
      let fw = availW;
      let fh = fw / aspect;
      if (fh > availH) { fh = availH; fw = fh * aspect; }

      const xOff = margin + (availW - fw) / 2;
      const yOff = margin + (availH - fh) / 2;

      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', xOff, yOff, fw, fh);
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
                { label: 'EMBED', content: `<iframe src="data:text/html;charset=utf-8,${encodeURIComponent(buildHTML(rootNode, dependencias))}" width="100%" height="600" frameborder="0"></iframe>`, key: 'embed' },
                { label: 'HTML',  content: buildHTML(rootNode, dependencias), key: 'html' },
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
            <div className="absolute top-4 right-4 bg-card/80 backdrop-blur border border-border px-3 py-1 rounded-full text-[10px] text-muted-foreground flex items-center gap-1.5 shadow-sm pointer-events-none z-10">
              <Maximize className="h-3 w-3" /> Arrastra para navegar
            </div>
            <div className="inline-flex justify-center min-w-full pb-10">
              <TreeNode node={rootNode} allNodes={dependencias} onEdit={onEdit} isRoot />
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
