import React from "react";
import { FileText, Download, Info, ZoomIn, ZoomOut, RotateCcw, ChevronDown } from "lucide-react";

/**
 * TRDGenerator — Formato Oficial Acuerdo 001 de 2024
 * Archivo General de la Nación — Colombia
 * Ref: Acuerdo No. 001 del 29 de febrero de 2024, página 143
 *
 * Columnas oficiales:
 *   CÓDIGO | SERIES, SUBSERIES Y TIPOS DOCUMENTALES
 *   | SOPORTE o FORMATO (Papel / Electrónico (extensión))
 *   | RETENCIÓN (Archivo de Gestión / Archivo Central)
 *   | DISPOSICIÓN FINAL (C / S / E)
 *   | REPRODUCCIÓN TÉCNICA DEL PAPEL (M/D)
 *   | SERIE DE DDHH/DIH
 *   | PROCEDIMIENTO
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
  const [zoom, setZoom] = React.useState(100);
  const ZOOM_STEP = 10;
  const ZOOM_MIN  = 50;
  const ZOOM_MAX  = 150;

  const [depDropdownOpen, setDepDropdownOpen] = React.useState(false);
  const depDropdownRef = React.useRef(null);

  React.useEffect(() => {
    if (!depDropdownOpen) return;
    const handle = (e) => {
      if (depDropdownRef.current && !depDropdownRef.current.contains(e.target))
        setDepDropdownOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [depDropdownOpen]);

  const toggleDep = (dep) => {
    let current = selectedPrintDependencias.includes("TODAS") ? [] : [...selectedPrintDependencias];
    if (current.includes(dep)) current = current.filter((d) => d !== dep);
    else current.push(dep);
    onSelectDependencia(current.length === 0 ? ["TODAS"] : current);
  };

  const exportRows =
    selectedIds instanceof Set && selectedIds.size > 0
      ? rows.filter((r) => selectedIds.has(r.id))
      : rows;

  // ── Agrupación por dependencia → serie ───────────────────────────────────
  const groupedByDep = React.useMemo(() => {
    const g = {};
    exportRows.forEach((row) => {
      const k = row.dependencia || "OFICINA PRODUCTORA";
      if (!g[k]) g[k] = { rows: [], codigoD: row.codigoD || "" };
      g[k].rows.push(row);
    });
    return g;
  }, [exportRows]);

  if (exportRows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-12 text-muted-foreground bg-white rounded-2xl border border-dashed border-slate-400">
        <FileText className="h-10 w-10 text-slate-400 mb-4" />
        <p className="font-bold text-slate-800 text-lg">Tabla de Retención Vacía</p>
        <p className="text-sm mt-2 max-w-sm text-center text-slate-500">
          Completa la valoración técnica de las series en "Valoración TRD" para generar el reporte.
        </p>
      </div>
    );
  }

  // ── Datos institucionales ────────────────────────────────────────────────
  const entityName = currentEntity?.razonSocial || currentEntity?.nombre || "";
  const logoSrc    = logoBase64 || currentEntity?.logoUrl;
  const fechaHoy   = new Date().toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
  const pageWidth  = isLandscape ? "277mm" : "210mm";

  // ── Estilos tabla ─────────────────────────────────────────────────────────
  const BD  = "1px solid #000";
  const fSz = isLandscape ? "7.5px" : "6.5px";     // datos
  const fHd = isLandscape ? "6.5px" : "5.5px";     // cabeceras

  const cellBase = {
    border: BD,
    fontFamily: "Arial, Helvetica, sans-serif",
    fontSize: fSz,
    lineHeight: "1.3",
  };

  // Cabecera (TH)
  const th = (extra = {}) => ({
    ...cellBase,
    fontSize: fHd,
    fontWeight: "bold",
    textAlign: "center",
    verticalAlign: "middle",
    padding: "3px 3px",
    textTransform: "uppercase",
    backgroundColor: "#e8e8e8",
    ...extra,
  });

  // Celda centrada (check / número)
  const tdc = (extra = {}) => ({
    ...cellBase,
    textAlign: "center",
    verticalAlign: "middle",
    padding: "2px 2px",
    ...extra,
  });

  // Celda texto
  const tdt = (extra = {}) => ({
    ...cellBase,
    verticalAlign: "top",
    padding: "4px 5px",
    ...extra,
  });

  // ── Helpers ───────────────────────────────────────────────────────────────

  // Marca "X" oficial para celdas booleanas
  const X = (val) => val
    ? <span style={{ fontWeight: "bold", fontSize: "9px", display: "block", textAlign: "center" }}>X</span>
    : null;

  // Valor para la columna REPRODUCCIÓN TÉCNICA DEL PAPEL (M/D)
  const repValue = (row) => {
    const r = row.reproduccion || "";
    if (r === "Digitalización") return "D";
    if (r === "Microfilmación")  return "M";
    // Ambas
    if (row.dispMT && r === "Ninguna") return "";
    return "";
  };

  const depGroups = Object.entries(groupedByDep);

  // Agrupa las filas de una dependencia por serieId
  const groupBySerie = (depRows) => {
    const map = {};
    depRows.forEach((row) => {
      const k = row.serieId || row.serie;
      if (!map[k]) map[k] = { serie: row.serie, codigoS: row.codigoS || "", codigoD: row.codigoD || "", rows: [] };
      map[k].rows.push(row);
    });
    return Object.values(map);
  };

  // ── Tabla principal ───────────────────────────────────────────────────────
  // 12 columnas totales:
  // [1] CÓDIGO
  // [2] SERIES, SUBSERIES Y TIPOS DOCUMENTALES
  // [3] Papel
  // [4] Electrónico (extensión)
  // [5] Archivo de Gestión
  // [6] Archivo Central
  // [7] C
  // [8] S
  // [9] E
  // [10] REPRODUCCIÓN TÉCNICA DEL PAPEL (M/D)
  // [11] SERIE DE DDHH/DIH
  // [12] PROCEDIMIENTO

  const colWidths = isLandscape
    ? ["6%", "22%", "3.5%", "4%", "5%", "5%", "3%", "3%", "3%", "5%", "4%", ""]
    : ["6%", "22%", "3.5%", "4%", "5%", "5%", "3%", "3%", "3%", "5%", "4%", ""];

  return (
    <div className="flex flex-col gap-6 bg-slate-100 min-h-full pb-20">

      {/* ── Barra de acción ── */}
      <div className="flex items-center justify-between p-4 bg-white border-b border-slate-300 sticky top-0 z-10 print:hidden shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-red-50">
            <FileText className="h-5 w-5 text-red-700" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight">
              Reporte TRD — Acuerdo 001 de 2024 AGN
            </h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
              Orientación: <span className="text-slate-700">{isLandscape ? "Horizontal" : "Vertical"}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex flex-col gap-1 relative" ref={depDropdownRef}>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
              Dependencias a imprimir
            </span>
            <button
              onClick={() => setDepDropdownOpen((o) => !o)}
              className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 w-56 hover:bg-slate-100 transition-colors"
            >
              <span className="flex-1 text-left text-[11px] font-bold text-slate-700 truncate">
                {selectedPrintDependencias.includes("TODAS")
                  ? "— TODAS —"
                  : `${selectedPrintDependencias.length} seleccionada(s)`}
              </span>
              <ChevronDown className={`h-3.5 w-3.5 text-slate-500 shrink-0 transition-transform duration-150 ${depDropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {depDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-72 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-1 max-h-72 overflow-y-auto">
                {/* Opción "Todas" */}
                <label className="flex items-center gap-2.5 px-3 py-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100">
                  <input
                    type="checkbox"
                    checked={selectedPrintDependencias.includes("TODAS")}
                    onChange={() => onSelectDependencia(["TODAS"])}
                    className="accent-red-600 h-3.5 w-3.5"
                  />
                  <span className="text-[11px] font-black text-slate-700 uppercase tracking-wide">
                    Todas las dependencias
                  </span>
                </label>

                {availableDependencias.map((dep) => (
                  <label key={dep} className="flex items-center gap-2.5 px-3 py-1.5 hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedPrintDependencias.includes(dep)}
                      onChange={() => toggleDep(dep)}
                      className="accent-red-600 h-3.5 w-3.5 shrink-0"
                    />
                    <span className="text-[11px] text-slate-700 leading-tight">{dep}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* ── Zoom ── */}
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Zoom</span>
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
              <button
                onClick={() => setZoom(z => Math.max(ZOOM_MIN, z - ZOOM_STEP))}
                disabled={zoom <= ZOOM_MIN}
                className="p-1 rounded hover:bg-slate-200 text-slate-600 disabled:opacity-30 transition-colors"
                title="Reducir"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <span className="w-10 text-center text-[11px] font-black text-slate-700 select-none">
                {zoom}%
              </span>
              <button
                onClick={() => setZoom(z => Math.min(ZOOM_MAX, z + ZOOM_STEP))}
                disabled={zoom >= ZOOM_MAX}
                className="p-1 rounded hover:bg-slate-200 text-slate-600 disabled:opacity-30 transition-colors"
                title="Ampliar"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setZoom(100)}
                disabled={zoom === 100}
                className="p-1 rounded hover:bg-slate-200 text-slate-500 disabled:opacity-30 transition-colors"
                title="Restablecer zoom"
              >
                <RotateCcw className="h-3 w-3" />
              </button>
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

      {/* ── Páginas TRD ── */}
      <div style={{ overflow: "auto" }}>
      <div
        id="trd-capture-frame"
        className="flex flex-col gap-10 print:block print:p-0 print:m-0"
        style={{
          padding: isLandscape ? "16px 12px" : "28px 20px",
          transform: `scale(${zoom / 100})`,
          transformOrigin: "top center",
          transition: "transform 0.15s ease",
          marginBottom: `${(zoom - 100) * -0.5}%`,
        }}
      >
        {depGroups.map(([depName, depData], groupIdx) => {
          const serieGroups = groupBySerie(depData.rows);

          return (
            <div
              key={depName}
              id={`trd-report-section-${groupIdx}`}
              className="bg-white shadow-xl print:shadow-none print:m-0 print:w-full page-break-after-always"
              style={{
                width: pageWidth,
                margin: "0 auto",
                padding: isLandscape ? "8mm 8mm" : "10mm 8mm",
                fontFamily: "Arial, Helvetica, sans-serif",
              }}
            >

              {/* ════ ENCABEZADO DEL DOCUMENTO ════ */}
              <table
                style={{ borderCollapse: "collapse", width: "100%", border: BD, marginBottom: "0" }}
              >
                <tbody>
                  <tr>
                    {/* Logo / escudo */}
                    <td
                      style={{
                        border: BD,
                        width: "18%",
                        textAlign: "center",
                        verticalAlign: "middle",
                        padding: "6px 8px",
                      }}
                    >
                      {logoSrc ? (
                        <img
                          src={logoSrc}
                          alt="Escudo"
                          style={{ height: "52px", objectFit: "contain", display: "block", margin: "0 auto" }}
                          crossOrigin="anonymous"
                        />
                      ) : (
                        <div
                          style={{
                            width: "52px", height: "52px",
                            border: "1.5px solid #888",
                            borderRadius: "50%",
                            display: "flex", alignItems: "center", justifyContent: "center",
                            margin: "0 auto",
                            fontSize: "7px", color: "#666",
                            fontFamily: "Arial, sans-serif",
                          }}
                        >
                          LOGO
                        </div>
                      )}
                    </td>

                    {/* Título central */}
                    <td
                      style={{
                        border: BD,
                        textAlign: "center",
                        verticalAlign: "middle",
                        padding: "10px 16px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: isLandscape ? "13px" : "10px",
                          fontWeight: "bold",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          fontFamily: "Arial, Helvetica, sans-serif",
                        }}
                      >
                        Formato de Tabla de Retención Documental - TRD
                      </div>
                    </td>

                    {/* Hoja */}
                    <td
                      style={{
                        border: BD,
                        width: "12%",
                        textAlign: "center",
                        verticalAlign: "middle",
                        padding: "6px 8px",
                        fontSize: "7px",
                        fontFamily: "Arial, sans-serif",
                      }}
                    >
                      <div style={{ fontWeight: "bold", textTransform: "uppercase", marginBottom: "2px" }}>
                        Hoja N.°
                      </div>
                      <div style={{ fontSize: "9px", fontWeight: "bold" }}>
                        {groupIdx + 1} de {depGroups.length}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* ════ DATOS DE LA ENTIDAD ════ */}
              <table
                style={{ borderCollapse: "collapse", width: "100%", borderTop: "none", border: BD, marginTop: "-1px" }}
              >
                <tbody>
                  <tr>
                    <td style={{ border: BD, padding: "4px 8px", fontSize: "8px", fontFamily: "Arial, sans-serif" }}>
                      <span style={{ fontWeight: "bold", textTransform: "uppercase" }}>Entidad Productora: </span>
                      <span style={{ textTransform: "uppercase" }}>{entityName}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style={{ border: BD, padding: "4px 8px", fontSize: "8px", fontFamily: "Arial, sans-serif" }}>
                      <span style={{ fontWeight: "bold", textTransform: "uppercase" }}>Oficina Productora: </span>
                      <span style={{ textTransform: "uppercase" }}>{depName}</span>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* ════ TABLA PRINCIPAL ════ */}
              <table
                style={{
                  borderCollapse: "collapse",
                  width: "100%",
                  tableLayout: "fixed",
                  fontFamily: "Arial, Helvetica, sans-serif",
                  border: BD,
                  marginTop: "-1px",
                }}
              >
                <colgroup>
                  {colWidths.map((w, i) => (
                    <col key={i} style={w ? { width: w } : {}} />
                  ))}
                </colgroup>

                <thead>
                  {/* ── Fila cabeceras principales ── */}
                  <tr>
                    <th rowSpan={2} style={th()}>CÓDIGO</th>
                    <th rowSpan={2} style={th({ textAlign: "left", padding: "3px 5px" })}>
                      SERIES, SUBSERIES Y TIPOS DOCUMENTALES
                    </th>
                    <th colSpan={2} style={th()}>SOPORTE o FORMATO</th>
                    <th colSpan={2} style={th()}>RETENCIÓN</th>
                    <th colSpan={3} style={th()}>DISPOSICIÓN FINAL</th>
                    <th rowSpan={2} style={th({ fontSize: isLandscape ? "5px" : "4.5px" })}>
                      REPRODUCCIÓN<br />TÉCNICA DEL<br />PAPEL (M/D)
                    </th>
                    <th rowSpan={2} style={th({ fontSize: fHd })}>
                      SERIE DE<br />DDHH/DIH
                    </th>
                    <th rowSpan={2} style={th()}>PROCEDIMIENTO</th>
                  </tr>

                  {/* ── Fila sub-cabeceras ── */}
                  <tr>
                    <th style={th({ fontSize: fHd })}>Papel</th>
                    <th style={th({ fontSize: isLandscape ? "5px" : "4.5px" })}>
                      Electrónico<br />(extensión)
                    </th>
                    <th style={th({ fontSize: isLandscape ? "5.5px" : "5px" })}>
                      Archivo de<br />Gestión
                    </th>
                    <th style={th({ fontSize: isLandscape ? "5.5px" : "5px" })}>
                      Archivo<br />Central
                    </th>
                    <th style={th()}>C</th>
                    <th style={th()}>S</th>
                    <th style={th()}>E</th>
                  </tr>
                </thead>

                {/* ── CUERPO ── */}
                <tbody>
                  {serieGroups.map((sg) => {
                    const hasSubseries = sg.rows.some((r) => r.subserieId && r.codigoSub);
                    // Código de la serie: depCod.serieCod
                    const serieCode = [sg.codigoD, sg.codigoS].filter(Boolean).join(".");

                    return (
                      <React.Fragment key={sg.serie}>

                        {/* ─── Fila SERIE ─── */}
                        <tr style={{ backgroundColor: hasSubseries ? "#f5f5f5" : "#fff" }}>
                          {/* Código */}
                          <td style={tdc({ fontWeight: "bold", fontSize: isLandscape ? "7.5px" : "6.5px" })}>
                            {serieCode}
                          </td>

                          {/* Nombre serie */}
                          <td style={tdt({ fontWeight: "bold", textTransform: "uppercase" })}>
                            {sg.serie}
                            {/* Tipos documentales si la serie no tiene subseries */}
                            {!hasSubseries && sg.rows[0]?.tiposDocumentales?.length > 0 && (
                              <div style={{ marginTop: "3px", borderLeft: "1.5px solid #000", paddingLeft: "5px" }}>
                                {sg.rows[0].tiposDocumentales.map((t, i) => (
                                  <div key={i} style={{ fontSize: isLandscape ? "7px" : "6px", fontStyle: "italic", fontWeight: "normal" }}>
                                    — {t.titulo_documento}
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>

                          {hasSubseries ? (
                            // Serie con subseries: celdas de datos vacías en la fila de serie
                            <>
                              <td style={tdc()} />
                              <td style={tdc()} />
                              <td style={tdc()} />
                              <td style={tdc()} />
                              <td style={tdc()} />
                              <td style={tdc()} />
                              <td style={tdc()} />
                              <td style={tdc()} />
                              <td style={tdc()} />
                              <td style={tdt()} />
                            </>
                          ) : (
                            // Serie sin subseries: muestra datos directamente
                            <>
                              <td style={tdc()}>{X(sg.rows[0]?.soporteFisico)}</td>
                              <td style={tdc()}>{X(sg.rows[0]?.soporteElectronico)}</td>
                              <td style={tdc({ fontWeight: "bold" })}>{sg.rows[0]?.retencionGestion ?? ""}</td>
                              <td style={tdc({ fontWeight: "bold" })}>{sg.rows[0]?.retencionCentral ?? ""}</td>
                              <td style={tdc()}>{X(sg.rows[0]?.dispCT)}</td>
                              <td style={tdc()}>{X(sg.rows[0]?.dispS)}</td>
                              <td style={tdc()}>{X(sg.rows[0]?.dispE)}</td>
                              <td style={tdc({ fontWeight: "bold" })}>{repValue(sg.rows[0])}</td>
                              <td style={tdt({ fontSize: isLandscape ? "7px" : "6px", textAlign: "center", verticalAlign: "middle" })}>
                                {sg.rows[0]?.criterio || ""}
                              </td>
                              <td style={tdt({ textAlign: "justify", fontSize: isLandscape ? "7.5px" : "6.5px" })}>
                                {sg.rows[0]?.procedimiento || ""}
                                {sg.rows[0]?.actoAdmo && (
                                  <div style={{ marginTop: "3px", fontSize: "6.5px", fontStyle: "italic", color: "#444" }}>
                                    Acto administrativo:{sg.rows[0].actoAdmo}
                                  </div>
                                )}
                              </td>
                            </>
                          )}
                        </tr>

                        {/* ─── Filas SUBSERIES ─── */}
                        {hasSubseries && sg.rows.map((row, rIdx) => {
                          const subCode = [row.codigoD, row.codigoS, row.codigoSub].filter(Boolean).join(".");

                          return (
                            <tr key={row.id || rIdx} style={{ backgroundColor: "#fff" }}>
                              {/* Código subserie */}
                              <td style={tdc({ fontWeight: "bold", fontSize: isLandscape ? "7.5px" : "6.5px" })}>
                                {subCode}
                              </td>

                              {/* Nombre subserie + tipos documentales */}
                              <td style={tdt({ paddingLeft: "12px" })}>
                                <div style={{ fontWeight: "bold", textTransform: "uppercase", marginBottom: "2px" }}>
                                  {row.subserie}
                                </div>
                                {row.tiposDocumentales?.length > 0 ? (
                                  <div style={{ borderLeft: "1.5px solid #000", paddingLeft: "5px", display: "flex", flexDirection: "column", gap: "1px" }}>
                                    {row.tiposDocumentales.map((t, i) => (
                                      <div key={i} style={{ fontSize: isLandscape ? "7px" : "6px", fontStyle: "italic" }}>
                                        — {t.titulo_documento}
                                      </div>
                                    ))}
                                  </div>
                                ) : row.tipoDocumental ? (
                                  <div style={{ borderLeft: "1.5px solid #000", paddingLeft: "5px" }}>
                                    {row.tipoDocumental.split(",").map((t, i) => (
                                      <div key={i} style={{ fontSize: isLandscape ? "7px" : "6px", fontStyle: "italic" }}>
                                        — {t.trim()}
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                              </td>

                              {/* Soporte */}
                              <td style={tdc()}>{X(row.soporteFisico)}</td>
                              <td style={tdc()}>{X(row.soporteElectronico)}</td>

                              {/* Retención */}
                              <td style={tdc({ fontWeight: "bold" })}>{row.retencionGestion ?? ""}</td>
                              <td style={tdc({ fontWeight: "bold" })}>{row.retencionCentral ?? ""}</td>

                              {/* Disposición Final */}
                              <td style={tdc()}>{X(row.dispCT)}</td>
                              <td style={tdc()}>{X(row.dispS)}</td>
                              <td style={tdc()}>{X(row.dispE)}</td>

                              {/* Reproducción técnica M/D */}
                              <td style={tdc({ fontWeight: "bold" })}>{repValue(row)}</td>

                              {/* DDHH/DIH */}
                              <td style={tdt({ fontSize: isLandscape ? "7px" : "6px", textAlign: "center", verticalAlign: "middle" })}>
                                {row.criterio || ""}
                              </td>

                              {/* Procedimiento */}
                              <td style={tdt({ textAlign: "justify", fontSize: isLandscape ? "7.5px" : "6.5px" })}>
                                {row.procedimiento || ""}
                                {row.actoAdmo && (
                                  <div style={{ marginTop: "3px", fontSize: "6.5px", fontStyle: "italic", color: "#444" }}>
                                    Acto administrativo:{row.actoAdmo}
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

              {/* ════ FIRMAS ════ */}
              <table
                style={{
                  borderCollapse: "collapse",
                  width: "100%",
                  marginTop: "16px",
                  border: BD,
                  fontFamily: "Arial, Helvetica, sans-serif",
                  fontSize: "7px",
                }}
              >
                <tbody>
                  <tr>
                    {[
                      "Jefe de la dependencia",
                      "Responsable del área de gestión documental de la entidad",
                      "Secretario General o funcionario administrativo de igual o superior jerarquía",
                    ].map((label) => (
                      <td key={label} style={{ border: BD, padding: 0, width: "33.33%", verticalAlign: "top" }}>
                        <div
                          style={{
                            borderBottom: BD,
                            padding: "3px 8px",
                            backgroundColor: "#e8e8e8",
                            fontWeight: "bold",
                            textAlign: "center",
                            textTransform: "uppercase",
                            fontSize: "6.5px",
                            minHeight: "28px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {label}
                        </div>
                        {["Nombre:", "Cargo:", "Firma:"].map((field, i, arr) => (
                          <div
                            key={field}
                            style={{
                              borderBottom: i < arr.length - 1 ? BD : "none",
                              padding: "3px 8px",
                              minHeight: field === "Firma:" ? "32px" : "18px",
                              display: "flex",
                              alignItems: "flex-start",
                              gap: "4px",
                            }}
                          >
                            <span style={{ fontWeight: "bold", flexShrink: 0 }}>{field}</span>
                          </div>
                        ))}
                      </td>
                    ))}
                  </tr>

                  {/* Fechas */}
                  <tr>
                    <td colSpan={3} style={{ border: BD, padding: "4px 10px" }}>
                      <div style={{ display: "flex", gap: "48px", fontSize: "7px", fontFamily: "Arial, sans-serif" }}>
                        <span><strong>Fecha de Aprobación:</strong></span>
                        <span><strong>Fecha de Convalidación:</strong></span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* ════ CONVENCIONES ════ */}
              <div
                style={{
                  marginTop: "8px",
                  fontSize: "7px",
                  fontFamily: "Arial, Helvetica, sans-serif",
                  lineHeight: "1.6",
                }}
              >
                <span style={{ fontWeight: "bold", textTransform: "uppercase" }}>Convenciones: </span>
                <span style={{ marginRight: "16px" }}><strong>C</strong> Conservación Total</span>
                <span style={{ marginRight: "16px" }}><strong>S</strong> Selección</span>
                <span style={{ marginRight: "16px" }}><strong>E</strong> Eliminación</span>
                <span style={{ marginRight: "16px" }}><strong>M</strong> Microfilmación</span>
                <span><strong>D</strong> Digitalización</span>
              </div>

            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}
