/**
 * CCDTable — Cuadro de Clasificación Documental
 * Formato exacto según AGN Acuerdo 001 del 29 de febrero de 2024, página 138.
 *
 * Props:
 *   data        – { rows: [...] }  datos del endpoint /ccd-data
 *   entityName  – nombre de la entidad productora
 *   flatMode    – boolean: false = vista jerárquica (10 col) | true = vista plana (8 col)
 *
 * Columnas modo jerárquico (10):
 *   ACTO ADMINISTRATIVO | FUNCIÓN |
 *   CÓDIGO SECCIÓN | NOMBRE SECCIÓN |
 *   CÓDIGO SUBSECCIÓN | NOMBRE SUBSECCIÓN |
 *   CÓDIGO SERIE O ASUNTO | SERIE O ASUNTO |
 *   CÓDIGO SUBSERIE | SUBSERIE
 *
 * Columnas modo plano (8):
 *   ACTO ADMINISTRATIVO | FUNCIÓN |
 *   CÓDIGO SECCIÓN | NOMBRE SECCIÓN |          ← subsección promovida a sección
 *   CÓDIGO SERIE O ASUNTO | SERIE O ASUNTO |
 *   CÓDIGO SUBSERIE | SUBSERIE
 */

import React from "react";

// ─── Estilos base ──────────────────────────────────────────────────────────────
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
};
const DATA = { ...BASE, minHeight: "16px", height: "16px" };
const DATA_CENTER = { ...DATA, textAlign: "center" };

const MIN_ROWS = 12;

const EMPTY_ROW = {
  acto_administrativo: "", funcion: "",
  codigo_seccion: "",      nombre_seccion: "",
  codigo_subseccion: "",   nombre_subseccion: "",
  codigo_serie: "",        nombre_serie: "",
  codigo_subserie: "",     nombre_subserie: "",
};

// ─── Componente ───────────────────────────────────────────────────────────────
export default function CCDTable({ data, entityName, flatMode = false }) {
  const rawRows = data?.rows || [];

  // Rellenar hasta MIN_ROWS
  const rows = [...rawRows];
  while (rows.length < MIN_ROWS) rows.push({ ...EMPTY_ROW });

  const producer = entityName || "";

  // En modo plano, el "código/nombre sección" es la dependencia efectiva:
  // subsección cuando existe, sección cuando no hay subsección.
  const effectiveSection = (row) => ({
    codigo: row.codigo_subseccion || row.codigo_seccion,
    nombre: row.nombre_subseccion || row.nombre_seccion,
  });

  return (
    <div
      style={{
        fontFamily:      FONT,
        color:           "#000",
        width:           "100%",
        padding:         "6mm 8mm",
        boxSizing:       "border-box",
        backgroundColor: "#fff",
      }}
    >
      {/* ── Encabezado institucional ──────────────────────────────── */}
      <div style={{ fontFamily: FONT, textAlign: "center", marginBottom: "3px" }}>
        <div style={{ fontSize: "9px", fontStyle: "italic" }}>
          Colombia. Archivo General de la Nación
        </div>
        <div
          style={{
            fontSize:        "12px",
            fontWeight:      "bold",
            textTransform:   "uppercase",
            letterSpacing:   "0.5px",
            margin:          "3px 0 2px",
          }}
        >
          FORMATO CUADRO DE CLASIFICACIÓN DOCUMENTAL – CCD
        </div>
      </div>

      {/* ── Entidad productora ────────────────────────────────────── */}
      <div
        style={{
          borderTop:    BORDER,
          borderBottom: BORDER,
          padding:      "3px 4px",
          fontSize:     "9px",
          marginBottom: "0",
        }}
      >
        <span style={{ fontWeight: "bold" }}>ENTIDAD PRODUCTORA:</span>{" "}
        {producer}
        {"_".repeat(Math.max(0, 90 - producer.length))}.
      </div>

      {/* ── Tabla principal ───────────────────────────────────────── */}
      {flatMode ? (
        // ════════════════════════════════════════════════════════════
        // MODO PLANO — 8 columnas
        // ════════════════════════════════════════════════════════════
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", borderTop: "none" }}>
          <colgroup>
            <col style={{ width: "9%"  }} /> {/* ACTO ADMIN */}
            <col style={{ width: "17%" }} /> {/* FUNCIÓN */}
            <col style={{ width: "6%"  }} /> {/* CÓD SECCIÓN */}
            <col style={{ width: "18%" }} /> {/* NOM SECCIÓN */}
            <col style={{ width: "9%"  }} /> {/* CÓD SERIE */}
            <col style={{ width: "18%" }} /> {/* SERIE */}
            <col style={{ width: "9%"  }} /> {/* CÓD SUBSERIE */}
            <col style={{ width: "14%" }} /> {/* SUBSERIE */}
          </colgroup>
          <thead>
            <tr>
              <th style={HEADER}>ACTO<br />ADMINISTRATIVO</th>
              <th style={HEADER}>FUNCIÓN</th>
              <th style={HEADER}>CÓDIGO<br />SECCIÓN</th>
              <th style={HEADER}>NOMBRE DE<br />SECCIÓN</th>
              <th style={HEADER}>CÓDIGO<br />SERIE O ASUNTO</th>
              <th style={HEADER}>SERIE O ASUNTO</th>
              <th style={HEADER}>CÓDIGO<br />SUBSERIE</th>
              <th style={HEADER}>SUBSERIE</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const sec = effectiveSection(row);
              return (
                <tr key={i}>
                  <td style={DATA}>{row.acto_administrativo}</td>
                  <td style={DATA}>{row.funcion}</td>
                  <td style={DATA_CENTER}>{sec.codigo}</td>
                  <td style={DATA}>{sec.nombre}</td>
                  <td style={DATA_CENTER}>{row.codigo_serie}</td>
                  <td style={DATA}>{row.nombre_serie}</td>
                  <td style={DATA_CENTER}>{row.codigo_subserie}</td>
                  <td style={DATA}>{row.nombre_subserie}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        // ════════════════════════════════════════════════════════════
        // MODO JERÁRQUICO — 10 columnas
        // ════════════════════════════════════════════════════════════
        <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed", borderTop: "none" }}>
          <colgroup>
            <col style={{ width: "8%"  }} /> {/* ACTO ADMIN */}
            <col style={{ width: "14%" }} /> {/* FUNCIÓN */}
            <col style={{ width: "5%"  }} /> {/* CÓD SECC */}
            <col style={{ width: "11%" }} /> {/* NOM SECC */}
            <col style={{ width: "5%"  }} /> {/* CÓD SUBSECC */}
            <col style={{ width: "11%" }} /> {/* NOM SUBSECC */}
            <col style={{ width: "8%"  }} /> {/* CÓD SERIE */}
            <col style={{ width: "15%" }} /> {/* SERIE */}
            <col style={{ width: "8%"  }} /> {/* CÓD SUBSER */}
            <col style={{ width: "15%" }} /> {/* SUBSERIE */}
          </colgroup>
          <thead>
            <tr>
              <th style={HEADER}>ACTO<br />ADMINISTRATIVO</th>
              <th style={HEADER}>FUNCIÓN</th>
              <th style={HEADER}>CÓDIGO<br />SECCIÓN</th>
              <th style={HEADER}>NOMBRE DE<br />SECCIÓN</th>
              <th style={HEADER}>CÓDIGO<br />SUBSECCIÓN</th>
              <th style={HEADER}>NOMBRE DE<br />SUBSECCIÓN</th>
              <th style={HEADER}>CÓDIGO<br />SERIE O ASUNTO</th>
              <th style={HEADER}>SERIE O ASUNTO</th>
              <th style={HEADER}>CÓDIGO<br />SUBSERIE</th>
              <th style={HEADER}>SUBSERIE</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td style={DATA}>{row.acto_administrativo}</td>
                <td style={DATA}>{row.funcion}</td>
                <td style={DATA_CENTER}>{row.codigo_seccion}</td>
                <td style={DATA}>{row.nombre_seccion}</td>
                <td style={DATA_CENTER}>{row.codigo_subseccion}</td>
                <td style={DATA}>{row.nombre_subseccion}</td>
                <td style={DATA_CENTER}>{row.codigo_serie}</td>
                <td style={DATA}>{row.nombre_serie}</td>
                <td style={DATA_CENTER}>{row.codigo_subserie}</td>
                <td style={DATA}>{row.nombre_subserie}</td>
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
