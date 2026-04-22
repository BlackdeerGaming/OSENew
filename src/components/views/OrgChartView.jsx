import React, { useState } from 'react';
import { Network, Download, ShieldAlert, Maximize, Loader2, Printer, X, ChevronRight, Share2, Copy, Check, Code } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { cn } from '@/lib/utils';
import ViewHeader from '../ui/ViewHeader';

// ─── Colores hex puros (sin oklch) ────────────────────────────────────────────
const NAVY        = '#2d3a5e';
const NAVY_LIGHT  = '#eef0f5';
const NAVY_BORDER = '#c9cfe2';
const NAVY_CONN   = '#a8b2cf';
const TEXT_DARK   = '#1e293b';
const TEXT_MUTED  = '#94a3b8';
const BG          = '#f8fafc';

// ─── Constantes de layout del canvas ──────────────────────────────────────────
const HD      = 2;    // factor de escala retina

const PRINT_PRESETS = {
  SINGLE_PAGE: {
    nodeW: 230,
    nodeH: 90,
    hGap: 45,
    vGap: 60,
    pad: 50,
    borderWidth: 3,
    connectorWidth: 2.5,
    backgroundColor: '#f1f5f9',
    fontSize: 14,
    title: 'Ajustar a una hoja (Horizontal)'
  },
  MULTI_PAGE: {
    nodeW: 240,
    nodeH: 96,
    hGap: 60,
    vGap: 100, 
    pad: 60,
    borderWidth: 2,
    connectorWidth: 2,
    backgroundColor: '#ffffff',
    fontSize: 15,
    title: 'Múltiples hojas (Distribución Maximizada)'
  },
  SCREEN: {
    nodeW: 220,
    nodeH: 86,
    hGap: 52,
    vGap: 68,
    pad: 48,
    borderWidth: 1.5,
    connectorWidth: 1.5,
    backgroundColor: BG,
    fontSize: 13,
    title: 'Pantalla'
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de canvas
// ─────────────────────────────────────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,   x + w, y + r,   r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y,     x + r, y,       r);
  ctx.closePath();
}

function fitText(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return [text];
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = word; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

// ─────────────────────────────────────────────────────────────────────────────
// Algoritmo de layout (posiciona cada nodo en el espacio)
// ─────────────────────────────────────────────────────────────────────────────
function subtreeWidth(nodeId, all, opts) {
  const ch = all.filter(n => n.dependeDe === nodeId);
  if (!ch.length) return opts.nodeW;
  const total = ch.reduce((s, c) => s + subtreeWidth(c.id, all, opts), 0);
  return Math.max(opts.nodeW, total + opts.hGap * (ch.length - 1));
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

// ─────────────────────────────────────────────────────────────────────────────
// Renderizador Canvas — sin CSS, sin oklch, 100% portable a PDF
// ─────────────────────────────────────────────────────────────────────────────
function buildOrgCanvas(rootNode, allNodes, opts = PRINT_PRESETS.SCREEN) {
  const positions = {};
  layoutTree(rootNode, allNodes, 0, 0, positions, opts);

  // Tamaño real del lienzo
  let maxX = 0, maxY = 0;
  for (const { x, y } of Object.values(positions)) {
    maxX = Math.max(maxX, x + opts.nodeW);
    maxY = Math.max(maxY, y + opts.nodeH);
  }

  const canvas = document.createElement('canvas');
  canvas.width  = (maxX + opts.pad * 2) * HD;
  canvas.height = (maxY + opts.pad * 2) * HD;

  const ctx = canvas.getContext('2d');
  ctx.scale(HD, HD);
  ctx.translate(opts.pad, opts.pad);

  // Fondo
  ctx.fillStyle = opts.backgroundColor;
  ctx.fillRect(-opts.pad, -opts.pad, maxX + opts.pad * 2, maxY + opts.pad * 2);

  // ── Conectores (dibujados antes que las tarjetas) ──────────────────────────
  ctx.strokeStyle = NAVY_CONN;
  ctx.lineWidth   = opts.connectorWidth;

  for (const { x, y, node } of Object.values(positions)) {
    const children = allNodes.filter(n => n.dependeDe === node.id);
    if (!children.length) continue;

    const pcx   = x + opts.nodeW / 2;
    const pby   = y + opts.nodeH;
    const midY  = pby + opts.vGap / 2;

    // Salida vertical del padre
    ctx.beginPath(); ctx.moveTo(pcx, pby); ctx.lineTo(pcx, midY); ctx.stroke();

    // Barra horizontal entre hijos
    if (children.length > 1) {
      const first = positions[children[0].id];
      const last  = positions[children[children.length - 1].id];
      ctx.beginPath();
      ctx.moveTo(first.x + opts.nodeW / 2, midY);
      ctx.lineTo(last.x  + opts.nodeW / 2, midY);
      ctx.stroke();
    }

    // Entrada vertical a cada hijo
    for (const child of children) {
      const cp = positions[child.id];
      ctx.beginPath();
      ctx.moveTo(cp.x + opts.nodeW / 2, midY);
      ctx.lineTo(cp.x + opts.nodeW / 2, cp.y);
      ctx.stroke();
    }
  }

  // ── Tarjetas de nodo ───────────────────────────────────────────────────────
  for (const { x, y, node } of Object.values(positions)) {
    // Sombra ligera
    ctx.save();
    ctx.shadowColor   = 'rgba(45,58,94,0.13)';
    ctx.shadowBlur    = 12;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, x, y, opts.nodeW, opts.nodeH, 12);
    ctx.fill();
    ctx.restore();

    // Borde de la tarjeta
    ctx.strokeStyle = NAVY_BORDER;
    ctx.lineWidth   = opts.borderWidth;
    roundRect(ctx, x, y, opts.nodeW, opts.nodeH, 12);
    ctx.stroke();

    // Nombre (con wrapping automático)
    ctx.fillStyle  = TEXT_DARK;
    ctx.font       = `bold ${opts.fontSize}px Arial, sans-serif`;
    ctx.textAlign  = 'center';
    const lines    = fitText(ctx, node.nombre, opts.nodeW - 28);
    const lineH    = opts.fontSize + 4;
    const topY     = lines.length === 1 ? y + opts.nodeH/2 - 12 : y + opts.nodeH/2 - 20;
    lines.slice(0, 2).forEach((ln, i) => ctx.fillText(ln, x + opts.nodeW / 2, topY + i * lineH));

    // Badge del código
    ctx.font = 'bold 11px Arial, sans-serif';
    const bw = Math.max(56, ctx.measureText(node.codigo).width + 22);
    const bx = x + opts.nodeW / 2 - bw / 2;
    const by = y + opts.nodeH - 36; // Más arriba
    ctx.fillStyle = NAVY_LIGHT;
    roundRect(ctx, bx, by, bw, 20, 10);
    ctx.fill();
    ctx.fillStyle  = NAVY;
    ctx.font       = 'bold 11px "Courier New", monospace';
    ctx.fillText(node.codigo, x + opts.nodeW / 2, by + 14);

    // Sigla (opcional)
    if (node.sigla) {
      ctx.fillStyle = TEXT_MUTED;
      ctx.font      = '10px Arial, sans-serif';
      ctx.fillText(node.sigla.toUpperCase(), x + opts.nodeW / 2, y + opts.nodeH - 6); // Más abajo
    }
  }

  return { canvas, positions, opts };
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente visual de pantalla
// ─────────────────────────────────────────────────────────────────────────────
const TreeNode = ({ node, allNodes, onEdit }) => {
  const children = allNodes.filter(n => n.dependeDe === node.id);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div className="flex flex-col items-center">
      {/* Tarjeta */}
      <div 
        onClick={() => onEdit && onEdit('dependencias', node)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={cn(
          "bg-card border-2 rounded-xl p-4 min-w-[210px] max-w-[270px] text-center transition-all cursor-pointer relative z-10",
          isHovered ? "border-primary shadow-lg -translate-y-1" : "border-border shadow-sm"
        )}
      >
        <p className={cn(
          "text-[13.5px] font-bold leading-tight",
          isHovered ? "text-primary" : "text-foreground"
        )}>
          {node.nombre}
        </p>
        <span className={cn(
          "inline-block mt-2 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wider transition-colors",
          isHovered ? "bg-primary text-primary-foreground" : "bg-secondary text-primary"
        )}>
          {node.codigo}
        </span>
        {node.sigla && (
          <p className="mt-1 text-[10px] uppercase text-muted-foreground font-semibold">
            {node.sigla}
          </p>
        )}
      </div>

      {/* Hijos */}
      {children.length > 0 && (
        <div className="flex flex-col items-center">
          <div className="w-0.5 h-8 bg-border" />
          <div className="flex items-start relative">
            {children.map((child, i) => (
              <div key={child.id} className="flex flex-col items-center relative pt-6 px-5">
                {children.length > 1 && (
                  <div className={cn(
                    "absolute top-0 h-0.5 bg-border",
                    i === 0 ? "left-1/2 right-0" : 
                    i === children.length - 1 ? "left-0 right-1/2" : "left-0 right-0"
                  )} />
                )}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-6 bg-border" />
                <TreeNode node={child} allNodes={allNodes} onEdit={onEdit} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Vista principal
// ─────────────────────────────────────────────────────────────────────────────
export default function OrgChartView({ dependencias, onEdit }) {
  const [selectedRootId, setSelectedRootId] = useState('');
  const [isExporting, setIsExporting]       = useState(false);
  const [isPrinting, setIsPrinting]         = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedPrintMode, setSelectedPrintMode] = useState('SINGLE_PAGE');
  const [showShareModal, setShowShareModal] = useState(false);
  const [copiedType, setCopiedType] = useState(null);

  const [isDragging, setIsDragging] = useState(false);
  const [drag, setDrag]             = useState({ startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });
  const scrollRef = React.useRef(null);

  const rootNode = dependencias.find(d => d.id === selectedRootId);

  const onMouseDown = e => {
    setIsDragging(true);
    setDrag({
      startX: e.pageX - scrollRef.current.offsetLeft,
      startY: e.pageY - scrollRef.current.offsetTop,
      scrollLeft: scrollRef.current.scrollLeft,
      scrollTop:  scrollRef.current.scrollTop,
    });
  };
  const onMouseUp   = () => setIsDragging(false);
  const onMouseLeave= () => setIsDragging(false);
  const onMouseMove = e => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const y = e.pageY - scrollRef.current.offsetTop;
    scrollRef.current.scrollLeft = drag.scrollLeft - (x - drag.startX) * 1.4;
    scrollRef.current.scrollTop  = drag.scrollTop  - (y - drag.startY) * 1.4;
  };

  const handleExportPDF = async (mode = 'SINGLE_PAGE') => {
    if (!rootNode) return;
    setIsPrinting(true);
    try {
      const opts = PRINT_PRESETS[mode];
      const pdf = new jsPDF('l', 'mm', 'a4'); 
      const pW = pdf.internal.pageSize.getWidth();
      const pH = pdf.internal.pageSize.getHeight();
      const margin = 12;
      const printableW = pW - margin * 2;
      const printableH = pH - margin * 2;

      const { canvas } = buildOrgCanvas(rootNode, dependencias, opts);
      const imgW = canvas.width / HD;
      const imgH = canvas.height / HD;
      const aspect = imgW / imgH;
      let fw = printableW;
      let fh = fw / aspect;
      if (fh > printableH) { fh = printableH; fw = fh * aspect; }
      
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pW - fw) / 2, (pH - fh) / 2, fw, fh);
      pdf.save(`Organigrama_${rootNode.nombre.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error(err);
      alert('Error al exportar: ' + (err.message || err));
    } finally {
      setIsPrinting(false);
    }
  };

  const generateStandaloneHTML = () => {
    if (!rootNode) return '';
    const buildHTMLTree = (node) => {
      const children = dependencias.filter(n => n.dependeDe === node.id);
      return `
        <div class="node-container">
          <div class="node-card">
            <div class="node-name">${node.nombre}</div>
            <div class="node-code">${node.codigo}</div>
          </div>
          ${children.length > 0 ? `
            <div class="connector-v"></div>
            <div class="children-container">
              ${children.map(child => buildHTMLTree(child)).join('')}
            </div>
          ` : ''}
        </div>
      `;
    };
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{font-family:sans-serif;background:#f8fafc;padding:40px;display:flex;justify-content:center}.node-container{display:flex;flex-direction:column;align-items:center}.node-card{background:#fff;border:2px solid #c9cfe2;border-radius:12px;padding:16px;min-width:200px;text-align:center;box-shadow:0 4px 6px rgba(0,0,0,0.05)}.node-name{font-weight:700;color:#1e293b;margin-bottom:8px}.node-code{display:inline-block;background:#eef0f5;color:#2d3a5e;padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700}.connector-v{width:2px;height:30px;background:#a8b2cf}.children-container{display:flex;border-top:2px solid #a8b2cf;padding-top:20px;gap:20px}</style></head><body>${buildHTMLTree(rootNode)}</body></html>`;
  };

  const handleCopy = (text, type) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {showPrintModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-xl rounded-xl border border-border shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 bg-primary/10 rounded-lg flex items-center justify-center text-primary">
                  <Printer className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-[15px] font-semibold text-foreground">Configurar Impresi\u00f3n</h3>
                  <p className="text-[12px] text-muted-foreground">Formato horizontal optimizado</p>
                </div>
              </div>
              <button onClick={() => setShowPrintModal(false)} className="p-2 text-muted-foreground hover:text-foreground transition-colors"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div onClick={() => setSelectedPrintMode('SINGLE_PAGE')} className={cn("p-4 rounded-xl border-2 transition-all cursor-pointer flex items-center gap-4", selectedPrintMode === 'SINGLE_PAGE' ? "border-primary bg-primary/5" : "border-border hover:border-border/80")}>
                <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", selectedPrintMode === 'SINGLE_PAGE' ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}><Maximize className="h-5 w-5" /></div>
                <div className="flex-1"><p className="text-[14px] font-semibold">Hoja \u00danica</p><p className="text-[12px] text-muted-foreground">Todo el organigrama en una sola hoja apaisada.</p></div>
              </div>
              <div onClick={() => setSelectedPrintMode('MULTI_PAGE')} className={cn("p-4 rounded-xl border-2 transition-all cursor-pointer flex items-center gap-4", selectedPrintMode === 'MULTI_PAGE' ? "border-primary bg-primary/5" : "border-border hover:border-border/80")}>
                <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", selectedPrintMode === 'MULTI_PAGE' ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}><Printer className="h-5 w-5" /></div>
                <div className="flex-1"><p className="text-[14px] font-semibold">Detallado</p><p className="text-[12px] text-muted-foreground">Escala optimizada para lectura.</p></div>
              </div>
            </div>
            <div className="p-6 bg-secondary/30 border-t border-border flex justify-end gap-3">
              <button onClick={() => setShowPrintModal(false)} className="px-4 py-2 border border-input rounded-md text-[13px] font-medium hover:bg-background transition-colors">Cancelar</button>
              <button onClick={() => handleExportPDF(selectedPrintMode)} disabled={isPrinting} className="px-5 py-2 bg-primary text-primary-foreground rounded-md text-[13px] font-semibold hover:bg-primary/90 transition-all flex items-center gap-2">
                {isPrinting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />} {isPrinting ? 'Generando...' : 'Descargar PDF'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showShareModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-card w-full max-w-xl rounded-xl border border-border shadow-2xl overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 bg-primary/10 rounded-lg flex items-center justify-center text-primary"><Share2 className="h-5 w-5" /></div>
                <div><h3 className="text-[15px] font-semibold">Compartir Organigrama</h3><p className="text-[12px] text-muted-foreground">Exporta el dise\u00f1o para web</p></div>
              </div>
              <button onClick={() => setShowShareModal(false)} className="p-2 text-muted-foreground hover:text-foreground transition-colors"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between"><label className="text-[11px] font-bold text-muted-foreground uppercase">Embed</label><button onClick={() => handleCopy(`<iframe src="data:text/html;charset=utf-8,${encodeURIComponent(generateStandaloneHTML())}" width="100%" height="600px" frameborder="0"></iframe>`, 'embed')} className="text-[12px] font-semibold text-primary flex items-center gap-1.5 hover:underline">{copiedType === 'embed' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copiedType === 'embed' ? 'Copiado!' : 'Copiar'}</button></div>
                <div className="bg-secondary/50 border border-border rounded-lg p-3 text-[11px] font-mono text-muted-foreground break-all">{"<iframe ...></iframe>"}</div>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between"><label className="text-[11px] font-bold text-muted-foreground uppercase">HTML</label><button onClick={() => handleCopy(generateStandaloneHTML(), 'html')} className="text-[12px] font-semibold text-primary flex items-center gap-1.5 hover:underline">{copiedType === 'html' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copiedType === 'html' ? 'Copiado!' : 'Copiar'}</button></div>
                <div className="bg-secondary/50 border border-border rounded-lg p-3 text-[11px] font-mono text-muted-foreground h-24 overflow-y-auto">{generateStandaloneHTML()}</div>
              </div>
            </div>
            <div className="p-6 bg-secondary/30 border-t border-border flex justify-end"><button onClick={() => setShowShareModal(false)} className="px-6 py-2 bg-foreground text-background rounded-md text-[13px] font-semibold hover:bg-primary transition-all">Cerrar</button></div>
          </div>
        </div>
      )}

      <ViewHeader
        icon={Network}
        title="Organigrama"
        subtitle="Visualización jerárquica de dependencias"
        actions={
          <div className="flex items-center gap-2">
            <select value={selectedRootId} onChange={e => setSelectedRootId(e.target.value)} className="h-8 min-w-[180px] rounded-md border border-input bg-card px-2 text-[12.5px] font-medium focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="">Selecciona raíz...</option>
              {dependencias.map(dep => <option key={dep.id} value={dep.id}>{dep.codigo} — {dep.nombre}</option>)}
            </select>
            {rootNode && (
              <>
                <button onClick={() => setShowShareModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 border border-input bg-card text-[12.5px] font-medium rounded-md hover:bg-secondary transition-all"><Share2 className="h-3.5 w-3.5" /> Web</button>
                <button onClick={() => setShowPrintModal(true)} className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-primary-foreground text-[12.5px] font-semibold rounded-md hover:bg-primary/90 transition-all active:scale-95"><Printer className="h-3.5 w-3.5" /> PDF</button>
              </>
            )}
          </div>
        }
      />

      <div className="flex-1 min-h-0 flex flex-col bg-secondary/20 relative overflow-hidden">
        {rootNode ? (
          <div ref={scrollRef} onMouseDown={onMouseDown} onMouseUp={onMouseUp} onMouseLeave={onMouseLeave} onMouseMove={onMouseMove} className={cn("flex-1 overflow-auto p-10 cursor-grab select-none custom-scrollbar", isDragging && "cursor-grabbing")}>
            <div className="absolute top-4 right-4 bg-card/80 backdrop-blur border border-border px-3 py-1 rounded-full text-[10px] text-muted-foreground flex items-center gap-1.5 shadow-sm pointer-events-none z-10"><Maximize className="h-3 w-3" /> Arrastra para navegar</div>
            <div className="inline-flex justify-center min-w-full pb-10"><TreeNode node={rootNode} allNodes={dependencias} onEdit={onEdit} /></div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-10 text-muted-foreground text-center">
            <ShieldAlert className="h-12 w-12 opacity-20 mb-4 mx-auto" />
            <p className="text-[14px] font-medium">Selecciona una dependencia ra\u00edz</p>
            <p className="text-[12px] opacity-60">Mapeo jer\u00e1rquico autom\u00e1tico</p>
          </div>
        )}
      </div>
    </div>
  );
}
