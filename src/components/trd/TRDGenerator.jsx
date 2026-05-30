import React from "react";
import { FileText, Download, Info } from "lucide-react";

/**
 * TRDGenerator — Formato Oficial Acuerdo 001 de 2024 — Archivo General de la Nación — Colombia
 *
 * Props:
 *  rows                        : filas TRD (de trdRows en App.jsx)
 *  selectedIds                 : Set de IDs seleccionados (vacío = mostrar todo)
 *  currentEntity               : objeto entidad actual
 *  logoBase64                  : logo en base64
 *  orientation                 : 'portrait' | 'landscape'
 *  onExportPDF                 : callback "Descargar TRD"
 *  availableDependencias       : dependencias disponibles para filtrado
 *  selectedPrintDependencias
 *  onSelectDependencia
 */
export default function TRDGenerator({
  rows = [],
  selectedIds = new Set(),
  currentEntity,
  logoBase64,
  orientation = "landscape",
  onExportPDF,
  availableDependencias = [],
  selectedPrintDependencias = ["TODAS"],
  onSelectDependencia = () => {},
}) {
  const isLandscape = orientation === "landscape";

  const handleDepChange = (e) => {
    const value = e.target.value;
    if (value === "TODAS") { onSelectDependencia(["TODAS"]); return; }
    let current = [...selectedPrintDependencias];
    if (current.includes("TODAS")) current = [];
    if (current.includes(value)) current = current.filter((d) => d !== value);
    else current.push(value);
    onSelectDependencia(current.length === 0 ? ["TODAS"] : current);
  };

  const exportRows =
    selectedIds instanceof Set && selectedIds.size > 0
      ? rows.filter((r) => selectedIds.has(r.id))
      : rows;

  if (exportRows.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center min-h-[400px] p-12 text-muted-foreground bg-white rounded-2xl border border-dashed"
        style={{ borderColor: "#334155" }}
      >
        <FileText className="h-10 w-10 text-slate-400 mb-4" />
        <p className="font-bold text-slate-800 text-lg">Tabla de Retención Vacía</p>
        <p className="text-sm mt-2 max-w-sm text-center text-slate-500 font-medium">
          Completa la valoración técnica de las series en "Valoración TRD" para generar el reporte.
        </p>
      </div>
    );
  }

  // ── Datos institucionales ─────────────────────────────────────────────────
  const entityName  = currentEntity?.razonSocial || currentEntity?.nombre || "ENTIDAD PRODUCTORA";
  const logoSrc     = logoBase64 || currentEntity?.logoUrl;
  const fechaHoy    = new Date().toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
  const pageWidth   = isLandscape ? "max-w-[277mm]" : "max-w-[210mm]";

  // ── Estilos base ──────────────────────────────────────────────────────────
  const BD    = "1px solid #000";
  const BASE  = { fontFamily: "Arial, Helvetica, sans-serif", borderCollapse: "collapse", width: "100%" };

  // Celda cabecera
  const TH = (extra = {}) => ({
    border: BD,
    textAlign: "center",
    verticalAlign: "middle",
    padding: "2px 3px",
    fontWeight: "bold",
    textTransform: "uppercase",
    fontSize: isLandscape ? "6.5px" : "6px",
    lineHeight: "1.3",
    backgroundColor: "#d9d9d9",
    ...extra,
  });

  // Celda dato centrada
  const TDC = (extra = {}) => ({
    border: BD,
    textAlign: "center",
    verticalAlign: "middle",
    padding: "2px 2px",
    fontSize: isLandscape ? "8px" : "7px",
    ...extra,
  });

  // Celda dato texto
  const TDT = (extra = {}) => ({
    border: BD,
    verticalAlign: "top",
    padding: "4px 6px",
    fontSize: isLandscape ? "8px" : "7px",
    lineHeight: "1.35",
    ...extra,
  });

  // ── Anchos de columna ─────────────────────────────────────────────────────
  // Total columnas: 14
  // CÓDIGO | SERIES/SUBSERIES/TIPOS | SF | SE | A.G | A.C | CT | E | S | MT | CRITERIO | CLASIF | ORDEN | PROCEDIMIENTO
  const colWidths = isLandscape
    ? ["7%", "22%", "2.5%", "2.5%", "3%", "3%", "2.5%", "2.5%", "2.5%", "2.5%", "9%", "7%", "7%", ""]
    : ["7%", "22%", "2.5%", "2.5%", "3%", "3%", "2.5%", "2.5%", "2.5%", "2.5%", "9%", "7%", "7%", ""];

  // ── Agrupación por dependencia ────────────────────────────────────────────
  const groupedByDep = React.useMemo(() => {
    const g = {};
    exportRows.forEach((row) => {
      const k = row.dependencia || "OFICINA PRODUCTORA";
      if (!g[k]) g[k] = { rows: [], codigoD: row.codigoD || "" };
      g[k].rows.push(row);
    });
    return g;
  }, [exportRows]);

  const depGroups = Object.entries(groupedByDep);

  // ── Agrupa filas de una dependencia por serie ─────────────────────────────
  const groupBySerie = (rows) => {
    const g = {};
    rows.forEach((row) => {
      const k = row.serieId || row.serie;
      if (!g[k]) g[k] = { serie: row.serie, codigoS: row.codigoS || "", codigoD: row.codigoD || "", rows: [] };
      g[k].rows.push(row);
    });
    return Object.values(g);
  };

  // ── Marca X para disposición ──────────────────────────────────────────────
  const X = (val) =>
    val ? (
      <span style={{ fontWeight: "bold", fontSize: "9px" }}>X</span>
    ) : null;

  // ── Ordena sistemas de ordenación ─────────────────────────────────────────
  const fmtOrden = (row) => row.sistemaOrdenacion || "";
  const fmtClasif = () => "Funcional";

  return (
    <div className="flex flex-col gap-6 bg-slate-50 min-h-full pb-20">

      {/* ── Barra de acción ── */}
      <div
        className="flex items-center justify-between p-4 bg-white border-b sticky top-0 z-10 print:hidden shadow-sm"
        style={{ borderColor: "#334155" }}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-50">
            <FileText className="h-5 w-5 text-red-700" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight">
              Reporte TRD — Acuerdo 001 de 2024 AGN
            </h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              Orientación:{" "}
              <span className="text-slate-700">{isLandscape ? "Horizontal" : "Vertical"}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
              Dependencias a imprimir
            </span>
            <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5">
              <select
                value={
                  selectedPrintDependencias.length === 1 && !selectedPrintDependencias.includes("TODAS")
                    ? selectedPrintDependencias[0]
                    : ""
                }
                onChange={handleDepChange}
                className="text-[11px] font-bold bg-transparent text-slate-700 outline-none w-52 truncate cursor-pointer"
              >
                <option value="TODAS">— TODAS LAS DEPENDENCIAS —</option>
                {availableDependencias.map((dep) => (
                  <option key={dep} value={dep}>
                    {selectedPrintDependencias.includes(dep) ? "✓ " : ""}
                    {dep}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 self-end">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold text-slate-600 border border-slate-300 bg-white">
              <Info className="h-3.5 w-3.5" />
              {selectedIds.size > 0
                ? `${selectedIds.size} seleccionados`
                : `Mostrando: ${selectedPrintDependencias.includes("TODAS") ? "Todo" : selectedPrintDependencias.length + " dependencias"}`}
            </div>
            {onExportPDF && (
              <button
                onClick={onExportPDF}
                disabled={exportRows.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg text-xs font-black transition-all shadow-lg active:scale-95 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                DESCARGAR PDF
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Páginas de la TRD ── */}
      <div
        id="trd-capture-frame"
        className="flex flex-col gap-12 print:block print:p-0 print:m-0 print:w-full print:flex-none"
        style={{ padding: isLandscape ? "20px 16px" : "32px 24px", backgroundColor: "#f1f5f9" }}
      >
        {depGroups.map(([depName, depData], groupIdx) => {
          const serieGroups = groupBySerie(depData.rows);
          const codigoUnidad = depData.codigoD || "";
          const totalPages = depGroups.length;

          return (
            <div
              key={depName}
              id={`trd-report-section-${groupIdx}`}
              className={`bg-white flex flex-col font-sans shadow-2xl w-full ${pageWidth} print:shadow-none print:border-0 print:m-0 print:w-full print:max-w-none page-break-after-always`}
              style={{ margin: "0 auto" }}
            >
              <table style={{ ...BASE, border: BD }}>
                <colgroup>
                  {colWidths.map((w, i) => (
                    <col key={i} style={w ? { width: w } : {}} />
                  ))}
                </colgroup>

                <thead>
                  {/* ════ FILA 1: Encabezado institucional ════ */}
                  <tr>
                    {/* Logo / Escudo */}
                    <td
                      colSpan={2}
                      style={{
                        border: BD,
                        textAlign: "center",
                        verticalAlign: "middle",
                        padding: "6px 8px",
                        width: "29%",
                      }}
                    >
                      {logoSrc ? (
                        <img
                          src={logoSrc}
                          alt="Escudo"
                          style={{ height: "48px", objectFit: "contain", display: "block", margin: "0 auto" }}
                          crossOrigin="anonymous"
                        />
                      ) : (
                        <div
                          style={{
                            width: "48px",
                            height: "48px",
                            border: "2px solid #000",
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            margin: "0 auto",
                            fontSize: "8px",
                            fontWeight: "bold",
                            color: "#555",
                            textAlign: "center",
                            lineHeight: "1.2",
                          }}
                        >
                          LOGO
                        </div>
                      )}
                    </td>

                    {/* Título central */}
                    <td
                      colSpan={11}
                      style={{
                        border: BD,
                        textAlign: "center",
                        verticalAlign: "middle",
                        padding: "8px 12px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: isLandscape ? "14px" : "11px",
                          fontWeight: "bold",
                          textTransform: "uppercase",
                          letterSpacing: "0.08em",
                          color: "#000",
                        }}
                      >
                        Tabla de Retención Documental
                      </div>
                    </td>

                    {/* Código / Versión / Fecha */}
                    <td
                      style={{
                        border: BD,
                        padding: 0,
                        verticalAlign: "top",
                        fontSize: "7px",
                        fontWeight: "bold",
                        minWidth: "80px",
                      }}
                    >
                      <div
                        style={{
                          borderBottom: BD,
                          padding: "3px 6px",
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "4px",
                        }}
                      >
                        <span style={{ fontWeight: "bold", textTransform: "uppercase" }}>Código:</span>
                        <span>TRD-001</span>
                      </div>
                      <div
                        style={{
                          borderBottom: BD,
                          padding: "3px 6px",
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "4px",
                        }}
                      >
                        <span style={{ fontWeight: "bold", textTransform: "uppercase" }}>Versión:</span>
                        <span>01</span>
                      </div>
                      <div style={{ padding: "3px 6px", display: "flex", justifyContent: "space-between", gap: "4px" }}>
                        <span style={{ fontWeight: "bold", textTransform: "uppercase" }}>Fecha:</span>
                        <span>{fechaHoy}</span>
                      </div>
                    </td>
                  </tr>

                  {/* ════ FILA 2: Datos de la entidad ════ */}
                  <tr>
                    <td colSpan={14} style={{ border: BD, padding: "4px 8px" }}>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1.4fr 1.4fr 0.8fr 0.6fr",
                          gap: "2px 20px",
                          fontSize: "7.5px",
                        }}
                      >
                        <div style={{ display: "flex", gap: "4px" }}>
                          <span style={{ fontWeight: "bold", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                            Entidad Productora:
                          </span>
                          <span style={{ fontWeight: "bold", textTransform: "uppercase", color: "#000" }}>
                            {entityName}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: "4px" }}>
                          <span style={{ fontWeight: "bold", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                            Unidad Administrativa:
                          </span>
                          <span style={{ fontWeight: "bold", textTransform: "uppercase", color: "#000" }}>
                            {depName}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: "4px" }}>
                          <span style={{ fontWeight: "bold", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                            Código:
                          </span>
                          <span style={{ fontWeight: "bold", color: "#000" }}>{codigoUnidad}</span>
                        </div>
                        <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                          <span style={{ fontWeight: "bold", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                            Hoja N.º:
                          </span>
                          <span style={{ fontWeight: "bold" }}>
                            {groupIdx + 1} de {totalPages}
                          </span>
                        </div>
                      </div>
                    </td>
                  </tr>

                  {/* ════ FILA 3: Cabeceras principales ════ */}
                  <tr>
                    <th rowSpan={2} style={TH()}>CÓDIGO</th>
                    <th rowSpan={2} style={{ ...TH(), textAlign: "left", padding: "3px 6px" }}>
                      SERIES DOCUMENTALES, SUBSERIES DOCUMENTALES Y TIPOS DOCUMENTALES
                    </th>
                    <th colSpan={2} style={TH()}>SOPORTE</th>
                    <th colSpan={2} style={TH()}>
                      TIEMPO DE RETENCIÓN EN AÑOS
                    </th>
                    <th colSpan={4} style={TH()}>DISPOSICIÓN FINAL</th>
                    <th rowSpan={2} style={TH({ fontSize: isLandscape ? "6px" : "5.5px" })}>
                      CRITERIO DISPOSICIÓN FINAL
                    </th>
                    <th rowSpan={2} style={TH({ fontSize: isLandscape ? "6px" : "5.5px" })}>
                      SISTEMA DE CLASIFICACIÓN DOCUMENTAL
                    </th>
                    <th rowSpan={2} style={TH({ fontSize: isLandscape ? "6px" : "5.5px" })}>
                      SISTEMA DE ORDENACIÓN DOCUMENTAL
                    </th>
                    <th rowSpan={2} style={TH()}>PROCEDIMIENTO</th>
                  </tr>

                  {/* ════ FILA 4: Sub-cabeceras ════ */}
                  <tr>
                    <th style={TH()}>SF</th>
                    <th style={TH()}>SE</th>
                    <th style={TH()}>A.G</th>
                    <th style={TH()}>A.C</th>
                    <th style={TH()}>CT</th>
                    <th style={TH()}>E</th>
                    <th style={TH()}>S</th>
                    <th style={TH()}>MT</th>
                  </tr>
                </thead>

                {/* ════ CUERPO ════ */}
                <tbody>
                  {serieGroups.map((sg) => {
                    const hasSubseries = sg.rows.some((r) => r.subserieId && r.codigoSub);
                    const serieCode = [sg.codigoD, sg.codigoS].filter(Boolean).join(".");

                    return (
                      <React.Fragment key={sg.serie}>
                        {/* ── Fila de SERIE ── */}
                        <tr style={{ backgroundColor: hasSubseries ? "#f0f0f0" : "#fff" }}>
                          {/* Código */}
                          <td style={TDC({ fontWeight: "bold", fontSize: isLandscape ? "7.5px" : "6.5px" })}>
                            {serieCode}
                          </td>

                          {/* Nombre de la Serie */}
                          <td style={TDT({ fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.01em" })}>
                            {sg.serie}
                            {/* Si la serie no tiene subseries, listar tipos documentales aquí */}
                            {!hasSubseries && sg.rows[0]?.tiposDocumentales?.length > 0 && (
                              <div style={{ borderLeft: "1.5px solid #000", marginLeft: "4px", paddingLeft: "6px", marginTop: "3px", display: "flex", flexDirection: "column", gap: "2px" }}>
                                {sg.rows[0].tiposDocumentales.map((t, i) => (
                                  <div
                                    key={i}
                                    style={{ fontSize: isLandscape ? "7px" : "6px", fontStyle: "italic", fontWeight: "normal", textTransform: "none" }}
                                  >
                                    — {t.titulo_documento}
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>

                          {/* Si no tiene subseries → mostrar retención y disposición en la fila de serie */}
                          {!hasSubseries ? (
                            <>
                              <td style={TDC()}>{X(sg.rows[0]?.soporteFisico)}</td>
                              <td style={TDC()}>{X(sg.rows[0]?.soporteElectronico)}</td>
                              <td style={TDC({ fontWeight: "bold" })}>{sg.rows[0]?.retencionGestion ?? ""}</td>
                              <td style={TDC({ fontWeight: "bold" })}>{sg.rows[0]?.retencionCentral ?? ""}</td>
                              <td style={TDC()}>{X(sg.rows[0]?.dispCT)}</td>
                              <td style={TDC()}>{X(sg.rows[0]?.dispE)}</td>
                              <td style={TDC()}>{X(sg.rows[0]?.dispS)}</td>
                              <td style={TDC()}>{X(sg.rows[0]?.dispMT)}</td>
                              <td style={TDT({ fontSize: isLandscape ? "7px" : "6px", fontStyle: "italic" })}>
                                {sg.rows[0]?.criterio || ""}
                              </td>
                              <td style={TDC({ fontSize: isLandscape ? "7px" : "6px" })}>
                                {fmtClasif()}
                              </td>
                              <td style={TDC({ fontSize: isLandscape ? "7px" : "6px" })}>
                                {fmtOrden(sg.rows[0])}
                              </td>
                              <td style={TDT({ textAlign: "justify" })}>
                                {sg.rows[0]?.procedimiento || ""}
                                {sg.rows[0]?.actoAdmo && (
                                  <div style={{ marginTop: "3px", fontSize: "6.5px", fontStyle: "italic", color: "#555" }}>
                                    Acto admo.: {sg.rows[0].actoAdmo}
                                  </div>
                                )}
                              </td>
                            </>
                          ) : (
                            /* Si tiene subseries → celdas de retención/disposición vacías en la fila de serie */
                            <>
                              <td style={TDC()} />
                              <td style={TDC()} />
                              <td style={TDC()} />
                              <td style={TDC()} />
                              <td style={TDC()} />
                              <td style={TDC()} />
                              <td style={TDC()} />
                              <td style={TDC()} />
                              <td style={TDT()} />
                              <td style={TDT()} />
                              <td style={TDT()} />
                              <td style={TDT()} />
                            </>
                          )}
                        </tr>

                        {/* ── Filas de SUBSERIES ── */}
                        {hasSubseries &&
                          sg.rows.map((row, rIdx) => {
                            const subCode = [row.codigoD, row.codigoS, row.codigoSub]
                              .filter(Boolean)
                              .join(".");

                            return (
                              <tr key={row.id || rIdx} style={{ backgroundColor: "#fff" }}>
                                {/* Código subserie */}
                                <td style={TDC({ fontWeight: "bold", fontSize: isLandscape ? "7.5px" : "6.5px" })}>
                                  {subCode}
                                </td>

                                {/* Nombre subserie + tipos documentales */}
                                <td style={TDT({ paddingLeft: "14px" })}>
                                  <div style={{ fontWeight: "bold", textTransform: "uppercase", marginBottom: "3px" }}>
                                    {row.subserie}
                                  </div>
                                  {row.tiposDocumentales?.length > 0 ? (
                                    <div
                                      style={{
                                        borderLeft: "1.5px solid #000",
                                        paddingLeft: "6px",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "2px",
                                      }}
                                    >
                                      {row.tiposDocumentales.map((t, i) => (
                                        <div
                                          key={i}
                                          style={{
                                            fontSize: isLandscape ? "7px" : "6px",
                                            fontStyle: "italic",
                                            display: "flex",
                                            justifyContent: "space-between",
                                            gap: "6px",
                                          }}
                                        >
                                          <span>— {t.titulo_documento}</span>
                                          {(t.formato?.papel || t.formato?.electronico) && (
                                            <span style={{ fontSize: "6px", opacity: 0.7, flexShrink: 0 }}>
                                              ({[t.formato?.papel && "F", t.formato?.electronico && "E"]
                                                .filter(Boolean)
                                                .join("/")})
                                            </span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  ) : row.tipoDocumental ? (
                                    <div
                                      style={{
                                        borderLeft: "1.5px solid #000",
                                        paddingLeft: "6px",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "1px",
                                      }}
                                    >
                                      {row.tipoDocumental.split(",").map((t, i) => (
                                        <div
                                          key={i}
                                          style={{ fontSize: isLandscape ? "7px" : "6px", fontStyle: "italic" }}
                                        >
                                          — {t.trim()}
                                        </div>
                                      ))}
                                    </div>
                                  ) : null}
                                </td>

                                {/* Soporte */}
                                <td style={TDC()}>{X(row.soporteFisico)}</td>
                                <td style={TDC()}>{X(row.soporteElectronico)}</td>

                                {/* Retención */}
                                <td style={TDC({ fontWeight: "bold" })}>{row.retencionGestion ?? ""}</td>
                                <td style={TDC({ fontWeight: "bold" })}>{row.retencionCentral ?? ""}</td>

                                {/* Disposición Final */}
                                <td style={TDC()}>{X(row.dispCT)}</td>
                                <td style={TDC()}>{X(row.dispE)}</td>
                                <td style={TDC()}>{X(row.dispS)}</td>
                                <td style={TDC()}>{X(row.dispMT)}</td>

                                {/* Criterio */}
                                <td style={TDT({ fontSize: isLandscape ? "7px" : "6px", fontStyle: "italic" })}>
                                  {row.criterio || ""}
                                </td>

                                {/* Clasificación */}
                                <td style={TDC({ fontSize: isLandscape ? "7px" : "6px" })}>
                                  {fmtClasif()}
                                </td>

                                {/* Ordenación */}
                                <td style={TDC({ fontSize: isLandscape ? "7px" : "6px" })}>
                                  {fmtOrden(row)}
                                </td>

                                {/* Procedimiento */}
                                <td style={TDT({ textAlign: "justify" })}>
                                  {row.procedimiento || ""}
                                  {row.actoAdmo && (
                                    <div style={{ marginTop: "3px", fontSize: "6.5px", fontStyle: "italic", color: "#555" }}>
                                      Acto admo.: {row.actoAdmo}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>

              {/* ════ BLOQUE DE FIRMAS (Acuerdo 001/2024) ════ */}
              <table
                style={{
                  ...BASE,
                  marginTop: "20px",
                  fontSize: "7.5px",
                  border: BD,
                }}
              >
                <tbody>
                  <tr>
                    {["Elaboró", "Revisó", "Aprobó"].map((label) => (
                      <td
                        key={label}
                        style={{ border: BD, padding: 0, width: "33.33%", verticalAlign: "top" }}
                      >
                        {/* Título sección */}
                        <div
                          style={{
                            borderBottom: BD,
                            padding: "3px 8px",
                            backgroundColor: "#d9d9d9",
                            fontWeight: "bold",
                            textAlign: "center",
                            textTransform: "uppercase",
                            fontSize: "7.5px",
                          }}
                        >
                          {label}
                        </div>
                        {/* Campos */}
                        {[
                          { key: "Nombre", height: "auto" },
                          { key: "Cargo", height: "auto" },
                          { key: "Firma", height: "30px" },
                          { key: "Fecha", height: "auto" },
                        ].map(({ key, height }, i, arr) => (
                          <div
                            key={key}
                            style={{
                              borderBottom: i < arr.length - 1 ? BD : "none",
                              display: "flex",
                              gap: "6px",
                              padding: "3px 8px",
                              minHeight: height,
                              alignItems: "flex-start",
                              fontSize: "7px",
                            }}
                          >
                            <span style={{ fontWeight: "bold", flexShrink: 0 }}>{key}:</span>
                          </div>
                        ))}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>

              {/* ════ PIE DE PÁGINA ════ */}
              <div
                style={{
                  marginTop: "6px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "6px",
                  color: "#666",
                  fontWeight: "bold",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                }}
              >
                <span>Generado con OSE IA — {new Date().getFullYear()}</span>
                <span>Acuerdo 001 de 2024 — Archivo General de la Nación — Colombia</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
