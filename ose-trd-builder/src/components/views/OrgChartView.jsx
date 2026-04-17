import React, { useState } from 'react';
import { Network, Download, ShieldAlert, Maximize, Loader2, GitBranch } from 'lucide-react';
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
const NODE_W  = 220;
const NODE_H  = 86;
const H_GAP   = 52;
const V_GAP   = 68;
const PAD     = 48;
const HD      = 2;

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
// Algoritmo de layout
// ─────────────────────────────────────────────────────────────────────────────
function subtreeWidth(nodeId, all) {
  const ch = all.filter(n => n.dependeDe === nodeId);
  if (!ch.length) return NODE_W;
  const total = ch.reduce((s, c) => s + subtreeWidth(c.id, all), 0);
  return Math.max(NODE_W, total + H_GAP * (ch.length - 1));
}

function layoutTree(node, all, x, y, positions) {
  const children = all.filter(n => n.dependeDe === node.id);
  const sw = subtreeWidth(node.id, all);
  positions[node.id] = { x: x + (sw - NODE_W) / 2, y, node };
  let cx = x;
  for (const child of children) {
    const cw = subtreeWidth(child.id, all);
    layoutTree(child, all, cx, y + NODE_H + V_GAP, positions);
    cx += cw + H_GAP;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Renderizador Canvas
// ─────────────────────────────────────────────────────────────────────────────
function buildOrgCanvas(rootNode, allNodes) {
  const positions = {};
  layoutTree(rootNode, allNodes, 0, 0, positions);

  let maxX = 0, maxY = 0;
  for (const { x, y } of Object.values(positions)) {
    maxX = Math.max(maxX, x + NODE_W);
    maxY = Math.max(maxY, y + NODE_H);
  }

  const canvas = document.createElement('canvas');
  canvas.width  = (maxX + PAD * 2) * HD;
  canvas.height = (maxY + PAD * 2) * HD;

  const ctx = canvas.getContext('2d');
  ctx.scale(HD, HD);
  ctx.translate(PAD, PAD);

  ctx.fillStyle = BG;
  ctx.fillRect(-PAD, -PAD, maxX + PAD * 2, maxY + PAD * 2);

  ctx.strokeStyle = NAVY_CONN;
  ctx.lineWidth   = 1.5;

  for (const { x, y, node } of Object.values(positions)) {
    const children = allNodes.filter(n => n.dependeDe === node.id);
    if (!children.length) continue;

    const pcx  = x + NODE_W / 2;
    const pby  = y + NODE_H;
    const midY = pby + V_GAP / 2;

    ctx.beginPath(); ctx.moveTo(pcx, pby); ctx.lineTo(pcx, midY); ctx.stroke();

    if (children.length > 1) {
      const first = positions[children[0].id];
      const last  = positions[children[children.length - 1].id];
      ctx.beginPath();
      ctx.moveTo(first.x + NODE_W / 2, midY);
      ctx.lineTo(last.x  + NODE_W / 2, midY);
      ctx.stroke();
    }

    for (const child of children) {
      const cp = positions[child.id];
      ctx.beginPath();
      ctx.moveTo(cp.x + NODE_W / 2, midY);
      ctx.lineTo(cp.x + NODE_W / 2, cp.y);
      ctx.stroke();
    }
  }

  for (const { x, y, node } of Object.values(positions)) {
    ctx.save();
    ctx.shadowColor   = 'rgba(45,58,94,0.13)';
    ctx.shadowBlur    = 12;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = '#ffffff';
    roundRect(ctx, x, y, NODE_W, NODE_H, 12);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = NAVY_BORDER;
    ctx.lineWidth   = 1.5;
    roundRect(ctx, x, y, NODE_W, NODE_H, 12);
    ctx.stroke();

    ctx.fillStyle  = TEXT_DARK;
    ctx.font       = 'bold 13px Arial, sans-serif';
    ctx.textAlign  = 'center';
    const lines    = fitText(ctx, node.nombre, NODE_W - 28);
    const lineH    = 17;
    const topY     = lines.length === 1 ? y + 26 : y + 18;
    lines.slice(0, 2).forEach((ln, i) => ctx.fillText(ln, x + NODE_W / 2, topY + i * lineH));

    ctx.font = 'bold 11px Arial, sans-serif';
    const bw = Math.max(56, ctx.measureText(node.codigo).width + 22);
    const bx = x + NODE_W / 2 - bw / 2;
    const by = y + NODE_H - 30;
    ctx.fillStyle = NAVY_LIGHT;
    roundRect(ctx, bx, by, bw, 20, 10);
    ctx.fill();
    ctx.fillStyle  = NAVY;
    ctx.font       = 'bold 11px "Courier New", monospace';
    ctx.fillText(node.codigo, x + NODE_W / 2, by + 14);

    if (node.sigla) {
      ctx.fillStyle = TEXT_MUTED;
      ctx.font      = '10px Arial, sans-serif';
      ctx.fillText(node.sigla.toUpperCase(), x + NODE_W / 2, y + NODE_H - 8);
    }
  }

  return canvas;
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente visual TreeNode (pantalla)
// ─────────────────────────────────────────────────────────────────────────────
const TreeNode = ({ node, allNodes }) => {
  const children = allNodes.filter(n => n.dependeDe === node.id);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
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
// Detectar nodos raíz (sin padre o con padre inválido)
// ─────────────────────────────────────────────────────────────────────────────
function getRootNodes(dependencias) {
  const allIds = new Set(dependencias.map(d => d.id));
  return dependencias.filter(d => {
    const padre = d.dependeDe;
    return !padre || padre === 'ninguna' || !allIds.has(padre);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Vista principal — soporta múltiples raíces independientes
// ─────────────────────────────────────────────────────────────────────────────
export default function OrgChartView({ dependencias }) {
  const [selectedRootId, setSelectedRootId] = useState('all');
  const [isExporting, setIsExporting]       = useState(false);

  const [isDragging, setIsDragging] = useState(false);
  const [drag, setDrag]             = useState({ startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });
  const scrollRef = React.useRef(null);

  const rootNodes = getRootNodes(dependencias);

  const visibleRoots = selectedRootId === 'all'
    ? rootNodes
    : rootNodes.filter(r => r.id === selectedRootId);

  const onMouseDown = e => {
    setIsDragging(true);
    setDrag({
      startX: e.pageX - scrollRef.current.offsetLeft,
      startY: e.pageY - scrollRef.current.offsetTop,
      scrollLeft: scrollRef.current.scrollLeft,
      scrollTop:  scrollRef.current.scrollTop,
    });
  };
  const onMouseUp    = () => setIsDragging(false);
  const onMouseLeave = () => setIsDragging(false);
  const onMouseMove  = e => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const y = e.pageY - scrollRef.current.offsetTop;
    scrollRef.current.scrollLeft = drag.scrollLeft - (x - drag.startX) * 1.4;
    scrollRef.current.scrollTop  = drag.scrollTop  - (y - drag.startY) * 1.4;
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      const pdf  = new jsPDF('landscape', 'mm', 'a4');
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      let isFirst = true;

      for (const root of visibleRoots) {
        const canvas  = buildOrgCanvas(root, dependencias);
        const imgData = canvas.toDataURL('image/png');
        const imgW    = canvas.width  / HD;
        const imgH    = canvas.height / HD;
        const aspect  = imgW / imgH;

        if (!isFirst) pdf.addPage('a4', imgW > imgH ? 'landscape' : 'portrait');
        isFirst = false;

        let fw = pageW - 20;
        let fh = fw / aspect;
        if (fh > pageH - 20) { fh = pageH - 20; fw = fh * aspect; }

        pdf.addImage(imgData, 'PNG', (pageW - fw) / 2, (pageH - fh) / 2, fw, fh);
      }

      const label = selectedRootId === 'all'
        ? 'Todos_los_Organigramas'
        : (visibleRoots[0]?.nombre?.replace(/\s+/g, '_') || 'Organigrama');
      pdf.save(`${label}.pdf`);
    } catch (err) {
      console.error(err);
      alert('Error al exportar: ' + (err.message || err));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: BG }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
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
            <p style={{ margin: 0, fontSize: 12, color: TEXT_MUTED }}>
              {rootNodes.length > 1
                ? `${rootNodes.length} estructuras organizacionales independientes`
                : 'Mapeo jerárquico automático basado en dependencias'}
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <select
            value={selectedRootId}
            onChange={e => setSelectedRootId(e.target.value)}
            style={{
              height: 40, minWidth: 300, borderRadius: 8, border: '1px solid #cbd5e1',
              padding: '0 12px', fontSize: 14, background: '#f8fafc', color: TEXT_DARK, outline: 'none'
            }}
          >
            <option value="all">📊 Todos los organigramas ({rootNodes.length})</option>
            {rootNodes.map(dep => (
              <option key={dep.id} value={dep.id}>🌳 {dep.codigo} — {dep.nombre}</option>
            ))}
          </select>

          <button
            onClick={handleExportPDF}
            disabled={isExporting || dependencias.length === 0}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: NAVY, color: '#fff', border: 'none',
              padding: '10px 18px', borderRadius: 8, fontSize: 14,
              fontWeight: 600, cursor: (isExporting || dependencias.length === 0) ? 'not-allowed' : 'pointer',
              opacity: (isExporting || dependencias.length === 0) ? 0.6 : 1
            }}
          >
            {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {isExporting ? 'Generando...' : 'Exportar PDF'}
          </button>
        </div>
      </div>

      {/* ── Workspace ─────────────────────────────────────────────────────── */}
      {dependencias.length > 0 ? (
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

          {/* Múltiples árboles independientes */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 64, alignItems: 'flex-start', minWidth: '100%' }}>
            {visibleRoots.map((rootNode, idx) => (
              <div key={rootNode.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%' }}>
                {visibleRoots.length > 1 && (
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    marginBottom: 20, padding: '6px 14px',
                    background: NAVY, color: '#fff', borderRadius: 8,
                    fontSize: 12, fontWeight: 700
                  }}>
                    <GitBranch size={13} />
                    {idx + 1}. {rootNode.nombre}
                    <span style={{ opacity: 0.6, fontWeight: 400, marginLeft: 2 }}>{rootNode.codigo}</span>
                  </div>
                )}
                <div style={{ display: 'inline-flex', justifyContent: 'center', width: '100%', paddingBottom: 8 }}>
                  <TreeNode node={rootNode} allNodes={dependencias} />
                </div>
                {visibleRoots.length > 1 && idx < visibleRoots.length - 1 && (
                  <div style={{ width: '100%', marginTop: 24, borderTop: `1px dashed ${NAVY_CONN}`, position: 'relative' }}>
                    <span style={{
                      position: 'absolute', left: '50%', top: -9, transform: 'translateX(-50%)',
                      background: BG, padding: '0 12px', fontSize: 10,
                      color: TEXT_MUTED, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase'
                    }}>
                      — Estructura independiente —
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', color: TEXT_MUTED, padding: 32
        }}>
          <ShieldAlert size={56} style={{ opacity: 0.25, marginBottom: 16 }} />
          <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>No hay dependencias creadas aún.</p>
          <p style={{ margin: '6px 0 0', fontSize: 12 }}>Crea dependencias en el módulo TRD para generar el organigrama.</p>
        </div>
      )}
    </div>
  );
}
