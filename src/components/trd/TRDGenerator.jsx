import React from "react";
import { Table, Check, Info, FileText, Download } from "lucide-react";

// ── UN SOLO TOKEN DE BORDE: 1px negro puro ──────────────────────────────────
// Todas las celdas usan este mismo valor.
// border-collapse: collapse en la tabla elimina la superposición.
const BD = "1px solid #000000";

export default function TRDGenerator({ rows = [], selectedIds = new Set(), currentEntity, logoBase64, onExportPDF }) {
  // If we have selected IDs, we filter rows. If not, we show all provided rows.
  const exportRows = (selectedIds instanceof Set && selectedIds.size > 0) 
    ? rows.filter(r => selectedIds.has(r.id)) 
    : rows;

  if (exportRows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-12 text-muted-foreground bg-white rounded-2xl border border-dashed" style={{ borderColor: '#334155' }}>
        <div className="p-4 rounded-full mb-4">
          <Table className="h-10 w-10 text-slate-400" />
        </div>
        <p className="font-bold text-slate-800 text-lg">Tabla de Retención Vacía</p>
        <p className="text-sm mt-2 max-w-sm text-center text-slate-500 font-medium">
          Para generar el reporte oficial, primero debes completar la valoración técnica
          de tus series en el módulo "Valoración TRD".
        </p>
      </div>
    );
  }

  const oficina      = exportRows[0]?.dependencia || "OFICINA PRODUCTORA";
  const codOficina   = exportRows[0]?.codigo?.split('-')[0] || "1.1";
  const entityName   = currentEntity?.razonSocial || currentEntity?.nombre || "OSE SISTEMA GLOBAL";
  const logoSrc      = logoBase64 || currentEntity?.logoUrl;
  const fechaHoy     = new Date().toLocaleDateString('es-CO');

  // Estilos reutilizables
  const TH = {
    border: BD, textAlign: 'center', verticalAlign: 'middle',
    padding: '4px 2px', fontWeight: '900', textTransform: 'uppercase', fontSize: '7.5px',
    lineHeight: '1.2', backgroundColor: '#ffffff'
  };
  const TD = { border: BD, verticalAlign: 'top', fontSize: '9px' };
  const TDC = { ...TD, textAlign: 'center', verticalAlign: 'middle', padding: '2px' };

  return (
    <div className="flex flex-col gap-6 bg-slate-50 min-h-full pb-20">

      {/* ── Barra de acción (no se imprime) ────────────────────────────── */}
      <div className="flex items-center justify-between p-4 bg-white border-b sticky top-0 z-10 print:hidden shadow-sm" style={{ borderColor: '#334155' }}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-rose-50">
            <FileText className="h-5 w-5 text-rose-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Reporte Oficial TRD (Formato PDF)</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Previsualización del Documento Archivístico</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold text-slate-600 border border-slate-300 bg-white">
            <Info className="h-3.5 w-3.5" />
            {selectedIds.size > 0 ? `${selectedIds.size} seleccionados` : `Todos los registros (${rows.length})`}
          </div>
          {onExportPDF && (
            <button
              onClick={onExportPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold transition-all shadow-sm active:scale-95"
            >
              <Download className="h-3.5 w-3.5" />
              Descargar TRD
            </button>
          )}
        </div>
      </div>

      {/* ── Marco de captura ─────────────────────────────────────────────── */}
      <div id="trd-capture-frame" className="flex justify-center bg-white print:block print:p-0 print:m-0 print:w-full print:flex-none" style={{ padding: '40px' }}>
        <div
          id="trd-final-report-area"
          className="bg-white flex flex-col font-sans shadow-2xl w-full max-w-[215mm] p-[10mm] print:shadow-none print:border-0 print:m-0 print:p-[4mm] print:w-full print:max-w-none"
        >

          {/* ════════════════════════════════════════════════════════════════
              TABLA OFICIAL — border-collapse: collapse
              13 columnas lógicas: D S SUB | Serie | SF SE | A/G A/C | CT M S E | Procedimiento
              Con border-collapse, cada borde compartido se dibuja una sola vez → sin superposición.
              ════════════════════════════════════════════════════════════════ */}
          <table style={{
            borderCollapse: 'collapse',
            width: '100%',
            tableLayout: 'fixed',
            fontFamily: 'inherit',
            fontSize: '8px',
            border: BD
          }}>
            {/* ── Definición de anchos de columna ──────────────────────── */}
            <colgroup>
              <col style={{ width: '4%' }} />    {/* D */}
              <col style={{ width: '4%' }} />    {/* S */}
              <col style={{ width: '4%' }} />    {/* SUB */}
              <col style={{ width: '22%' }} />   {/* Serie / Subserie */}
              <col style={{ width: '4%' }} />    {/* SF */}
              <col style={{ width: '4%' }} />    {/* SE */}
              <col style={{ width: '4%' }} />    {/* A/G */}
              <col style={{ width: '4%' }} />    {/* A/C */}
              <col style={{ width: '3.5%' }} />  {/* CT */}
              <col style={{ width: '3.5%' }} />  {/* M */}
              <col style={{ width: '3.5%' }} />  {/* S */}
              <col style={{ width: '3.5%' }} />  {/* E */}
              <col />                             {/* Procedimiento (restante ≈ 36%) */}
            </colgroup>

            <thead>
              {/* ── FILA 1: Encabezado institucional ─────────────────── */}
              <tr>
                {/* Logo (columnas D+S+SUB = 12%) */}
                <td colSpan={3} style={{ border: BD, textAlign: 'center', verticalAlign: 'middle', padding: '8px' }}>
                  {logoSrc
                    ? <img src={logoSrc} alt="Logo" style={{ height: '40px', objectFit: 'contain', display: 'block', margin: '0 auto' }} crossOrigin="anonymous" />
                    : <span style={{ fontSize: '20px', fontWeight: '900', color: '#e11d48', letterSpacing: '-0.05em', lineHeight: 1 }}>TRD</span>
                  }
                  <div style={{ fontSize: '5px', fontWeight: 'bold', marginTop: '4px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>Información para todos</div>
                </td>

                {/* Título principal (columnas Serie+SF+SE+A/G+A/C+CT+M+S+E = 9 cols) */}
                <td colSpan={9} style={{ border: BD, textAlign: 'center', verticalAlign: 'middle', padding: '16px' }}>
                  <h1 style={{ margin: 0, fontSize: '17px', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.2em', color: '#0f172a' }}>
                    Tabla de Retención Documental
                  </h1>
                </td>

                {/* Código / Versión / Fecha (columna Procedimiento = 1 col) */}
                <td style={{ border: BD, padding: 0, verticalAlign: 'top', fontSize: '8px', fontWeight: 'bold' }}>
                  <div style={{ borderBottom: BD, padding: '4px 6px', display: 'flex', justifyContent: 'space-between', textTransform: 'uppercase', gap: '4px' }}>
                    <span style={{ fontWeight: '900', whiteSpace: 'nowrap' }}>Código:</span>
                    <span style={{ textAlign: 'right', wordBreak: 'break-all' }}>GID-030-PDT-001-F-001</span>
                  </div>
                  <div style={{ borderBottom: BD, padding: '4px 6px', display: 'flex', justifyContent: 'space-between', textTransform: 'uppercase' }}>
                    <span style={{ fontWeight: '900' }}>Versión:</span><span>08</span>
                  </div>
                  <div style={{ padding: '4px 6px', display: 'flex', justifyContent: 'space-between', textTransform: 'uppercase' }}>
                    <span style={{ fontWeight: '900' }}>Fecha:</span><span>{fechaHoy}</span>
                  </div>
                </td>
              </tr>

              {/* ── FILA 2: Metadata de entidad ───────────────────────── */}
              <tr>
                <td colSpan={13} style={{ border: BD, padding: '8px 10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', textTransform: 'uppercase', fontSize: '8px' }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <span style={{ fontWeight: '900', width: '130px', flexShrink: 0 }}>Entidad Productora:</span>
                      <span style={{ fontWeight: 'bold', color: '#0f172a' }}>{entityName}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <span style={{ fontWeight: '900', width: '130px', flexShrink: 0 }}>Oficina productora:</span>
                      <span style={{ fontWeight: 'bold', color: '#0f172a' }}>{oficina}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <span style={{ fontWeight: '900', width: '130px', flexShrink: 0 }}>Código Oficina:</span>
                      <span style={{ fontWeight: 'bold', color: '#0f172a' }}>{codOficina}</span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '9px', fontWeight: 'bold', fontStyle: 'italic', marginTop: '4px' }}>Pág 1 de 1</div>
                </td>
              </tr>

              {/* ── FILA 3: Encabezados principales de columna ────────── */}
              <tr>
                <th colSpan={3}  style={TH}>CÓDIGO</th>
                <th rowSpan={2}  style={TH}>Serie, Subserie y Tipos Documentales</th>
                <th colSpan={2}  style={{ ...TH, verticalAlign: 'top' }}>Soporte o Formato</th>
                <th colSpan={2}  style={{ ...TH, verticalAlign: 'top' }}>Tiempo de Retención (Años)</th>
                <th colSpan={4}  style={TH}>Disposición Final</th>
                <th rowSpan={2}  style={TH}>Procedimiento</th>
              </tr>

              {/* ── FILA 4: Sub-encabezados ───────────────────────────── */}
              <tr>
                <th style={TH}>D</th>
                <th style={TH}>S</th>
                <th style={TH}>SUB</th>
                {/* Serie es rowSpan=2 desde fila 3 */}
                <th style={TH}>SF</th>
                <th style={TH}>SE</th>
                <th style={TH}>A/G</th>
                <th style={TH}>A/C</th>
                <th style={TH}>CT</th>
                <th style={TH}>M</th>
                <th style={TH}>S</th>
                <th style={TH}>E</th>
                {/* Procedimiento es rowSpan=2 desde fila 3 */}
              </tr>
            </thead>

            {/* ── CUERPO DE DATOS ──────────────────────────────────────── */}
            <tbody>
              {exportRows.map((row, idx) => {
                const parts = (row.codigo || '').split(/[- ._]/);
                const d   = parts[0] || '';
                const s   = parts[1] || '';
                const sub = parts[2] || '';

                return (
                  <tr key={row.id || idx}>
                    {/* Código D / S / SUB */}
                    <td style={{ ...TDC, fontWeight: 'bold' }}>{d}</td>
                    <td style={{ ...TDC, fontWeight: 'bold' }}>{s}</td>
                    <td style={{ ...TDC, fontWeight: 'bold' }}>{sub}</td>

                    {/* Serie / Subserie y Tipos Documentales */}
                    <td style={{ ...TD, padding: '10px 12px' }}>
                      {sub ? (
                        <>
                          <div style={{ fontWeight: '900', textTransform: 'uppercase', fontSize: '10px', color: '#0f172a', lineHeight: '1.3' }}>
                            {row.subserie}
                          </div>
                          <div style={{ marginTop: '4px', borderLeft: BD, paddingLeft: '8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {row.tipoDocumental && row.tipoDocumental.split(',').map((t, i) => (
                              <span key={i} style={{ fontSize: '8px', fontWeight: 'bold', fontStyle: 'italic', textTransform: 'uppercase' }}>
                                {t.trim()}
                              </span>
                            ))}
                          </div>
                        </>
                      ) : (
                        <span style={{ fontWeight: '900', textTransform: 'uppercase', fontSize: '11px', color: '#0f172a', letterSpacing: '0.03em' }}>
                          {row.serie}
                        </span>
                      )}
                    </td>

                    {/* Soporte Físico */}
                    <td style={TDC}>
                      {(row.soporte === 'fisico' || !row.soporte) ? <Check className="h-3 w-3 mx-auto" /> : ''}
                    </td>
                    {/* Soporte Electrónico */}
                    <td style={TDC}>
                      {row.soporte === 'electronico' ? <Check className="h-3 w-3 mx-auto" /> : ''}
                    </td>

                    {/* Retención Gestión */}
                    <td style={{ ...TDC, fontWeight: '900' }}>{row.retencionGestion}</td>
                    {/* Retención Central */}
                    <td style={{ ...TDC, fontWeight: '900' }}>{row.retencionCentral}</td>

                    {/* Conservación Total */}
                    <td style={TDC}>
                      {(row.disposicion === 'Conservación total' || row.disposicion === 'CT')
                        ? <Check className="h-3 w-3 mx-auto" /> : ''}
                    </td>
                    {/* Microfilmación/Digitalización */}
                    <td style={{ ...TDC, fontSize: '7px' }}>
                      {(row.reproduccion === 'Digitalización' || row.reproduccion === 'Microfilmación')
                        ? row.reproduccion.charAt(0) : ''}
                    </td>
                    {/* Selección */}
                    <td style={TDC}>
                      {row.disposicion === 'Selección' ? <Check className="h-3 w-3 mx-auto" /> : ''}
                    </td>
                    {/* Eliminación */}
                    <td style={TDC}>
                      {row.disposicion === 'Eliminación' ? <Check className="h-3 w-3 mx-auto" /> : ''}
                    </td>

                    {/* Procedimiento */}
                    <td style={{ ...TD, padding: '10px 12px', textAlign: 'justify', lineHeight: '14px', fontWeight: '500', whiteSpace: 'pre-wrap' }}>
                      {row.procedimiento || 'No especificado.'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* ── Firmas ───────────────────────────────────────────────────── */}
          <div style={{ marginTop: '64px', paddingLeft: '24px', paddingRight: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '80px', fontSize: '8px', textTransform: 'uppercase', fontWeight: '900', textAlign: 'center' }}>
              {['Firma Responsable Dependencia', 'Firma Secretaría General', 'Comité Institucional de Gestión y Desempeño'].map((label) => (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ width: '100%', borderTop: BD }} />
                  <span>{label}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '100%', borderTop: '1px solid rgba(0,0,0,0.15)' }} />
              <div style={{ fontSize: '7px', color: '#64748b', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.3em' }}>
                Documento Generado Electrónicamente con OSE IA — {new Date().getFullYear()}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
