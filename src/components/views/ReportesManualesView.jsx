import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  FileText, Download, Plus, X, Trash2, Save, History, CheckCircle2,
  RotateCcw, ChevronDown, ChevronUp, Building2, Users, Table2,
  AlertCircle, GripVertical, Eye, ClipboardList,
} from "lucide-react";
import { handleExportPDFGeneral } from "../../utils/exportUtils";
import API_BASE_URL from "../../config/api";
import ViewHeader from "../ui/ViewHeader";
import CCDTable from "../trd/CCDTable";

// ─── Constants ────────────────────────────────────────────────────────────────
const EMPTY_CCD_ROW = {
  acto_administrativo: "", funcion: "",
  codigo_seccion: "", nombre_seccion: "",
  codigo_subseccion: "", nombre_subseccion: "",
  codigo_serie: "", nombre_serie: "",
  codigo_subserie: "", nombre_subserie: "",
};

const mkFun = (n) => ({ cod: String(n), titulo: "", descripcion: "" });
const mkSection = () => ({
  dependencia_id: "", cargo: "",
  funciones: [mkFun(1)],
});

// ─── MF preview styles (must match GeneradorDocumentalView) ──────────────────
const MF_CSS = `
  .mf-section { margin-bottom: 8px; }
  .mf-page-break { height: 0; margin: 40px 0; border-top: 2px dashed #999; }
  .mf-header { width: 100%; border-collapse: collapse; border: 2px solid #000; }
  .mf-header td { padding: 6px 10px; vertical-align: middle; }
  .mf-entity { font-size: 13px; font-weight: 700; text-align: left; width: 55%; border-right: 2px solid #000; }
  .mf-title  { font-size: 15px; font-weight: 800; text-align: center; text-transform: uppercase; letter-spacing: 1px; }
  .mf-info { width: 100%; border-collapse: collapse; border: 2px solid #000; border-top: none; }
  .mf-info td { padding: 5px 10px; font-size: 12px; border: 1px solid #000; vertical-align: middle; }
  .mf-lbl { font-weight: 700; text-transform: uppercase; background-color: #f0f0f0; width: 18%; white-space: nowrap; }
  .mf-val { font-weight: 400; }
  .mf-cargo { font-weight: 700; font-size: 13px; }
  .mf-funs { width: 100%; border-collapse: collapse; border: 2px solid #000; border-top: none; font-size: 12px; }
  .mf-funs th, .mf-funs td { border: 1px solid #000; padding: 5px 8px; vertical-align: top; }
  .mf-section-hdr { background-color: #d9d9d9; font-weight: 700; text-align: center; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; padding: 6px; }
  .mf-col-cod  { background-color: #f0f0f0; font-weight: 700; width: 6%;  text-align: center; }
  .mf-col-fun  { background-color: #f0f0f0; font-weight: 700; width: 28%; }
  .mf-col-desc { background-color: #f0f0f0; font-weight: 700; }
  .mf-cod  { text-align: center; font-weight: 600; }
  .mf-fun  { font-weight: 600; }
  .mf-desc { text-align: justify; line-height: 1.5; }
  .mf-footer { border: 2px solid #000; border-top: none; text-align: right; font-size: 11px; padding: 4px 10px; color: #333; }
`;

// ─── Small helpers ─────────────────────────────────────────────────────────────
function FieldLabel({ children }) {
  return <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide">{children}</label>;
}

function Input({ value, onChange, placeholder, className = "" }) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full bg-background border border-input rounded-md px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all ${className}`}
    />
  );
}

function Textarea({ value, onChange, placeholder, rows = 2 }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full bg-background border border-input rounded-md px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all resize-none"
    />
  );
}

function Select({ value, onChange, children, disabled }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className="w-full bg-background border border-input rounded-md px-2.5 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all disabled:opacity-50"
    >
      {children}
    </select>
  );
}

// ─── CCD Row Card ─────────────────────────────────────────────────────────────
function CcdRowCard({ row, index, total, onChange, onRemove, dependencias, series, subseries }) {
  const [open, setOpen] = useState(index === 0);

  const depSeries = useMemo(
    () => series.filter(s => s.dependencia_id === row._dep_id),
    [series, row._dep_id]
  );
  const depSubseries = useMemo(
    () => subseries.filter(ss => ss.serie_id === row._serie_id),
    [subseries, row._serie_id]
  );

  const handleDepSelect = (depId) => {
    const dep = dependencias.find(d => d.id === depId);
    onChange("codigo_seccion", dep?.codigo || "");
    onChange("nombre_seccion", dep?.nombre || "");
    onChange("_dep_id", depId);
    onChange("codigo_subseccion", ""); onChange("nombre_subseccion", "");
    onChange("codigo_serie", ""); onChange("nombre_serie", "");
    onChange("codigo_subserie", ""); onChange("nombre_subserie", "");
    onChange("_serie_id", "");
  };

  const handleSerieSelect = (serieId) => {
    const serie = series.find(s => s.id === serieId);
    onChange("codigo_serie", serie?.codigo || "");
    onChange("nombre_serie", serie?.nombre || "");
    onChange("_serie_id", serieId);
    onChange("codigo_subserie", ""); onChange("nombre_subserie", "");
  };

  const handleSubserieSelect = (ssId) => {
    const ss = subseries.find(s => s.id === ssId);
    onChange("codigo_subserie", ss?.codigo || "");
    onChange("nombre_subserie", ss?.nombre || "");
  };

  return (
    <div className="border border-border rounded-lg bg-background overflow-hidden">
      <div
        className="flex items-center gap-2 px-3 py-2 cursor-pointer bg-muted/40 hover:bg-muted/60 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="flex-1 text-xs font-semibold text-foreground truncate">
          Fila {index + 1}
          {(row.nombre_seccion || row.acto_administrativo) && (
            <span className="text-muted-foreground font-normal">
              {row.acto_administrativo ? ` — ${row.acto_administrativo}` : ""}
              {row.nombre_seccion ? ` · ${row.nombre_seccion}` : ""}
              {row.nombre_serie ? ` / ${row.nombre_serie}` : ""}
            </span>
          )}
        </span>
        {total > 1 && (
          <button
            onClick={e => { e.stopPropagation(); onRemove(); }}
            className="text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </div>

      {open && (
        <div className="p-3 flex flex-col gap-3">
          {/* Acto Administrativo */}
          <div>
            <FieldLabel>Acto Administrativo</FieldLabel>
            <div className="mt-1">
              <Input value={row.acto_administrativo} onChange={v => onChange("acto_administrativo", v)} placeholder="Ej: Resolución 001 de 2024" />
            </div>
          </div>

          {/* Función */}
          <div>
            <FieldLabel>Función</FieldLabel>
            <div className="mt-1">
              <Input value={row.funcion} onChange={v => onChange("funcion", v)} placeholder="Ej: Gestión documental" />
            </div>
          </div>

          {/* Sección */}
          <div>
            <FieldLabel>Sección (Dependencia)</FieldLabel>
            {dependencias.length > 0 && (
              <div className="mt-1">
                <Select value={row._dep_id || ""} onChange={handleDepSelect}>
                  <option value="">Seleccionar...</option>
                  {dependencias.map(d => (
                    <option key={d.id} value={d.id}>{d.codigo} — {d.nombre}</option>
                  ))}
                </Select>
              </div>
            )}
            <div className="mt-1.5 flex gap-2">
              <Input value={row.codigo_seccion} onChange={v => onChange("codigo_seccion", v)} placeholder="Cód. sección" className="w-24" />
              <Input value={row.nombre_seccion} onChange={v => onChange("nombre_seccion", v)} placeholder="Nombre sección" />
            </div>
          </div>

          {/* Subsección */}
          <div>
            <FieldLabel>Subsección (opcional)</FieldLabel>
            <div className="mt-1 flex gap-2">
              <Input value={row.codigo_subseccion} onChange={v => onChange("codigo_subseccion", v)} placeholder="Cód." className="w-24" />
              <Input value={row.nombre_subseccion} onChange={v => onChange("nombre_subseccion", v)} placeholder="Nombre subsección" />
            </div>
          </div>

          {/* Serie */}
          <div>
            <FieldLabel>Serie Documental</FieldLabel>
            {depSeries.length > 0 && (
              <div className="mt-1">
                <Select value={row._serie_id || ""} onChange={handleSerieSelect}>
                  <option value="">Seleccionar serie...</option>
                  {depSeries.map(s => (
                    <option key={s.id} value={s.id}>{s.codigo} — {s.nombre}</option>
                  ))}
                </Select>
              </div>
            )}
            <div className="mt-1.5 flex gap-2">
              <Input value={row.codigo_serie} onChange={v => onChange("codigo_serie", v)} placeholder="Cód. serie" className="w-24" />
              <Input value={row.nombre_serie} onChange={v => onChange("nombre_serie", v)} placeholder="Nombre serie" />
            </div>
          </div>

          {/* Subserie */}
          <div>
            <FieldLabel>Subserie (opcional)</FieldLabel>
            {depSubseries.length > 0 && (
              <div className="mt-1">
                <Select value={row._subserie_id || ""} onChange={id => { handleSubserieSelect(id); onChange("_subserie_id", id); }}>
                  <option value="">Seleccionar subserie...</option>
                  {depSubseries.map(ss => (
                    <option key={ss.id} value={ss.id}>{ss.codigo} — {ss.nombre}</option>
                  ))}
                </Select>
              </div>
            )}
            <div className="mt-1.5 flex gap-2">
              <Input value={row.codigo_subserie} onChange={v => onChange("codigo_subserie", v)} placeholder="Cód." className="w-24" />
              <Input value={row.nombre_subserie} onChange={v => onChange("nombre_subserie", v)} placeholder="Nombre subserie" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MF Section Card ──────────────────────────────────────────────────────────
function MfSectionCard({ section, index, total, onUpdate, onRemove, onAddFun, onRemoveFun, onUpdateFun, dependencias }) {
  const [open, setOpen] = useState(true);

  const dep = dependencias.find(d => d.id === section.dependencia_id);
  const depSuperiorId = dep?.depende_de;
  const depSuperior = dependencias.find(d => d.id === depSuperiorId)?.nombre || "";

  const handleDepSelect = (depId) => {
    onUpdate("dependencia_id", depId);
  };

  return (
    <div className="border border-border rounded-lg bg-background overflow-hidden">
      <div
        className="flex items-center gap-2 px-3 py-2.5 cursor-pointer bg-muted/40 hover:bg-muted/60 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <Users className="h-3.5 w-3.5 text-primary shrink-0" />
        <span className="flex-1 text-xs font-semibold text-foreground truncate">
          {section.cargo || `Cargo ${index + 1}`}
          {dep && <span className="text-muted-foreground font-normal"> — {dep.nombre}</span>}
        </span>
        {total > 1 && (
          <button
            onClick={e => { e.stopPropagation(); onRemove(); }}
            className="text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
        {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </div>

      {open && (
        <div className="p-3 flex flex-col gap-3">
          {/* Dependencia */}
          <div>
            <FieldLabel>Dependencia</FieldLabel>
            <div className="mt-1">
              <Select value={section.dependencia_id} onChange={handleDepSelect} disabled={dependencias.length === 0}>
                <option value="">Seleccionar dependencia...</option>
                {dependencias.map(d => (
                  <option key={d.id} value={d.id}>{d.codigo} — {d.nombre}</option>
                ))}
              </Select>
            </div>
            {depSuperior && (
              <p className="text-[11px] text-muted-foreground mt-1">Dep. superior: <span className="font-semibold">{depSuperior}</span></p>
            )}
          </div>

          {/* Cargo */}
          <div>
            <FieldLabel>Nombre del cargo</FieldLabel>
            <div className="mt-1">
              <Input value={section.cargo} onChange={v => onUpdate("cargo", v)} placeholder="Ej: Director Administrativo" />
            </div>
          </div>

          {/* Funciones */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <FieldLabel>Funciones esenciales</FieldLabel>
              <button
                onClick={onAddFun}
                className="text-[11px] text-primary font-bold flex items-center gap-1 hover:text-primary/80 transition-colors"
              >
                <Plus className="h-3 w-3" /> Añadir
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {section.funciones.map((fun, fi) => (
                <div key={fi} className="rounded-md border border-border bg-muted/20 p-2.5 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-[11px] font-bold flex items-center justify-center">
                      {fun.cod || fi + 1}
                    </span>
                    <Input
                      value={fun.titulo}
                      onChange={v => onUpdateFun(fi, "titulo", v)}
                      placeholder="Título de la función"
                      className="flex-1"
                    />
                    {section.funciones.length > 1 && (
                      <button onClick={() => onRemoveFun(fi)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <Textarea
                    value={fun.descripcion}
                    onChange={v => onUpdateFun(fi, "descripcion", v)}
                    placeholder="Descripción detallada formal..."
                    rows={2}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Version history strip ─────────────────────────────────────────────────────
function VersionStrip({ activeDoc, backupDoc, onRestore }) {
  if (!activeDoc && !backupDoc) return null;
  const fmt = (iso) => iso ? new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" }) : "";

  return (
    <div className="border border-border rounded-lg bg-muted/20 p-3 flex flex-col gap-2">
      <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
        <History className="h-3.5 w-3.5" /> Versiones guardadas
      </p>
      {activeDoc && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
            <span className="text-xs text-foreground font-semibold">Activa</span>
            <span className="text-xs text-muted-foreground">{fmt(activeDoc.created_at)}</span>
          </div>
        </div>
      )}
      {backupDoc && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <History className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-xs text-foreground font-semibold">Respaldo</span>
            <span className="text-xs text-muted-foreground">{fmt(backupDoc.created_at)}</span>
          </div>
          <button
            onClick={() => onRestore(backupDoc.id)}
            className="text-[11px] text-primary font-bold flex items-center gap-1 hover:underline"
          >
            <RotateCcw className="h-3 w-3" /> Restaurar
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ReportesManualesView({
  dependencias = [],
  series = [],
  subseries = [],
  entities = [],
  currentUser,
  selectedEntityId,
}) {
  const [activeTab, setActiveTab] = useState("ccd");

  const activeEntityId = selectedEntityId || entities?.[0]?.id || currentUser?.entity_id;
  const entityName = entities?.find(e => e.id === activeEntityId)?.razonSocial || "";

  // ── Official docs ─────────────────────────────────────────────────────────
  const [officialDocs, setOfficialDocs] = useState([]);
  const [isSavingOfficial, setIsSavingOfficial] = useState(false);
  const [showConfirmSave, setShowConfirmSave] = useState(false);

  const fetchOfficialDocs = useCallback(async () => {
    if (!activeEntityId) return;
    try {
      const r = await fetch(`${API_BASE_URL}/trd/entity/${activeEntityId}/documentos-oficiales`, {
        headers: { Authorization: `Bearer ${currentUser?.token || ""}` },
      });
      if (r.ok) setOfficialDocs(await r.json());
    } catch (_) {}
  }, [activeEntityId, currentUser]);

  useEffect(() => { fetchOfficialDocs(); }, [fetchOfficialDocs]);

  // ── CCD state ─────────────────────────────────────────────────────────────
  const [ccdOrientation, setCcdOrientation] = useState("landscape");
  const [ccdPageSize, setCcdPageSize] = useState("a4");
  const [ccdFlatMode, setCcdFlatMode] = useState(false);
  const [ccdRows, setCcdRows] = useState([{ ...EMPTY_CCD_ROW }]);

  const ccdPreviewData = useMemo(() => ({ rows: ccdRows }), [ccdRows]);

  const addCcdRow = () => setCcdRows(r => [...r, { ...EMPTY_CCD_ROW }]);
  const removeCcdRow = (i) => setCcdRows(r => r.filter((_, idx) => idx !== i));
  const updateCcdRow = (i, field, value) =>
    setCcdRows(r => r.map((row, idx) => idx === i ? { ...row, [field]: value } : row));

  // ── MF state ──────────────────────────────────────────────────────────────
  const [mfSections, setMfSections] = useState([mkSection()]);

  const addMfSection = () => setMfSections(s => [...s, mkSection()]);
  const removeMfSection = (i) => setMfSections(s => s.filter((_, idx) => idx !== i));
  const updateMfSection = (i, field, value) =>
    setMfSections(s => s.map((sec, idx) => idx === i ? { ...sec, [field]: value } : sec));

  const addMfFun = (si) =>
    setMfSections(s => s.map((sec, idx) =>
      idx === si ? { ...sec, funciones: [...sec.funciones, mkFun(sec.funciones.length + 1)] } : sec
    ));
  const removeMfFun = (si, fi) =>
    setMfSections(s => s.map((sec, idx) =>
      idx === si ? {
        ...sec,
        funciones: sec.funciones
          .filter((_, fidx) => fidx !== fi)
          .map((f, i) => ({ ...f, cod: String(i + 1) })),
      } : sec
    ));
  const updateMfFun = (si, fi, field, value) =>
    setMfSections(s => s.map((sec, idx) =>
      idx === si ? {
        ...sec,
        funciones: sec.funciones.map((f, fidx) => fidx === fi ? { ...f, [field]: value } : f),
      } : sec
    ));

  // ── MF HTML generation ────────────────────────────────────────────────────
  const mfPreviewHtml = useMemo(() => {
    return mfSections.map((section, idx) => {
      const dep = dependencias.find(d => d.id === section.dependencia_id);
      const depNombre = dep?.nombre || "";
      const depCodigo = dep?.codigo || "";
      const depSuperiorId = dep?.depende_de;
      const depSuperior = dependencias.find(d => d.id === depSuperiorId)?.nombre || "";

      const funRows = section.funciones
        .map((f, fi) =>
          `<tr>
            <td class="mf-cod">${f.cod || fi + 1}</td>
            <td class="mf-fun">${f.titulo || "&nbsp;"}</td>
            <td class="mf-desc">${f.descripcion || "&nbsp;"}</td>
          </tr>`
        )
        .join("");

      return `
<div class="mf-section">
  <table class="mf-header">
    <tr>
      <td class="mf-entity">${entityName || "Entidad"}</td>
      <td class="mf-title">MANUAL DE FUNCIONES</td>
    </tr>
  </table>
  <table class="mf-info">
    <tr>
      <td class="mf-lbl">DEPENDENCIA</td>
      <td class="mf-val" colspan="3">${depNombre || "&nbsp;"}</td>
    </tr>
    <tr>
      <td class="mf-lbl">CÓDIGO</td>
      <td class="mf-val">${depCodigo || "&nbsp;"}</td>
      <td class="mf-lbl">DEP. SUPERIOR</td>
      <td class="mf-val">${depSuperior || "&nbsp;"}</td>
    </tr>
    <tr>
      <td class="mf-lbl">CARGO</td>
      <td class="mf-val mf-cargo" colspan="3">${section.cargo || "&nbsp;"}</td>
    </tr>
  </table>
  <table class="mf-funs">
    <thead>
      <tr><th colspan="3" class="mf-section-hdr">Descripción de las funciones esenciales</th></tr>
      <tr>
        <th class="mf-col-cod">Cód</th>
        <th class="mf-col-fun">Función</th>
        <th class="mf-col-desc">Descripción detallada</th>
      </tr>
    </thead>
    <tbody>${funRows}</tbody>
  </table>
  <div class="mf-footer">Página ${idx + 1} de ${mfSections.length}</div>
</div>
${idx < mfSections.length - 1 ? '<div class="mf-page-break"></div>' : ""}`;
    }).join("");
  }, [mfSections, dependencias, entityName]);

  // ── Save official ─────────────────────────────────────────────────────────
  const handleSaveOfficial = async () => {
    if (!activeEntityId) return;
    setIsSavingOfficial(true);
    let contenido = "";
    let tipo = "";
    if (activeTab === "ccd") {
      const el = document.getElementById("documento-generado");
      contenido = el ? el.outerHTML : "";
      tipo = "ccd";
    } else {
      contenido = mfPreviewHtml;
      tipo = "manual_funciones";
    }
    try {
      const r = await fetch(`${API_BASE_URL}/trd/entity/${activeEntityId}/documentos-oficiales`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${currentUser?.token || ""}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ tipo, contenido }),
      });
      if (r.ok) { await fetchOfficialDocs(); setShowConfirmSave(false); }
    } catch (_) {}
    finally { setIsSavingOfficial(false); }
  };

  const handleRestore = async (docId) => {
    try {
      await fetch(`${API_BASE_URL}/trd/entity/${activeEntityId}/documentos-oficiales/restore/${docId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${currentUser?.token || ""}` },
      });
      await fetchOfficialDocs();
    } catch (_) {}
  };

  // ── PDF Export ────────────────────────────────────────────────────────────
  const handleExportPDF = () => {
    const label = activeTab === "ccd" ? "CCD_Manual" : "Manual_Funciones_Manual";
    const orientation = activeTab === "ccd" ? ccdOrientation : "portrait";
    const paperMap = { a4: "a4", carta: "letter", oficio: "legal" };
    const paper = paperMap[activeTab === "ccd" ? ccdPageSize : "a4"] || "a4";
    handleExportPDFGeneral("documento-generado", label, orientation, paper);
  };

  const tipo = activeTab === "ccd" ? "ccd" : "manual_funciones";
  const activeDoc = officialDocs.find(d => d.tipo === tipo && d.is_active);
  const backupDoc = officialDocs.find(d => d.tipo === tipo && d.is_backup);

  const hasContent = activeTab === "ccd"
    ? ccdRows.some(r => r.codigo_seccion || r.nombre_seccion || r.codigo_serie)
    : mfSections.some(s => s.cargo || s.funciones.some(f => f.titulo));

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      <ViewHeader
        title="Reportes Manuales"
        subtitle="Crea Cuadros de Clasificación y Manuales de Funciones ingresando los datos directamente"
        icon={ClipboardList}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left Panel ──────────────────────────────────────────────────── */}
        <aside className="w-[400px] shrink-0 flex flex-col border-r border-border bg-card overflow-y-auto">
          {/* Tab selector */}
          <div className="flex border-b border-border shrink-0">
            <button
              onClick={() => setActiveTab("ccd")}
              className={`flex-1 py-3 text-sm font-bold transition-colors flex items-center justify-center gap-2 ${
                activeTab === "ccd"
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Table2 className="h-4 w-4" /> CCD
            </button>
            <button
              onClick={() => setActiveTab("manual")}
              className={`flex-1 py-3 text-sm font-bold transition-colors flex items-center justify-center gap-2 ${
                activeTab === "manual"
                  ? "text-primary border-b-2 border-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Users className="h-4 w-4" /> Manual de Funciones
            </button>
          </div>

          <div className="flex-1 flex flex-col gap-4 p-4">
            {/* ── CCD Tab ─────────────────────────────────────────────── */}
            {activeTab === "ccd" && (
              <>
                {/* Document options */}
                <div className="rounded-lg border border-border bg-muted/20 p-3 flex flex-col gap-3">
                  <p className="text-xs font-bold text-foreground">Opciones del documento</p>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <FieldLabel>Orientación</FieldLabel>
                      <div className="mt-1">
                        <Select value={ccdOrientation} onChange={setCcdOrientation}>
                          <option value="landscape">Horizontal</option>
                          <option value="portrait">Vertical</option>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <FieldLabel>Tamaño</FieldLabel>
                      <div className="mt-1">
                        <Select value={ccdPageSize} onChange={setCcdPageSize}>
                          <option value="a4">A4</option>
                          <option value="carta">Carta</option>
                          <option value="oficio">Oficio</option>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="flatMode"
                      checked={ccdFlatMode}
                      onChange={e => setCcdFlatMode(e.target.checked)}
                      className="accent-primary"
                    />
                    <label htmlFor="flatMode" className="text-xs text-foreground cursor-pointer">
                      Vista plana (8 columnas)
                    </label>
                  </div>
                </div>

                {/* Rows */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-foreground">Filas del CCD <span className="text-muted-foreground font-normal">({ccdRows.length})</span></p>
                    <button
                      onClick={addCcdRow}
                      className="text-xs text-primary font-bold flex items-center gap-1 hover:text-primary/80 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" /> Añadir fila
                    </button>
                  </div>

                  {ccdRows.map((row, i) => (
                    <CcdRowCard
                      key={i}
                      row={row}
                      index={i}
                      total={ccdRows.length}
                      onChange={(field, value) => updateCcdRow(i, field, value)}
                      onRemove={() => removeCcdRow(i)}
                      dependencias={dependencias}
                      series={series}
                      subseries={subseries}
                    />
                  ))}
                </div>
              </>
            )}

            {/* ── MF Tab ──────────────────────────────────────────────── */}
            {activeTab === "manual" && (
              <>
                {dependencias.length === 0 && (
                  <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                    <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      No hay dependencias registradas. Ve a <strong>Dependencias</strong> para agregarlas antes de crear el manual.
                    </p>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-foreground">
                      Secciones de cargo <span className="text-muted-foreground font-normal">({mfSections.length})</span>
                    </p>
                    <button
                      onClick={addMfSection}
                      className="text-xs text-primary font-bold flex items-center gap-1 hover:text-primary/80 transition-colors"
                    >
                      <Plus className="h-3.5 w-3.5" /> Añadir cargo
                    </button>
                  </div>

                  {mfSections.map((section, si) => (
                    <MfSectionCard
                      key={si}
                      section={section}
                      index={si}
                      total={mfSections.length}
                      onUpdate={(field, value) => updateMfSection(si, field, value)}
                      onRemove={() => removeMfSection(si)}
                      onAddFun={() => addMfFun(si)}
                      onRemoveFun={(fi) => removeMfFun(si, fi)}
                      onUpdateFun={(fi, field, value) => updateMfFun(si, fi, field, value)}
                      dependencias={dependencias}
                    />
                  ))}
                </div>
              </>
            )}

            {/* ── Export & Save ─────────────────────────────────────────── */}
            <div className="flex flex-col gap-2 pt-2 border-t border-border">
              <button
                onClick={handleExportPDF}
                disabled={!hasContent}
                className="w-full flex items-center justify-center gap-2 bg-secondary hover:bg-secondary/80 border border-border text-foreground px-4 py-2 rounded-lg font-bold text-sm transition-all active:scale-95 disabled:opacity-40"
              >
                <Download className="h-4 w-4" /> Exportar PDF
              </button>

              {!showConfirmSave ? (
                <button
                  onClick={() => setShowConfirmSave(true)}
                  disabled={!hasContent || isSavingOfficial}
                  className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-lg font-bold text-sm shadow transition-all active:scale-95 disabled:opacity-40"
                >
                  <Save className="h-4 w-4" />
                  {activeDoc ? "Guardar nueva versión" : "Guardar como oficial"}
                </button>
              ) : (
                <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 p-3 flex flex-col gap-2">
                  <p className="text-xs text-amber-700 dark:text-amber-300 font-semibold">
                    {activeDoc
                      ? "¿Reemplazar la versión activa? La actual pasará a respaldo."
                      : "¿Guardar como documento oficial?"}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleSaveOfficial}
                      disabled={isSavingOfficial}
                      className="flex-1 bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-xs font-bold transition-all disabled:opacity-60"
                    >
                      {isSavingOfficial ? "Guardando..." : "Confirmar"}
                    </button>
                    <button
                      onClick={() => setShowConfirmSave(false)}
                      className="flex-1 bg-secondary text-foreground rounded-md px-3 py-1.5 text-xs font-bold border border-border transition-all"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── Version history ───────────────────────────────────────── */}
            <VersionStrip activeDoc={activeDoc} backupDoc={backupDoc} onRestore={handleRestore} />
          </div>
        </aside>

        {/* ── Right Panel: Preview ─────────────────────────────────────────── */}
        <main className="flex-1 bg-muted/30 overflow-auto flex flex-col items-center justify-start p-6 gap-4">
          {/* Hint banner */}
          {!hasContent && (
            <div className="flex items-center gap-3 p-4 rounded-xl border border-dashed border-border bg-card text-muted-foreground max-w-lg w-full mt-8">
              <Eye className="h-8 w-8 shrink-0 opacity-40" />
              <div>
                <p className="text-sm font-semibold text-foreground">Vista previa en tiempo real</p>
                <p className="text-xs mt-0.5">
                  {activeTab === "ccd"
                    ? "Completa las filas en el panel izquierdo para ver el CCD generado."
                    : "Ingresa un cargo y sus funciones para previsualizar el Manual."}
                </p>
              </div>
            </div>
          )}

          {/* ── CCD Preview ─────────────────────────────────────────── */}
          {activeTab === "ccd" && (
            <div id="documento-generado" style={{ width: "100%" }}>
              <CCDTable
                data={ccdPreviewData}
                entityName={entityName}
                flatMode={ccdFlatMode}
                orientation={ccdOrientation}
                pageSize={ccdPageSize}
              />
            </div>
          )}

          {/* ── MF Preview ──────────────────────────────────────────── */}
          {activeTab === "manual" && (
            <div
              id="documento-generado"
              className="w-full bg-white text-black shadow-xl rounded-sm"
              style={{
                minHeight: "297mm",
                width: "210mm",
                fontFamily: "'Times New Roman', 'Georgia', serif",
                padding: "15mm",
                boxSizing: "border-box",
              }}
            >
              <style>{MF_CSS}</style>
              <style>{`
                @media print {
                  #documento-generado { padding: 10mm !important; }
                  .mf-page-break { page-break-after: always; break-after: page; height: 0 !important; margin: 0 !important; border: none !important; }
                }
              `}</style>
              <div dangerouslySetInnerHTML={{ __html: mfPreviewHtml }} />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
