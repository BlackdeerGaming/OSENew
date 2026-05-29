import React from "react";
import { Table, Check, Info, FileText, Download } from "lucide-react";

// ── Borde institucional único ─────────────────────────────────────────────────
const BD = "1px solid #000000";

/**
 * TRDGenerator — Formato Acuerdo 001 de 2024 del Archivo General de la Nación
 *
 * Props:
 *  rows                   : filas TRD (de trdRows en App.jsx)
 *  selectedIds            : Set de IDs seleccionados (vacío = mostrar todo)
 *  currentEntity          : objeto entidad actual
 *  logoBase64             : logo en base64
 *  orientation            : 'portrait' | 'landscape'
 *  onExportPDF            : callback "Descargar TRD"
 *  availableDependencias  : dependencias disponibles para filtrado
 *  selectedPrintDependencias
 *  onSelectDependencia
 */
export default function TRDGenerator({
  rows = [],
  selectedIds = new Set(),
  currentEntity,
  logoBase64,
  orientation = 'landscape',
  onExportPDF,
  availableDependencias = [],
  selectedPrintDependencias = ["TODAS"],
  onSelectDependencia = () => {},
}) {
  const isLandscape = orientation === 'landscape';

  const handleDepChange = (e) => {
    const value = e.target.value;
    if (value === "TODAS") { onSelectDependencia(["TODAS"]); return; }
    let current = [...selectedPrintDependencias];
    if (current.includes("TODAS")) current = [];
    if (current.includes(value)) current = current.filter(d => d !== value);
    else current.push(value);
    onSelectDependencia(current.length === 0 ? ["TODAS"] : current);
  };

  const exportRows =
    selectedIds instanceof Set && selectedIds.size > 0
      ? rows.filter(r => selectedIds.has(r.id))
      : rows;

  if (exportRows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-12 text-muted-foreground bg-white rounded-2xl border border-dashed" style={{ borderColor: "#334155" }}>
        <Table className="h-10 w-10 text-slate-400 mb-4" />
        <p className="font-bold text-slate-800 text-lg">Tabla de Retención Vacía</p>
        <p className="text-sm mt-2 max-w-sm text-center text-slate-500 font-medium">
          Completa la valoración técnica de las series en "Valoración TRD" para generar el reporte.
        </p>
      </div>
    );
  }

  // ── Datos institucionales ─────────────────────────────────────────────────
  const entityName = currentEntity?.razonSocial || currentEntity?.nombre || "ENTIDAD PRODUCTORA";
  const logoSrc    = logoBase64 || currentEntity?.logoUrl;
  const fechaHoy   = new Date().toLocaleDateString("es-CO");
  const maxWidthClass = isLandscape ? "max-w-[279mm]" : "max-w-[215mm]";

  // ── Estilos de celda ──────────────────────────────────────────────────────
  const fs   = isLandscape ? "7px" : "6px";       // fuente cabecera
  const fsD  = isLandscape ? "8.5px" : "7px";     // fuente dato
  const TH   = { border: BD, textAlign: "center", verticalAlign: "middle", padding: "3px 2px", fontWeight: "900", textTransform: "uppercase", fontSize: fs, lineHeight: "1.2", backgroundColor: "#f8fafc" };
  const TD   = { border: BD, verticalAlign: "top", fontSize: fsD };
  const TDC  = { ...TD, textAlign: "center", verticalAlign: "middle", padding: "2px 1px" };

  // ── Agrupación por dependencia ────────────────────────────────────────────
  const groupedRows = React.useMemo(() => {
    const g = {};
    exportRows.forEach(row => {
      const k = row.dependencia || "OFICINA PRODUCTORA";
      if (!g[k]) g[k] = [];
      g[k].push(row);
    });
    return g;
  }, [exportRows]);

  const dependencyGroups = Object.keys(groupedRows);

  return (
    <div className="flex flex-col gap-6 bg-slate-50 min-h-full pb-20">

      {/* ── Barra de acción ── */}
      <div className="flex items-center justify-between p-4 bg-white border-b sticky top-0 z-10 no-export print:hidden shadow-sm" style={{ borderColor: "#334155" }}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-rose-50"><FileText className="h-5 w-5 text-rose-600" /></div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Reporte TRD — Acuerdo 001 de 2024 AGN</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              Orientación: <span className="text-slate-700">{isLandscape ? "Horizontal" : "Vertical"}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Dependencias a imprimir</span>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
              <select value={selectedPrintDependencias.length === 1 && !selectedPrintDependencias.includes("TODAS") ? selectedPrintDependencias[0] : ""} onChange={handleDepChange} className="text-[11px] font-bold bg-transparent text-slate-700 outline-none w-48 truncate cursor-pointer">
                <option value="TODAS">--- TODAS LAS TRD ---</option>
                {availableDependencias.map(dep => (
                  <option key={dep} value={dep}>{selectedPrintDependencias.includes(dep) ? "✓ " : ""}{dep}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3 self-end">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold text-slate-600 border border-slate-300 bg-white">
              <Info className="h-3.5 w-3.5" />
              {selectedIds.size > 0 ? `${selectedIds.size} seleccionados` : `Mostrando: ${selectedPrintDependencias.includes("TODAS") ? "Todo" : selectedPrintDependencias.length + " dependencias"}`}
            </div>
            {onExportPDF && (
              <button onClick={onExportPDF} disabled={exportRows.length === 0} className="flex items-center gap-2 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-black transition-all shadow-lg shadow-rose-200 active:scale-95 disabled:opacity-50">
                <Download className="h-4 w-4" /> DESCARGAR PDF
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Tablas por dependencia ── */}
      <div id="trd-capture-frame" className="flex flex-col gap-12 bg-white print:block print:p-0 print:m-0 print:w-full print:flex-none" style={{ padding: isLandscape ? "24px 20px" : "40px" }}>
        {dependencyGroups.map((depName, groupIdx) => {
          const groupRows = groupedRows[depName];
          const codOficina = groupRows[0]?.codigoD || groupRows[0]?.codigo?.split(/[-_]/)[0] || "";

          return (
            <div key={depName} id={`trd-report-section-${groupIdx}`}
              className={`bg-white flex flex-col font-sans shadow-2xl w-full ${maxWidthClass} p-[8mm] print:shadow-none print:border-0 print:m-0 print:p-[6mm] print:w-full print:max-w-none page-break-after-always`}
            >

              {/* ════════════════════════════════════════════════════════════
                  TABLA OFICIAL — Acuerdo 001 de 2024 AGN Colombia
                  Columnas (total 16):
                   D  S  SS | Serie/Subserie | SF SE | AG AC | CT E S MT |
                   Criterio | Clasificación | Ordenación | Procedimiento
                  ════════════════════════════════════════════════════════════ */}
              <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed", fontFamily: "inherit", fontSize: fsD, border: BD }}>

                {/* ── Anchos de columna ── */}
                <colgroup>
                  <col style={{ width: "3%" }}  />{/* D */}
                  <col style={{ width: "3%" }}  />{/* S */}
                  <col style={{ width: "3%" }}  />{/* SS */}
                  <col style={{ width: "22%" }} />{/* Series/Subseries */}
                  <col style={{ width: "2.5%" }}/>{/* SF */}
                  <col style={{ width: "2.5%" }}/>{/* SE */}
                  <col style={{ width: "3.5%" }}/>{/* AG */}
                  <col style={{ width: "3.5%" }}/>{/* AC */}
                  <col style={{ width: "2.5%" }}/>{/* CT */}
                  <col style={{ width: "2.5%" }}/>{/* E */}
                  <col style={{ width: "2.5%" }}/>{/* S */}
                  <col style={{ width: "2.5%" }}/>{/* MT */}
                  <col style={{ width: "10%" }} />{/* Criterio */}
                  <col style={{ width: "8%" }}  />{/* Clasificación */}
                  <col style={{ width: "8%" }}  />{/* Ordenación */}
                  <col />                         {/* Procedimiento ≈ 21% */}
                </colgroup>

                <thead>

                  {/* ── FILA 1: Encabezado institucional ── */}
                  <tr>
                    {/* Logo */}
                    <td colSpan={3} style={{ border: BD, textAlign: "center", verticalAlign: "middle", padding: "6px" }}>
                      {logoSrc ? (
                        <img src={logoSrc} alt="Logo" style={{ height: "42px", objectFit: "contain", display: "block", margin: "0 auto" }} crossOrigin="anonymous" />
                      ) : (
                        <span style={{ fontSize: "18px", fontWeight: "900", color: "#e11d48", letterSpacing: "-0.05em" }}>TRD</span>
                      )}
                      <div style={{ fontSize: "5px", fontWeight: "bold", marginTop: "3px", textTransform: "uppercase" }}>Información para todos</div>
                    </td>

                    {/* Título */}
                    <td colSpan={12} style={{ border: BD, textAlign: "center", verticalAlign: "middle", padding: "12px 8px" }}>
                      <div style={{ fontSize: isLandscape ? "15px" : "12px", fontWeight: "900", textTransform: "uppercase", letterSpacing: "0.15em", color: "#0f172a" }}>
                        Tabla de Retención Documental
                      </div>
                      <div style={{ fontSize: "7px", fontWeight: "700", marginTop: "4px", color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                        Acuerdo 001 de 2024 — Archivo General de la Nación — Colombia
                      </div>
                    </td>

                    {/* Código / Versión / Fecha */}
                    <td style={{ border: BD, padding: 0, verticalAlign: "top", fontSize: "7px", fontWeight: "bold" }}>
                      <div style={{ borderBottom: BD, padding: "3px 5px", display: "flex", justifyContent: "space-between", textTransform: "uppercase" }}>
                        <span style={{ fontWeight: "900", whiteSpace: "nowrap" }}>Código:</span>
                        <span style={{ textAlign: "right", wordBreak: "break-all" }}>GID-TRD-001</span>
                      </div>
                      <div style={{ borderBottom: BD, padding: "3px 5px", display: "flex", justifyContent: "space-between", textTransform: "uppercase" }}>
                        <span style={{ fontWeight: "900" }}>Versión:</span>
                        <span>01</span>
                      </div>
                      <div style={{ padding: "3px 5px", display: "flex", justifyContent: "space-between", textTransform: "uppercase" }}>
                        <span style={{ fontWeight: "900" }}>Fecha:</span>
                        <span>{fechaHoy}</span>
                      </div>
                    </td>
                  </tr>

                  {/* ── FILA 2: Metadata de entidad ── */}
                  <tr>
                    <td colSpan={16} style={{ border: BD, padding: "6px 8px" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px 20px", fontSize: "7.5px", textTransform: "uppercase" }}>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <span style={{ fontWeight: "900", flexShrink: 0 }}>Entidad Productora:</span>
                          <span style={{ fontWeight: "700", color: "#0f172a" }}>{entityName}</span>
                        </div>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <span style={{ fontWeight: "900", flexShrink: 0 }}>Unidad Administrativa:</span>
                          <span style={{ fontWeight: "700", color: "#0f172a" }}>{depName}</span>
                        </div>
                        <div style={{ display: "flex", gap: "6px", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", gap: "6px" }}>
                            <span style={{ fontWeight: "900", flexShrink: 0 }}>Código Oficina:</span>
                            <span style={{ fontWeight: "700", color: "#0f172a" }}>{codOficina}</span>
                          </div>
                          <span style={{ fontSize: "7px", fontStyle: "italic", fontWeight: "bold" }}>Pág. {groupIdx + 1} de {dependencyGroups.length}</span>
                        </div>
                      </div>
                    </td>
                  </tr>

                  {/* ── FILA 3: Encabezados principales ── */}
                  <tr>
                    <th colSpan={3}  style={TH}>CÓDIGO</th>
                    <th rowSpan={2}  style={{ ...TH, fontSize: fs }}>SERIES DOCUMENTALES,{"\n"}SUBSERIES DOCUMENTALES{"\n"}Y TIPOS DOCUMENTALES</th>
                    <th colSpan={2}  style={TH}>SOPORTE</th>
                    <th colSpan={2}  style={TH}>RETENCIÓN{"\n"}(años)</th>
                    <th colSpan={4}  style={TH}>DISPOSICIÓN FINAL</th>
                    <th rowSpan={2}  style={{ ...TH, fontSize: fs }}>CRITERIO{"\n"}DISPOSICIÓN{"\n"}FINAL</th>
                    <th rowSpan={2}  style={{ ...TH, fontSize: fs }}>SISTEMA DE{"\n"}CLASIFICACIÓN</th>
                    <th rowSpan={2}  style={{ ...TH, fontSize: fs }}>SISTEMA DE{"\n"}ORDENACIÓN</th>
                    <th rowSpan={2}  style={TH}>PROCEDIMIENTO</th>
                  </tr>

                  {/* ── FILA 4: Sub-encabezados ── */}
                  <tr>
                    <th style={TH}>D</th>
                    <th style={TH}>S</th>
                    <th style={TH}>SS</th>
                    <th style={TH}>SF</th>
                    <th style={TH}>SE</th>
                    <th style={TH}>AG</th>
                    <th style={TH}>AC</th>
                    <th style={TH}>CT</th>
                    <th style={TH}>E</th>
                    <th style={TH}>S</th>
                    <th style={TH}>MT</th>
                  </tr>
                </thead>

                {/* ── CUERPO ── */}
                <tbody>
                  {groupRows.map((row, idx) => {
                    // Use pre-computed individual codes — no string splitting
                    const d   = row.codigoD   ?? (row.codigo || "").split(/[-_]/)[0] ?? "";
                    const s   = row.codigoS   ?? (row.codigo || "").split(/[-_]/)[1] ?? "";
                    const sub = row.codigoSub ?? (row.codigo || "").split(/[-_]/)[2] ?? "";
                    const hasSub = sub !== "" && sub !== undefined;

                    return (
                      <tr key={row.id || idx}>
                        {/* Código D / S / SS */}
                        <td style={{ ...TDC, fontWeight: "bold" }}>{d}</td>
                        <td style={{ ...TDC, fontWeight: "bold" }}>{s}</td>
                        <td style={{ ...TDC, fontWeight: "bold" }}>{sub}</td>

                        {/* Series, Subseries y Tipos Documentales */}
                        <td style={{ ...TD, padding: "6px 8px" }}>
                          {hasSub ? (
                            <>
                              {/* Nombre Serie (referencia) */}
                              <div style={{ fontSize: isLandscape ? "6.5px" : "5.5px", fontWeight: "700", textTransform: "uppercase", color: "#64748b", marginBottom: "2px" }}>
                                Serie: {row.serie}
                              </div>
                              {/* Nombre Subserie */}
                              <div style={{ fontWeight: "900", textTransform: "uppercase", fontSize: isLandscape ? "8.5px" : "7px", color: "#0f172a", lineHeight: "1.2", marginBottom: "5px" }}>
                                {row.subserie}
                              </div>
                              {/* Tipos documentales */}
                              <div style={{ borderLeft: "1.5px solid #000", paddingLeft: "7px", display: "flex", flexDirection: "column", gap: "2px" }}>
                                {row.tiposDocumentales?.length > 0
                                  ? row.tiposDocumentales.map((t, i) => (
                                      <div key={i} style={{ fontSize: isLandscape ? "7px" : "6px", fontWeight: "600", fontStyle: "italic", textTransform: "uppercase", display: "flex", justifyContent: "space-between", gap: "4px" }}>
                                        <span>• {t.titulo_documento}</span>
                                        <span style={{ fontSize: "5.5px", opacity: 0.7, flexShrink: 0 }}>
                                          ({[t.formato?.papel && 'F', t.formato?.electronico && 'E'].filter(Boolean).join('/')})
                                        </span>
                                      </div>
                                    ))
                                  : row.tipoDocumental?.split(",").map((t, i) => (
                                      <span key={i} style={{ fontSize: isLandscape ? "7px" : "6px", fontWeight: "600", fontStyle: "italic", textTransform: "uppercase" }}>
                                        • {t.trim()}
                                      </span>
                                    ))
                                }
                              </div>
                            </>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                              {/* Nombre Serie */}
                              <span style={{ fontWeight: "900", textTransform: "uppercase", fontSize: isLandscape ? "9px" : "7.5px", color: "#0f172a", letterSpacing: "0.02em" }}>
                                {row.serie}
                              </span>
                              <div style={{ borderLeft: "1.5px solid #000", paddingLeft: "7px", display: "flex", flexDirection: "column", gap: "2px" }}>
                                {row.tiposDocumentales?.length > 0
                                  ? row.tiposDocumentales.map((t, i) => (
                                      <div key={i} style={{ fontSize: isLandscape ? "7px" : "6px", fontWeight: "600", fontStyle: "italic", textTransform: "uppercase", display: "flex", justifyContent: "space-between", gap: "4px" }}>
                                        <span>• {t.titulo_documento}</span>
                                        <span style={{ fontSize: "5.5px", opacity: 0.7, flexShrink: 0 }}>
                                          ({[t.formato?.papel && 'F', t.formato?.electronico && 'E'].filter(Boolean).join('/')})
                                        </span>
                                      </div>
                                    ))
                                  : row.tipoDocumental?.split(",").map((t, i) => (
                                      <span key={i} style={{ fontSize: isLandscape ? "7px" : "6px", fontWeight: "600", fontStyle: "italic", textTransform: "uppercase" }}>
                                        • {t.trim()}
                                      </span>
                                    ))
                                }
                              </div>
                            </div>
                          )}
                        </td>

                        {/* SF — Soporte Físico */}
                        <td style={TDC}>{row.soporteFisico !== false ? <Check style={{ width: "10px", height: "10px", margin: "0 auto", display: "block" }} /> : ""}</td>
                        {/* SE — Soporte Electrónico */}
                        <td style={TDC}>{row.soporteElectronico ? <Check style={{ width: "10px", height: "10px", margin: "0 auto", display: "block" }} /> : ""}</td>

                        {/* Retención */}
                        <td style={{ ...TDC, fontWeight: "900" }}>{row.retencionGestion}</td>
                        <td style={{ ...TDC, fontWeight: "900" }}>{row.retencionCentral}</td>

                        {/* Disposición Final */}
                        <td style={TDC}>{row.dispCT ? <Check style={{ width: "10px", height: "10px", margin: "0 auto", display: "block" }} /> : ""}</td>
                        <td style={TDC}>{row.dispE  ? <Check style={{ width: "10px", height: "10px", margin: "0 auto", display: "block" }} /> : ""}</td>
                        <td style={TDC}>{row.dispS  ? <Check style={{ width: "10px", height: "10px", margin: "0 auto", display: "block" }} /> : ""}</td>
                        <td style={TDC}>{row.dispMT ? <Check style={{ width: "10px", height: "10px", margin: "0 auto", display: "block" }} /> : ""}</td>

                        {/* Criterio Disposición Final */}
                        <td style={{ ...TD, padding: "4px 5px", fontSize: isLandscape ? "6.5px" : "5.5px", fontStyle: "italic" }}>
                          {row.criterio || ""}
                        </td>

                        {/* Sistema de Clasificación */}
                        <td style={{ ...TD, padding: "4px 5px", fontSize: isLandscape ? "6.5px" : "5.5px", textAlign: "center", verticalAlign: "middle" }}>
                          {"Funcional"}
                        </td>

                        {/* Sistema de Ordenación */}
                        <td style={{ ...TD, padding: "4px 5px", fontSize: isLandscape ? "6.5px" : "5.5px", textAlign: "center", verticalAlign: "middle" }}>
                          {row.sistemaOrdenacion || ""}
                        </td>

                        {/* Procedimiento */}
                        <td style={{ ...TD, padding: "6px 8px", textAlign: "justify", lineHeight: "12px", fontWeight: "500", whiteSpace: "pre-wrap" }}>
                          {row.procedimiento || ""}
                          {row.actoAdmo ? (
                            <div style={{ marginTop: "4px", fontSize: isLandscape ? "6.5px" : "5.5px", fontStyle: "italic", color: "#475569" }}>
                              Acto Admo.: {row.actoAdmo}
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* ── Sección de firmas (Acuerdo 001/2024) ── */}
              <table style={{ borderCollapse: "collapse", width: "100%", marginTop: "32px", fontSize: "7px", textTransform: "uppercase", fontWeight: "700", border: BD }}>
                <tbody>
                  <tr>
                    {[
                      { label: "Elaboró", sublabel: "" },
                      { label: "Revisó",  sublabel: "" },
                      { label: "Aprobó",  sublabel: "" },
                    ].map(({ label }) => (
                      <td key={label} style={{ border: BD, padding: "0", width: "33.33%" }}>
                        <div style={{ borderBottom: BD, padding: "3px 8px", background: "#f1f5f9", fontWeight: "900", textAlign: "center" }}>{label}</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "0" }}>
                          {["Nombre", "Cargo", "Firma", "Fecha"].map(f => (
                            <div key={f} style={{ borderBottom: f !== "Fecha" ? BD : "none", display: "flex", gap: "6px", padding: "3px 8px", minHeight: f === "Firma" ? "28px" : "auto" }}>
                              <span style={{ fontWeight: "900", flexShrink: 0 }}>{f}:</span>
                            </div>
                          ))}
                        </div>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>

              {/* ── Pie de página ── */}
              <div style={{ marginTop: "10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "5.5px", color: "#94a3b8", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.15em" }}>
                  Generado con OSE IA — {new Date().getFullYear()}
                </span>
                <span style={{ fontSize: "5.5px", color: "#94a3b8", fontWeight: "bold", textTransform: "uppercase" }}>
                  Conforme Acuerdo 001 de 2024 — AGN Colombia
                </span>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
}
