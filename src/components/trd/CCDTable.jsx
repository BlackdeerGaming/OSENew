/**
 * CCDTable — Cuadro de Clasificación Documental
 * Formato exacto según AGN Acuerdo 001 del 29 de febrero de 2024, página 138.
 *
 * Props:
 *   data        – { rows: [...] }  datos del endpoint /ccd-data
 *   entityName  – nombre de la entidad productora
 *   flatMode    – false (default) = vista jerárquica 10 col
 *                 true            = vista plana 8 col
 *
 * ── Vista Jerárquica (10 col) ─────────────────────────────────────────────────
 *   ACTO ADMIN | FUNCIÓN | CÓD SECC | NOM SECC | CÓD SUBSECC | NOM SUBSECC |
 *   CÓD SERIE | SERIE | CÓD SUBSERIE | SUBSERIE
 *
 * ── Vista Plana (8 col) ──────────────────────────────────────────────────────
 *   ACTO ADMIN | FUNCIÓN | CÓD SECC | NOM SECC |
 *   CÓD SERIE | SERIE | CÓD SUBSERIE | SUBSERIE
 *
 *   En vista plana, TODA dependencia (padre e hijo) aparece como fila independiente
 *   en las columnas de sección:
 *     - La dependencia padre genera una fila de cabecera (una sola vez por sección)
 *     - Cada dependencia hija se promueve a nivel de sección con sus datos de serie
 *     - Las filas sin subsección aparecen tal cual
 */

import React from "react";

// ─── Estilos ──────────────────────────────────────────────────────────────────
const FONT   = "'Arial', 'Helvetica', sans-serif";
const BORDER = "1px solid #000";

const BASE = {
  fontFamily:    FONT,
  fontSize:      "8px",
  color:         "#000",
  border:        BORDER,
  padding:       "2px 3px",
  verticalAlign: "top",
  lineHeight:    "1.3",
};
const HEADER = {
  ...BASE,
  backgroundColor: "#d9d9d9",
  fontWeight:      "bold",
  textAlign:       "center",
  verticalAlign:   "middle",
  fontSize:        "7.5px",
  padding:         "3px 2px",
  overflowWrap:    "break-word",
};
const DATA        = { ...BASE, minHeight: "16px", height: "16px" };
const DATA_CENTER = { ...DATA, textAlign: "center" };

const MIN_ROWS = 12;

const EMPTY_ROW = {
  acto_administrativo: "", funcion: "",
  codigo_seccion: "",      nombre_seccion: "",
  codigo_subseccion: "",   nombre_subseccion: "",
  codigo_serie: "",        nombre_serie: "",
  codigo_subserie: "",     nombre_subserie: "",
};

// ─── Vista plana: expande filas para mostrar padre e hijos como secciones ─────
function buildFlatRows(rawRows) {
  const result     = [];
  const seenParent = new Set(); // evita duplicar la cabecera del padre

  // Ordenar: sección → subsección → serie → subserie
  const sorted = [...rawRows].sort((a, b) => {
    const s1 = (a.codigo_seccion    || "").localeCompare(b.codigo_seccion    || "");
    if (s1 !== 0) return s1;
    const s2 = (a.codigo_subseccion || "").localeCompare(b.codigo_subseccion || "");
    if (s2 !== 0) return s2;
    const s3 = (a.codigo_serie      || "").localeCompare(b.codigo_serie      || "");
    if (s3 !== 0) return s3;
    return       (a.codigo_subserie  || "").localeCompare(b.codigo_subserie  || "");
  });

  for (const row of sorted) {
    if (row.codigo_subseccion) {
      // ── La fila tiene subsección ───────────────────────────────────────────
      // 1. Fila cabecera para la sección padre (solo una vez por código de sección)
      if (!seenParent.has(row.codigo_seccion)) {
        seenParent.add(row.codigo_seccion);
        result.push({
          ...EMPTY_ROW,
          codigo_seccion: row.codigo_seccion,
          nombre_seccion: row.nombre_seccion,
          // Sin datos de serie/función: es solo la cabecera del grupo padre
        });
      }
      // 2. Fila de la subsección promovida a nivel de sección, con sus datos de serie
      result.push({
        acto_administrativo: row.acto_administrativo,
        funcion:             row.funcion,
        codigo_seccion:      row.codigo_subseccion,   // promovida
        nombre_seccion:      row.nombre_subseccion,   // promovida
        codigo_subseccion:   "",
        nombre_subseccion:   "",
        codigo_serie:        row.codigo_serie,
        nombre_serie:        row.nombre_serie,
        codigo_subserie:     row.codigo_subserie,
        nombre_subserie:     row.nombre_subserie,
      });
    } else {
      // ── Sin subsección: aparece como sección directamente ─────────────────
      result.push({
        acto_administrativo: row.acto_administrativo,
        funcion:             row.funcion,
        codigo_seccion:      row.codigo_seccion,
        nombre_seccion:      row.nombre_seccion,
        codigo_subseccion:   "",
        nombre_subseccion:   "",
        codigo_serie:        row.codigo_serie,
        nombre_serie:        row.nombre_serie,
        codigo_subserie:     row.codigo_subserie,
        nombre_subserie:     row.nombre_subserie,
      });
    }
  }

  return result;
}

// ─── Componente principal ─────────────────────────────────────────────────────
// ── Dimensiones de página por tamaño y orientación ───────────────────────────
const PAGE_W = {
  a4:    { landscape: "297mm", portrait: "210mm" },
  carta: { landscape: "279mm", portrait: "216mm" },
  oficio:{ landscape: "356mm", portrait: "216mm" },
};

export default function CCDTable({ data, entityName, flatMode = false, orientation = "landscape", pageSize = "a4" }) {
  const isLandscape = orientation === "landscape";
  const pageWidth   = PAGE_W[pageSize]?.[orientation] ?? PAGE_W.a4[orientation];

  // Solo mostrar filas que tengan nombre de sección definido
  const rawRows = (data?.rows || []).filter(r => r.nombre_seccion);

  // En vista plana transformamos las filas; en jerárquica usamos los datos directos
  const displayRows = flatMode ? buildFlatRows(rawRows) : [...rawRows];

  // Rellenar hasta MIN_ROWS con filas vacías para mantener el aspecto de plantilla
  while (displayRows.length < MIN_ROWS) displayRows.push({ ...EMPTY_ROW });

  // Fuentes: landscape y portrait usan tamaños similares para legibilidad
  const fData   = isLandscape ? "8px"  : "8px";
  const fHeader = isLandscape ? "7.5px": "7px";

  // Estilos dinámicos por orientación
  const DATA_DYN        = { ...BASE, fontSize: fData,   minHeight: "16px", height: "16px" };
  const DATA_CENTER_DYN = { ...DATA_DYN, textAlign: "center" };
  const HEADER_DYN      = { ...HEADER, fontSize: fHeader };

  const producer = entityName || "";

  return (
    <div
      style={{
        fontFamily:      FONT,
        color:           "#000",
        width:           "100%",       /* se adapta al contenedor en pantalla */
        maxWidth:        pageWidth,    /* no supera el ancho del papel al exportar */
        padding:         isLandscape ? "6mm 10mm" : "8mm 12mm",
        boxSizing:       "border-box",
        backgroundColor: "#fff",
        margin:          "0 auto",
      }}
    >
      {/* ── Encabezado institucional ──────────────────────────────── */}
      <div style={{ fontFamily: FONT, textAlign: "center", marginBottom: "3px" }}>
        <div style={{ fontSize: "9px", fontStyle: "italic" }}>
          Colombia. Archivo General de la Nación
        </div>
        <div style={{ fontSize: "12px", fontWeight: "bold", textTransform: "uppercase", letterSpacing: "0.5px", margin: "3px 0 2px" }}>
          FORMATO CUADRO DE CLASIFICACIÓN DOCUMENTAL – CCD
        </div>
      </div>

      {/* ── Entidad productora ────────────────────────────────────── */}
      <div style={{ borderTop: BORDER, borderBottom: BORDER, padding: "3px 4px", fontSize: "9px", marginBottom: "0" }}>
        <span style={{ fontWeight: "bold" }}>ENTIDAD PRODUCTORA:</span>{" "}
        {producer}{"_".repeat(Math.max(0, 90 - producer.length))}.
      </div>

      {/* ── Tabla principal ───────────────────────────────────────── */}
      {flatMode ? (
        // ════════════ MODO PLANO — 8 columnas ════════════════════════
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", borderTop: "none" }}>
          <colgroup>
            <col style={{ width: "9%"  }} /> {/* ACTO ADMIN */}
            <col style={{ width: "22%" }} /> {/* FUNCIÓN */}
            <col style={{ width: "6%"  }} /> {/* CÓD SECCIÓN */}
            <col style={{ width: "18%" }} /> {/* NOM SECCIÓN */}
            <col style={{ width: "8%"  }} /> {/* CÓD SERIE */}
            <col style={{ width: "18%" }} /> {/* SERIE */}
            <col style={{ width: "8%"  }} /> {/* CÓD SUBSERIE */}
            <col style={{ width: "11%" }} /> {/* SUBSERIE */}
          </colgroup>
          <thead>
            <tr>
              <th style={HEADER_DYN}>ACTO<br />ADMINISTRATIVO</th>
              <th style={HEADER_DYN}>FUNCIÓN</th>
              <th style={HEADER_DYN}>CÓDIGO<br />SECCIÓN</th>
              <th style={HEADER_DYN}>NOMBRE DE<br />SECCIÓN</th>
              <th style={HEADER_DYN}>CÓDIGO<br />SERIE O ASUNTO</th>
              <th style={HEADER_DYN}>SERIE O ASUNTO</th>
              <th style={HEADER_DYN}>CÓDIGO<br />SUBSERIE</th>
              <th style={HEADER_DYN}>SUBSERIE</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, i) => (
              <tr key={i}>
                <td style={DATA_DYN}>{row.acto_administrativo}</td>
                <td style={DATA_DYN}>{row.funcion}</td>
                <td style={DATA_CENTER_DYN}>{row.codigo_seccion}</td>
                <td style={DATA_DYN}>{row.nombre_seccion}</td>
                <td style={DATA_CENTER_DYN}>{row.codigo_serie}</td>
                <td style={DATA_DYN}>{row.nombre_serie}</td>
                <td style={DATA_CENTER_DYN}>{row.codigo_subserie}</td>
                <td style={DATA_DYN}>{row.nombre_subserie}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        // ════════════ MODO JERÁRQUICO — 10 columnas ══════════════════
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", borderTop: "none" }}>
          <colgroup>
            <col style={{ width: "8%"  }} /> {/* ACTO ADMIN */}
            <col style={{ width: "15%" }} /> {/* FUNCIÓN */}
            <col style={{ width: "5%"  }} /> {/* CÓD SECC */}
            <col style={{ width: "10%" }} /> {/* NOM SECC */}
            <col style={{ width: "7%"  }} /> {/* CÓD SUBSECC */}
            <col style={{ width: "9%"  }} /> {/* NOM SUBSECC */}
            <col style={{ width: "7%"  }} /> {/* CÓD SERIE */}
            <col style={{ width: "14%" }} /> {/* SERIE */}
            <col style={{ width: "7%"  }} /> {/* CÓD SUBSER */}
            <col style={{ width: "18%" }} /> {/* SUBSERIE */}
          </colgroup>
          <thead>
            <tr>
              <th style={HEADER_DYN}>ACTO<br />ADMINISTRATIVO</th>
              <th style={HEADER_DYN}>FUNCIÓN</th>
              <th style={HEADER_DYN}>CÓDIGO<br />SECCIÓN</th>
              <th style={HEADER_DYN}>NOMBRE DE<br />SECCIÓN</th>
              <th style={HEADER_DYN}>CÓDIGO<br />SUBSECCIÓN</th>
              <th style={HEADER_DYN}>NOMBRE DE<br />SUBSECCIÓN</th>
              <th style={HEADER_DYN}>CÓDIGO<br />SERIE O ASUNTO</th>
              <th style={HEADER_DYN}>SERIE O ASUNTO</th>
              <th style={HEADER_DYN}>CÓDIGO<br />SUBSERIE</th>
              <th style={HEADER_DYN}>SUBSERIE</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row, i) => (
              <tr key={i}>
                <td style={DATA_DYN}>{row.acto_administrativo}</td>
                <td style={DATA_DYN}>{row.funcion}</td>
                <td style={DATA_CENTER_DYN}>{row.codigo_seccion}</td>
                <td style={DATA_DYN}>{row.nombre_seccion}</td>
                <td style={DATA_CENTER_DYN}>{row.codigo_subseccion}</td>
                <td style={DATA_DYN}>{row.nombre_subseccion}</td>
                <td style={DATA_CENTER_DYN}>{row.codigo_serie}</td>
                <td style={DATA_DYN}>{row.nombre_serie}</td>
                <td style={DATA_CENTER_DYN}>{row.codigo_subserie}</td>
                <td style={DATA_DYN}>{row.nombre_subserie}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ── Pie: firmas ──────────────────────────────────────────── */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "0", fontSize: "8px", borderTop: "none" }}>
        <tbody>
          <tr>
            <td style={{ ...BASE, width: "50%", fontWeight: "bold", padding: "3px 5px" }}>
              Responsable del área de gestión documental de la entidad
            </td>
            <td style={{ ...BASE, width: "50%", fontWeight: "bold", padding: "3px 5px" }}>
              Secretario General o funcionario administrativo de igual o superior jerarquía
            </td>
          </tr>
          <tr>
            <td style={{ ...BASE, height: "18px", padding: "3px 5px" }}>Nombre:</td>
            <td style={{ ...BASE, height: "18px", padding: "3px 5px" }}>Nombre:</td>
          </tr>
          <tr>
            <td style={{ ...BASE, height: "18px", padding: "3px 5px" }}>Cargo:</td>
            <td style={{ ...BASE, height: "18px", padding: "3px 5px" }}>Cargo:</td>
          </tr>
          <tr>
            <td style={{ ...BASE, height: "22px", padding: "3px 5px" }}>Firma:</td>
            <td style={{ ...BASE, height: "22px", padding: "3px 5px" }}>Firma:</td>
          </tr>
        </tbody>
      </table>

      {/* ── Fecha de elaboración ─────────────────────────────────── */}
      <table style={{ width: "50%", borderCollapse: "collapse", marginTop: "0", fontSize: "8px", borderTop: "none" }}>
        <tbody>
          <tr>
            <td style={{ ...BASE, height: "18px", padding: "3px 5px" }}>
              Fecha de elaboración: {"_".repeat(30)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
