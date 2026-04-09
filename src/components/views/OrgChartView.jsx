import React, { useState } from 'react';
import { Network, Download, ShieldAlert, Maximize, Loader2, Printer, X, ChevronRight } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { cn } from '@/lib/utils';

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
// Componente visual de pantalla (inline styles — sin oklch tampoco)
// ─────────────────────────────────────────────────────────────────────────────
const TreeNode = ({ node, allNodes }) => {
  const children = allNodes.filter(n => n.dependeDe === node.id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* Tarjeta */}
      <div style={{
        background: '#fff', border: `2px solid ${NAVY_BORDER}`,
        borderRadius: 12, padding: '14px 16px', minWidth: 210, maxWidth: 270,
        textAlign: 'center', boxShadow: '0 2px 8px rgba(45,58,94,0.08)'
      }}>
        <p style={{ margin: 0, fontWeight: 700, fontSize: 13, color: TEXT_DARK, lineHeight: 1.35 }}>
          {node.nombre}
        </p>
        <span style={{
          display: 'inline-block', marginTop: 7, background: NAVY_LIGHT,
          padding: '2px 10px', borderRadius: 99, fontSize: 11, fontWeight: 700, color: NAVY, letterSpacing: '0.07em'
        }}>
          {node.codigo}
        </span>
        {node.sigla && (
          <p style={{ margin: '4px 0 0', fontSize: 10, textTransform: 'uppercase', color: TEXT_MUTED, fontWeight: 600 }}>
            {node.sigla}
          </p>
        )}
      </div>

      {/* Hijos */}
      {children.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: 1, height: 32, background: NAVY_CONN }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', position: 'relative' }}>
            {children.map((child, i) => (
              <div key={child.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', padding: '24px 20px 0' }}>
                {children.length > 1 && (
                  <div style={{
                    position: 'absolute', top: 0, height: 1, background: NAVY_CONN,
                    left: i === 0 ? '50%' : 0,
                    right: i === children.length - 1 ? '50%' : 0,
                  }} />
                )}
                <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 1, height: 24, background: NAVY_CONN }} />
                <TreeNode node={child} allNodes={allNodes} />
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
export default function OrgChartView({ dependencias }) {
  const [selectedRootId, setSelectedRootId] = useState('');
  const [isExporting, setIsExporting]       = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedPrintMode, setSelectedPrintMode] = useState('SINGLE_PAGE');

  // Drag & scroll
  const [isDragging, setIsDragging] = useState(false);
  const [drag, setDrag]             = useState({ startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });
  const scrollRef = React.useRef(null);

  const rootNode = dependencias.find(d => d.id === selectedRootId);

  // ─── Helpers de impresión horizontal ────────────────────────────────────────
  const countSubtree = (nodeId) => {
    let count = 1;
    dependencias.filter(n => n.dependeDe === nodeId).forEach(c => count += countSubtree(c.id));
    return count;
  };

  const findExpansions = (nodeId, isRoot = true) => {
    const list = [];
    const children = dependencias.filter(n => n.dependeDe === nodeId);
    children.forEach(c => {
      const grandchildren = dependencias.filter(n => n.dependeDe === c.id);
      if (grandchildren.length > 0) list.push(c);
      list.push(...findExpansions(c.id, false));
    });
    return list;
  };


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

  // ─── Exportar PDF usando canvas puro (sin captura DOM → sin oklch) ──────────
  const handleExportPDF = async (mode = 'SINGLE_PAGE') => {
    if (!rootNode) return;
    setIsExporting(true);
    try {
      const opts = PRINT_PRESETS[mode];
      const pdf = new jsPDF('l', 'mm', 'a4'); 
      const pW = pdf.internal.pageSize.getWidth();
      const pH = pdf.internal.pageSize.getHeight();
      const margin = 12;
      const printableW = pW - margin * 2;
      const printableH = pH - margin * 2;

      // Escala fija para mantener consistencia y legibilidad (ajustable)
      const scale = 0.65;
      const pageWidthPx = printableW / scale;

      // Función auxiliar para renderizar un conjunto de nodos en una o más páginas
      const renderSubtree = (localRoot, localNodes, titlePrefix) => {
        const { canvas, positions, opts: activeOpts } = buildOrgCanvas(localRoot, localNodes, opts);
        const sortedNodes = Object.values(positions).sort((a, b) => a.x - b.x);
        
        let startIdx = 0;
        let pagesCreated = 0;

        while (startIdx < sortedNodes.length) {
          if (pagesCreated > 0 || pdf.internal.getNumberOfPages() > 1 || (titlePrefix !== 'General')) {
             if (pagesCreated > 0 || (titlePrefix !== 'General')) pdf.addPage('l', 'mm', 'a4');
          }
          
          // Algoritmo Greedy: Buscar la mayor cantidad de nodos que quepan (guiado por 5, pero flexible)
          let count = Math.min(12, sortedNodes.length - startIdx); // Intentamos hasta 12 si caben
          let bestFit = 0;
          
          while (count >= 1) {
            const batch = sortedNodes.slice(startIdx, startIdx + count);
            if (batch.length === 0) break;
            
            const minX = Math.min(...batch.map(n => n.x));
            const maxX = Math.max(...batch.map(n => n.x + activeOpts.nodeW));
            
            // Si caben en el ancho de la página o si es el mínimo aceptable (3)
            if ((maxX - minX) <= pageWidthPx || count <= 3) {
              bestFit = count;
              break;
            }
            count--;
          }
          if (bestFit === 0) bestFit = 1; // Fallback extremo

          const chunk = sortedNodes.slice(startIdx, startIdx + bestFit);
          const minX = Math.max(0, Math.min(...chunk.map(n => n.x)) - 30); 
          const maxX = Math.max(...chunk.map(n => n.x + activeOpts.nodeW)) + 30;
          
          const sX = (minX + activeOpts.pad) * HD;
          const sW = (maxX - minX) * HD;
          const sH = canvas.height;

          const sliceCanvas = document.createElement('canvas');
          sliceCanvas.width = sW;
          sliceCanvas.height = sH;
          const sCtx = sliceCanvas.getContext('2d');
          sCtx.drawImage(canvas, sX, 0, sW, sH, 0, 0, sW, sH);
          
          const aspect = sW / sH;
          let fw = printableW;
          let fh = fw / aspect;
          if (fh > printableH) { fh = printableH; fw = fh * aspect; }
          
          pdf.addImage(sliceCanvas.toDataURL('image/png'), 'PNG', (pW - fw) / 2, (pH - fh) / 2, fw, fh);
          
          pdf.setFontSize(10);
          pdf.setTextColor(120);
          pdf.text(`${titlePrefix} — Hoja ${pagesCreated + 1} — ${rootNode.nombre}`, margin, pH - 6);
          
          startIdx += bestFit;
          pagesCreated++;
        }
      };

      if (mode === 'SINGLE_PAGE') {
        const { canvas } = buildOrgCanvas(rootNode, dependencias, opts);
        const imgW = canvas.width / HD;
        const imgH = canvas.height / HD;
        const aspect = imgW / imgH;
        let fw = printableW;
        let fh = fw / aspect;
        if (fh > printableH) { fh = printableH; fw = fh * aspect; }
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (pW - fw) / 2, (pH - fh) / 2, fw, fh);
      } else {
        // 1. Estructura General
        renderSubtree(rootNode, dependencias, 'Estructura General');

        // 2. Vistas de Expansion (Hijas)
        const expansions = findExpansions(rootNode.id);
        for (const expNode of expansions) {
          const subNodes = [expNode, ...dependencias.filter(n => n.dependeDe === expNode.id)];
          renderSubtree(expNode, subNodes, `Detalle: ${expNode.nombre}`);
        }
      }

      pdf.save(`Organigrama_${rootNode.nombre.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error(err);
      alert('Error al exportar: ' + (err.message || err));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BG }}>
      {showPrintModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          padding: 20
        }}>
          <div style={{
            background: '#fff', borderRadius: 20, width: '100%', maxWidth: 640,
            boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
            overflow: 'hidden', display: 'flex', flexDirection: 'column'
          }}>
            <div style={{ padding: '24px 32px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: NAVY_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Printer size={20} color={NAVY} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: TEXT_DARK }}>Configurar Impresión</h3>
                  <p style={{ margin: 0, fontSize: 13, color: TEXT_MUTED }}>Formato horizontal optimizado para legibilidad</p>
                </div>
              </div>
              <button 
                onClick={() => setShowPrintModal(false)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 8, borderRadius: 8, color: TEXT_MUTED }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: 32, display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Opción 1: Hoja Horizontal Única */}
              <div 
                onClick={() => setSelectedPrintMode('SINGLE_PAGE')}
                style={{
                  padding: 24, borderRadius: 16, border: `2px solid ${selectedPrintMode === 'SINGLE_PAGE' ? NAVY : '#f1f5f9'}`,
                  background: selectedPrintMode === 'SINGLE_PAGE' ? '#f8fafc' : '#fff',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 20, transition: 'all 0.2s'
                }}
              >
                <div style={{ 
                  width: 48, height: 48, borderRadius: 12, 
                  background: selectedPrintMode === 'SINGLE_PAGE' ? NAVY : '#f1f5f9',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: selectedPrintMode === 'SINGLE_PAGE' ? '#fff' : TEXT_MUTED
                }}>
                  <Maximize size={24} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 4px', fontWeight: 700, color: TEXT_DARK, fontSize: 15 }}>Opción 1: Hoja Horizontal Única</p>
                  <p style={{ margin: 0, fontSize: 13, color: TEXT_MUTED, lineHeight: 1.4 }}>
                    Ajuste automático para que todo quepa en una hoja apaisada. Bordes gruesos y conectores reforzados.
                  </p>
                </div>
                {selectedPrintMode === 'SINGLE_PAGE' && <ChevronRight size={20} color={NAVY} />}
              </div>

              {/* Opción 2: Distribución Horizontal Inteligente */}
              <div 
                onClick={() => setSelectedPrintMode('MULTI_PAGE')}
                style={{
                  padding: 24, borderRadius: 16, border: `2px solid ${selectedPrintMode === 'MULTI_PAGE' ? NAVY : '#f1f5f9'}`,
                  background: selectedPrintMode === 'MULTI_PAGE' ? '#f8fafc' : '#fff',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 20, transition: 'all 0.2s'
                }}
              >
                <div style={{ 
                  width: 48, height: 48, borderRadius: 12, 
                  background: selectedPrintMode === 'MULTI_PAGE' ? NAVY : '#f1f5f9',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: selectedPrintMode === 'MULTI_PAGE' ? '#fff' : TEXT_MUTED
                }}>
                  <Printer size={24} />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ margin: '0 0 4px', fontWeight: 700, color: TEXT_DARK, fontSize: 15 }}>Opción 2: Distribución Horizontal Inteligente</p>
                  <p style={{ margin: 0, fontSize: 13, color: TEXT_MUTED, lineHeight: 1.4 }}>
                    Divide el flujo (aprox. 5 dependencias por hoja) y genera vistas detalladas para dependencias con hijas.
                  </p>
                </div>
                {selectedPrintMode === 'MULTI_PAGE' && <ChevronRight size={20} color={NAVY} />}
              </div>
            </div>

            <div style={{ padding: '24px 32px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button 
                onClick={() => setShowPrintModal(false)}
                style={{ padding: '10px 20px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#fff', fontSize: 14, fontWeight: 600, color: TEXT_DARK, cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button 
                onClick={() => {
                  setShowPrintModal(false);
                  handleExportPDF(selectedPrintMode);
                }}
                style={{ padding: '10px 28px', borderRadius: 10, border: 'none', background: NAVY, fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
              >
                <Download size={18} />
                Generar PDF
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{
        background: '#fff', borderBottom: '1px solid #e2e8f0',
        padding: '14px 24px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: 16, flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: NAVY_LIGHT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Network size={20} color={NAVY} />
          </div>
          <div>
            <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: TEXT_DARK }}>Generador de Organigramas</p>
            <p style={{ margin: 0, fontSize: 12, color: TEXT_MUTED }}>Mapeo jerárquico automático basado en dependencias</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <select
            value={selectedRootId}
            onChange={e => setSelectedRootId(e.target.value)}
            style={{
              height: 40, minWidth: 280, borderRadius: 8, border: '1px solid #cbd5e1',
              padding: '0 12px', fontSize: 14, background: '#f8fafc', color: TEXT_DARK, outline: 'none'
            }}
          >
            <option value="">Selecciona dependencia raíz...</option>
            {dependencias.map(dep => (
              <option key={dep.id} value={dep.id}>{dep.codigo} — {dep.nombre}</option>
            ))}
          </select>

          {rootNode && (
            <button
              onClick={() => setShowPrintModal(true)}
              disabled={isExporting}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: NAVY, color: '#fff', border: 'none',
                padding: '10px 18px', borderRadius: 8, fontSize: 14,
                fontWeight: 600, cursor: isExporting ? 'not-allowed' : 'pointer',
                opacity: isExporting ? 0.7 : 1
              }}
            >
              {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
              {isExporting ? 'Generando...' : 'Imprimir / Exportar'}
            </button>
          )}
        </div>
      </div>

      {/* ── Workspace ──────────────────────────────────────────────────────── */}
      {rootNode ? (
        <div
          ref={scrollRef}
          onMouseDown={onMouseDown}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
          onMouseMove={onMouseMove}
          style={{
            flex: 1, overflow: 'auto', padding: 40,
            cursor: isDragging ? 'grabbing' : 'grab',
            position: 'relative', userSelect: 'none'
          }}
        >
          <div style={{
            position: 'absolute', top: 12, right: 16,
            fontSize: 11, color: TEXT_MUTED, background: '#fff',
            padding: '4px 10px', borderRadius: 6, boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
            display: 'flex', alignItems: 'center', gap: 4, pointerEvents: 'none'
          }}>
            <Maximize size={12} /> Arrastra para navegar el lienzo
          </div>

          {/* Árbol visual (solo pantalla — el PDF usa canvas) */}
          <div style={{ display: 'inline-flex', justifyContent: 'center', minWidth: '100%', paddingBottom: 40 }}>
            <TreeNode node={rootNode} allNodes={dependencias} />
          </div>
        </div>
      ) : (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', color: TEXT_MUTED, padding: 32
        }}>
          <ShieldAlert size={56} style={{ opacity: 0.25, marginBottom: 16 }} />
          <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>
            Selecciona una dependencia raíz para generar su mapa jerárquico.
          </p>
          <p style={{ margin: '6px 0 0', fontSize: 12 }}>
            El sistema calcula posiciones y conexiones automáticamente.
          </p>
        </div>
      )}
    </div>
  );
}
