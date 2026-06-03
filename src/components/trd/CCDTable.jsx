/**
 * CCDTable — Cuadro de Clasificación Documental
 * Formato exacto según AGN Acuerdo 001 del 29 de febrero de 2024, página 138.
 *
 * 10 columnas:
 *   ACTO ADMINISTRATIVO | FUNCIÓN |
 *   CÓDIGO SECCIÓN | NOMBRE DE SECCIÓN |
 *   CÓDIGO SUBSECCIÓN | NOMBRE DE SUBSECCIÓN |
 *   CÓDIGO SERIE O ASUNTO | SERIE O ASUNTO |
 *   CÓDIGO SUBSERIE | SUBSERIE
 */

import React from "react";

// ─── Estilos base ──────────────────────────────────────────────────────────────
const FONT   = "'Arial', 'Helvetica', sans-serif";
const BORDER = "1px solid #000";
const BASE   = {
  fontFamily: FONT,
  fontSize:   "8px",
  color:      "#000",
  border:     BORDER,
  padding:    "2px 3px",
  verticalAlign: "top",
  lineHeight: "1.3",
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

/** Mínimo de filas visibles (como en la plantilla AGN) */
const MIN_ROWS = 12;

// ─── Colores institucionales mínimos ──────────────────────────────────────────
const TITLE_STYLE = {
  fontFamily: FONT,
  textAlign:  "center",
  marginBottom: "3px",
};

export default function CCDTable({ data, entityName }) {
  const rawRows = data?.rows || [];

  // Rellenar hasta MIN_ROWS con filas vacías
  const rows = [...rawRows];
  while (rows.length < MIN_ROWS) {
    rows.push({
      acto_administrativo: "", funcion: "",
      codigo_seccion: "",     nombre_seccion: "",
      codigo_subseccion: "",  nombre_subseccion: "",
      codigo_serie: "",       nombre_serie: "",
      codigo_subserie: "",    nombre_subserie: "",
    });
  }

  const producer = entityName || "";

  return (
    <div
      style={{
        fontFamily: FONT,
        color: "#000",
        width: "100%",
        padding: "6mm 8mm",
        boxSizing: "border-box",
        backgroundColor: "#fff",
      }}
    >
      {/* ── Encabezado institucional ─────────────────────────────────── */}
      <div style={TITLE_STYLE}>
        <div style={{ fontSize: "9px", fontStyle: "italic" }}>
          Colombia. Archivo General de la Nación
        </div>
        <div
          style={{
            fontSize: "12px",
            fontWeight: "bold",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            margin: "3px 0 2px",
          }}
        >
          FORMATO CUADRO DE CLASIFICACIÓN DOCUMENTAL – CCD
        </div>
      </div>

      {/* ── Entidad productora ───────────────────────────────────────── */}
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
        {producer
          ? "_".repeat(Math.max(0, 90 - producer.length))
          : "_".repeat(90)}
        .
      </div>

      {/* ── Tabla principal ──────────────────────────────────────────── */}
      <table
        style={{
          width:           "100%",
          borderCollapse:  "collapse",
          tableLayout:     "fixed",
          borderTop:       "none",
        }}
      >
        <colgroup>
          {/* ACTO ADMIN */}  <col style={{ width: "8%" }} />
          {/* FUNCIÓN */}     <col style={{ width: "14%" }} />
          {/* CÓD SECC */}    <col style={{ width: "5%" }} />
          {/* NOM SECC */}    <col style={{ width: "11%" }} />
          {/* CÓD SUBSECC */} <col style={{ width: "5%" }} />
          {/* NOM SUBSECC */} <col style={{ width: "11%" }} />
          {/* CÓD SERIE */}   <col style={{ width: "8%" }} />
          {/* SERIE */}       <col style={{ width: "15%" }} />
          {/* CÓD SUBSER */}  <col style={{ width: "8%" }} />
          {/* SUBSERIE */}    <col style={{ width: "15%" }} />
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
              <td style={{ ...DATA, textAlign: "center" }}>{row.codigo_seccion}</td>
              <td style={DATA}>{row.nombre_seccion}</td>
              <td style={{ ...DATA, textAlign: "center" }}>{row.codigo_subseccion}</td>
              <td style={DATA}>{row.nombre_subseccion}</td>
              <td style={{ ...DATA, textAlign: "center" }}>{row.codigo_serie}</td>
              <td style={DATA}>{row.nombre_serie}</td>
              <td style={{ ...DATA, textAlign: "center" }}>{row.codigo_subserie}</td>
              <td style={DATA}>{row.nombre_subserie}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* ── Pie: firmas ──────────────────────────────────────────────── */}
      <table
        style={{
          width:          "100%",
          borderCollapse: "collapse",
          marginTop:      "0",
          fontSize:       "8px",
          borderTop:      "none",
        }}
      >
        <tbody>
          {/* Títulos de columnas de firma */}
          <tr>
            <td
              style={{
                ...BASE,
                width:      "50%",
                fontWeight: "bold",
                fontSize:   "8px",
                padding:    "3px 5px",
              }}
            >
              Responsable del área de gestión documental de la entidad
            </td>
            <td
              style={{
                ...BASE,
                width:      "50%",
                fontWeight: "bold",
                fontSize:   "8px",
                padding:    "3px 5px",
              }}
            >
              Secretario General o funcionario administrativo de igual o superior jerarquía
            </td>
          </tr>
          {/* Nombre */}
          <tr>
            <td style={{ ...BASE, height: "18px", padding: "3px 5px" }}>Nombre:</td>
            <td style={{ ...BASE, height: "18px", padding: "3px 5px" }}>Nombre:</td>
          </tr>
          {/* Cargo */}
          <tr>
            <td style={{ ...BASE, height: "18px", padding: "3px 5px" }}>Cargo:</td>
            <td style={{ ...BASE, height: "18px", padding: "3px 5px" }}>Cargo:</td>
          </tr>
          {/* Firma */}
          <tr>
            <td style={{ ...BASE, height: "22px", padding: "3px 5px" }}>Firma:</td>
            <td style={{ ...BASE, height: "22px", padding: "3px 5px" }}>Firma:</td>
          </tr>
        </tbody>
      </table>

      {/* ── Fecha de elaboración ─────────────────────────────────────── */}
      <table
        style={{
          width:          "50%",
          borderCollapse: "collapse",
          marginTop:      "0",
          fontSize:       "8px",
          borderTop:      "none",
        }}
      >
        <tbody>
          <tr>
            <td style={{ ...BASE, height: "18px", padding: "3px 5px" }}>
              Fecha de elaboración:{" "}
              {"_".repeat(30)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
