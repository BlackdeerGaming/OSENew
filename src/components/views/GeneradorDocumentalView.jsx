import React, { useState, useEffect } from "react";
import { FileText, Download, Loader2, Wand2, Briefcase, Building2, AlertCircle, Plus, X, ChevronDown } from "lucide-react";
import { handleExportPDFGeneral } from "../../utils/exportUtils";
import { cn } from "@/lib/utils";
import API_BASE_URL from "../../config/api";

// ── Small chip component ────────────────────────────────────────────────────
function Chip({ label, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-bold px-2.5 py-1 rounded-full">
      {label}
      <button onClick={onRemove} className="hover:text-destructive transition-colors">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

export default function GeneradorDocumentalView({ dependencias, entities, currentUser, forceMode }) {
  const [activeTab, setActiveTab] = useState("ccd");
  const generationMode = forceMode || "ai";
  const [entrevistadosList, setEntrevistadosList] = useState([]);
  const [funcionesList, setFuncionesList] = useState([]);

  // ── AI mode: multiple selected cargos ──────────────────────────────────
  const [selectedCargos, setSelectedCargos] = useState([]); // array of strings
  const [selectedDependenciaId, setSelectedDependenciaId] = useState("");
  const [pickCargo, setPickCargo] = useState(""); // currently focused in dropdown

  // ── Manual mode: list of cargo entries ────────────────────────────────
  const [manualEntries, setManualEntries] = useState([
    { cargo: "", proposito: "", funcionesSel: [], relaciones: "" }
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [generatedHtml, setGeneratedHtml] = useState("");

  const activeEntityId = entities?.[0]?.id || currentUser?.entity_id;

  useEffect(() => {
    if (activeEntityId) {
      fetchEntrevistados();
      fetchFunciones();
    }
  }, [activeEntityId]);

  const fetchEntrevistados = async () => {
    try {
      const resp = await fetch(`${API_BASE_URL}/trd/entity/${activeEntityId}/entrevistados`, {
        headers: { "Authorization": `Bearer ${currentUser?.token || ""}` }
      });
      if (resp.ok) setEntrevistadosList(await resp.json());
    } catch (e) { console.error(e); }
  };

  const fetchFunciones = async () => {
    try {
      const resp = await fetch(`${API_BASE_URL}/trd/entity/${activeEntityId}/funciones`, {
        headers: { "Authorization": `Bearer ${currentUser?.token || ""}` }
      });
      if (resp.ok) setFuncionesList(await resp.json());
    } catch (e) { console.error(e); }
  };

  // ── Manual (literal) live preview ──────────────────────────────────────
  useEffect(() => {
    if (generationMode === "manual") {
      if (activeTab === "ccd") {
        let html = `<h1>Cuadro de Clasificación Documental</h1>`;
        html += `<h2>Fondo: ${entities.find(e => e.id === activeEntityId)?.razonSocial || "Entidad Central"}</h2>`;
        html += `<table border="1" width="100%"><thead><tr><th>Código</th><th>Sección (Dependencia)</th><th>Serie/Función</th></tr></thead><tbody>`;
        const rels = dependencias.filter(d => d.entity_id === activeEntityId || !d.entity_id);
        rels.forEach(dep => {
          const depFuns = funcionesList.filter(f => f.dependencia_id === dep.id);
          if (depFuns.length === 0) {
            html += `<tr><td>${dep.codigo || ""}</td><td><strong>${dep.nombre}</strong></td><td>Sin funciones</td></tr>`;
          } else {
            depFuns.forEach((f, idx) => {
              html += `<tr>`;
              if (idx === 0) {
                html += `<td rowspan="${depFuns.length}">${dep.codigo || ""}</td>`;
                html += `<td rowspan="${depFuns.length}"><strong>${dep.nombre}</strong></td>`;
              }
              html += `<td>${f.codigo_funcion ? f.codigo_funcion + " - " : ""}${f.titulo}</td></tr>`;
            });
          }
        });
        html += `</tbody></table>`;
        setGeneratedHtml(html);
      } else {
        // Multi-cargo manual preview
        let html = `<h1>Manual de Funciones</h1>`;
        manualEntries.forEach((entry, idx) => {
          if (manualEntries.length > 1) {
            html += `<hr style="margin:32px 0;border-color:#ccc;" />`;
          }
          html += `<h2>Identificación del Cargo: ${entry.cargo || "[Escriba Cargo]"}</h2>`;
          html += `<h3>Propósito Principal</h3><p>${entry.proposito || "Describa el propósito principal aquí..."}</p>`;
          html += `<h3>Funciones Principales y Deberes</h3><ul>`;
          if (entry.funcionesSel && entry.funcionesSel.length > 0) {
            entry.funcionesSel.forEach(fnId => {
              const fnObj = funcionesList.find(f => f.id === fnId);
              if (fnObj) html += `<li>${fnObj.titulo}</li>`;
            });
          } else {
            html += `<li>No se han seleccionado funciones.</li>`;
          }
          html += `</ul>`;
          html += `<h3>Relación con Otras Áreas</h3><p>${entry.relaciones || "Describa dependencias inter-áreas..."}</p>`;
        });
        setGeneratedHtml(html);
      }
    }
  }, [generationMode, activeTab, dependencias, funcionesList, activeEntityId, entities, manualEntries]);

  // ── Handlers ────────────────────────────────────────────────────────────
  const handleGenerateCCD = async () => {
    if (!activeEntityId) return;
    setLoading(true); setError(null); setGeneratedHtml("");
    try {
      const resp = await fetch(`${API_BASE_URL}/trd/entity/${activeEntityId}/generate/ccd`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${currentUser?.token || ""}` }
      });
      if (!resp.ok) throw new Error("Error generando CCD");
      const data = await resp.json();
      setGeneratedHtml(data.html);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleGenerateManual = async () => {
    if (!activeEntityId || !selectedDependenciaId || selectedCargos.length === 0) return;
    setLoading(true); setError(null); setGeneratedHtml("");
    try {
      const resp = await fetch(`${API_BASE_URL}/trd/entity/${activeEntityId}/generate/manual-funciones`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${currentUser?.token || ""}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          cargos: selectedCargos,
          dependencia_id: selectedDependenciaId
        })
      });
      if (!resp.ok) throw new Error("Error generando Manual");
      const data = await resp.json();
      setGeneratedHtml(data.html);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleExportPDF = () => {
    const label = activeTab === "ccd"
      ? "Cuadro_Clasificacion_Documental"
      : selectedCargos.length > 0
        ? `Manual_Funciones_${selectedCargos.join("_")}`
        : `Manual_Funciones_${manualEntries.map(e => e.cargo).filter(Boolean).join("_") || "cargos"}`;
    handleExportPDFGeneral("documento-generado", label);
  };

  // ── Cargo chip helpers (AI mode) ─────────────────────────────────────
  const cargosUnicos = [];
  const mapCargos = new Set();
  entrevistadosList.forEach(e => {
    if (!mapCargos.has(e.cargo)) { mapCargos.add(e.cargo); cargosUnicos.push(e.cargo); }
  });

  const availableCargos = cargosUnicos.filter(c => !selectedCargos.includes(c));

  const addCargo = (cargo) => {
    if (cargo && !selectedCargos.includes(cargo)) {
      setSelectedCargos(prev => [...prev, cargo]);
      setPickCargo("");
    }
  };

  const removeCargo = (cargo) => setSelectedCargos(prev => prev.filter(c => c !== cargo));

  // ── Manual entry helpers ─────────────────────────────────────────────
  const updateEntry = (idx, field, value) => {
    setManualEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
  };

  const addEntry = () => {
    setManualEntries(prev => [...prev, { cargo: "", proposito: "", funcionesSel: [], relaciones: "" }]);
  };

  const removeEntry = (idx) => {
    setManualEntries(prev => prev.length > 1 ? prev.filter((_, i) => i !== idx) : prev);
  };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-background relative">
      {/* Header */}
      <div className="bg-card w-full border-b border-border shadow-sm p-6 shrink-0 relative z-10 hidden md:block">
        <div className="max-w-6xl mx-auto flex items-end justify-between gap-4">
          <div className="flex-1 space-y-1 relative pl-12">
            <div className="absolute left-0 top-0.5 bg-primary/10 w-10 h-10 rounded-lg flex items-center justify-center shadow-inner">
              <Wand2 className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">Generador Documental IA</h2>
            <p className="text-sm text-muted-foreground">Construcción automática de manuales y cuadros con modelo analítico archivístico.</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4 md:p-6 flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto w-full">

        {/* ── Panel Izquierdo ──────────────────────────────────────────── */}
        <div className="w-full lg:w-96 flex flex-col gap-4 shrink-0">

          {/* Tab selector */}
          <div className="bg-card border border-border shadow-sm rounded-xl p-4 flex flex-col gap-2">
            <div className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-1">Seleccione el Reporte</div>
            <button
              onClick={() => { setActiveTab("ccd"); setGeneratedHtml(""); setError(null); }}
              className={cn("w-full text-left px-4 py-3 rounded-lg border transition-all flex items-center gap-3",
                activeTab === "ccd" ? "bg-primary/10 border-primary text-primary shadow-sm" : "bg-background border-border text-foreground hover:bg-secondary")}
            >
              <Building2 className={cn("h-5 w-5", activeTab === "ccd" ? "text-primary" : "text-muted-foreground")} />
              <div className="flex flex-col">
                <span className="font-bold text-sm">Cuadro de Clasificación</span>
                <span className="text-xs opacity-80">CCD General Normativo</span>
              </div>
            </button>

            <button
              onClick={() => { setActiveTab("manual"); setGeneratedHtml(""); setError(null); }}
              className={cn("w-full text-left px-4 py-3 rounded-lg border transition-all flex items-center gap-3",
                activeTab === "manual" ? "bg-primary/10 border-primary text-primary shadow-sm" : "bg-background border-border text-foreground hover:bg-secondary")}
            >
              <Briefcase className={cn("h-5 w-5", activeTab === "manual" ? "text-primary" : "text-muted-foreground")} />
              <div className="flex flex-col">
                <span className="font-bold text-sm">Manual de Funciones</span>
                <span className="text-xs opacity-80">Uno o varios cargos</span>
              </div>
            </button>
          </div>

          {/* Controls */}
          <div className="bg-card border border-border shadow-sm rounded-xl p-5 flex flex-col gap-4">
            {generationMode === "ai" ? (
              activeTab === "ccd" ? (
                <>
                  <div className="text-sm font-semibold text-foreground">Generación Global</div>
                  <p className="text-xs text-muted-foreground -mt-2">La IA leerá todo el fondo estructurado para ensamblar el cuadro normativo.</p>
                  <button onClick={handleGenerateCCD} disabled={loading}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2.5 rounded-lg font-bold text-sm shadow transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                    {loading ? "Generando..." : "Generar CCD Automático"}
                  </button>
                </>
              ) : (
                /* ── MANUAL IA: multi-cargo ─────────────────────────── */
                <>
                  <div className="text-sm font-semibold text-foreground">Configurar Manual con IA</div>

                  {/* Dependencia */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-muted-foreground">Dependencia (Sección)</label>
                    <select
                      value={selectedDependenciaId}
                      onChange={(e) => setSelectedDependenciaId(e.target.value)}
                      className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                    >
                      <option value="">Seleccione una dependencia...</option>
                      {dependencias.map(dep => (
                        <option key={dep.id} value={dep.id}>{dep.codigo} - {dep.nombre}</option>
                      ))}
                    </select>
                  </div>

                  {/* Multi-cargo picker */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-muted-foreground">
                      Cargos a incluir <span className="text-primary">({selectedCargos.length} seleccionado{selectedCargos.length !== 1 ? "s" : ""})</span>
                    </label>

                    {/* Chips de cargos seleccionados */}
                    {selectedCargos.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 p-2 bg-primary/5 rounded-lg border border-primary/10">
                        {selectedCargos.map(c => (
                          <Chip key={c} label={c} onRemove={() => removeCargo(c)} />
                        ))}
                      </div>
                    )}

                    {/* Dropdown para añadir */}
                    <div className="flex gap-2">
                      <select
                        value={pickCargo}
                        onChange={(e) => setPickCargo(e.target.value)}
                        disabled={availableCargos.length === 0}
                        className="flex-1 bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm disabled:opacity-50"
                      >
                        <option value="">
                          {availableCargos.length === 0
                            ? cargosUnicos.length === 0 ? "Sin cargos registrados" : "Todos añadidos"
                            : "Añadir cargo..."}
                        </option>
                        {availableCargos.map(cargo => (
                          <option key={cargo} value={cargo}>{cargo}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => addCargo(pickCargo)}
                        disabled={!pickCargo}
                        className="shrink-0 bg-primary text-primary-foreground rounded-md px-3 py-2 disabled:opacity-40 hover:bg-primary/90 transition-all"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>

                    {cargosUnicos.length === 0 && (
                      <p className="text-[11px] text-muted-foreground italic">Registra entrevistados con sus cargos para habilitar esta opción.</p>
                    )}
                  </div>

                  <button
                    onClick={handleGenerateManual}
                    disabled={loading || !selectedDependenciaId || selectedCargos.length === 0}
                    className="w-full mt-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2.5 rounded-lg font-bold text-sm shadow transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                    {loading ? "Redactando..." : `Redactar Manual (${selectedCargos.length} cargo${selectedCargos.length !== 1 ? "s" : ""})`}
                  </button>
                </>
              )
            ) : (
              activeTab === "ccd" ? (
                <>
                  <div className="text-sm font-semibold text-foreground">Ensamblaje Manual (Directo BD)</div>
                  <p className="text-xs text-muted-foreground">El sistema cruzará dependencias y funciones como están en base de datos. Editable haciendo doble clic.</p>
                </>
              ) : (
                /* ── MANUAL LITERAL: multi-entry ────────────────────── */
                <>
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-sm font-semibold text-foreground">
                      Redactar Manual Formal <span className="text-primary font-bold">({manualEntries.length} cargo{manualEntries.length !== 1 ? "s" : ""})</span>
                    </div>
                    <button
                      onClick={addEntry}
                      className="flex items-center gap-1 text-xs font-bold text-primary hover:bg-primary/10 px-2 py-1 rounded-md transition-all"
                    >
                      <Plus className="h-3.5 w-3.5" /> Añadir cargo
                    </button>
                  </div>

                  <div className="flex flex-col gap-5 max-h-[60vh] overflow-y-auto pr-1">
                    {manualEntries.map((entry, idx) => (
                      <div key={idx} className="flex flex-col gap-2 p-3 bg-secondary/30 rounded-xl border border-border relative">
                        {/* Header del cargo */}
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-black text-muted-foreground uppercase tracking-wider">Cargo {idx + 1}</span>
                          {manualEntries.length > 1 && (
                            <button onClick={() => removeEntry(idx)} className="text-muted-foreground hover:text-destructive transition-colors">
                              <X className="h-4 w-4" />
                            </button>
                          )}
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase">Nombre del Cargo</label>
                          <input type="text" value={entry.cargo} onChange={e => updateEntry(idx, "cargo", e.target.value)}
                            className="bg-background border border-input rounded h-8 px-3 text-sm focus:ring-1 focus:ring-slate-400 focus:border-slate-400 outline-none"
                            placeholder="Ej. Jefe de Archivo" />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase">Propósito Principal</label>
                          <textarea value={entry.proposito} onChange={e => updateEntry(idx, "proposito", e.target.value)}
                            className="bg-background border border-input rounded min-h-16 p-2 text-sm focus:ring-1 focus:ring-slate-400 focus:border-slate-400 outline-none resize-none"
                            placeholder="Misión o propósito fundamental..." />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase">Funciones</label>
                          <select 
                            value=""
                            onChange={(e) => {
                              const selectedId = e.target.value;
                              if (!selectedId) return;
                              const currentSel = entry.funcionesSel || [];
                              if (!currentSel.includes(selectedId)) {
                                updateEntry(idx, "funcionesSel", [...currentSel, selectedId]);
                              }
                            }}
                            className="bg-background border border-input rounded h-9 px-3 text-sm focus:ring-1 focus:ring-slate-400 focus:border-slate-400 outline-none"
                          >
                            <option value="">Buscar y agregar función...</option>
                            {funcionesList.map(f => (
                              <option key={f.id} value={f.id}>
                                {f.codigo_funcion ? f.codigo_funcion + " - " : ""}{f.titulo}
                              </option>
                            ))}
                          </select>
                          
                          {(entry.funcionesSel || []).length > 0 && (
                            <div className="flex flex-col gap-1.5 mt-2 bg-slate-50 p-2 rounded border border-slate-100 max-h-32 overflow-y-auto">
                              {(entry.funcionesSel || []).map(fnId => {
                                const fnObj = funcionesList.find(f => f.id === fnId);
                                return (
                                  <div key={fnId} className="flex justify-between items-start text-xs p-1.5 bg-white border border-slate-200 rounded shadow-sm">
                                    <span className="font-medium text-slate-700 leading-tight pr-2">
                                      {fnObj ? fnObj.titulo : 'Función no encontrada'}
                                    </span>
                                    <button 
                                      onClick={() => updateEntry(idx, "funcionesSel", entry.funcionesSel.filter(id => id !== fnId))}
                                      title="Quitar función"
                                      className="text-slate-400 hover:text-destructive hover:bg-destructive/10 rounded p-1 transition-colors shrink-0"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[10px] font-bold text-muted-foreground uppercase">Relación con Áreas</label>
                          <input type="text" value={entry.relaciones} onChange={e => updateEntry(idx, "relaciones", e.target.value)}
                            className="bg-background border border-input rounded h-8 px-3 text-sm focus:ring-1 focus:ring-slate-400 focus:border-slate-400 outline-none"
                            placeholder="Otras dependencias vinculadas" />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )
            )}
          </div>
        </div>

        {/* ── Panel Derecho: Visor ─────────────────────────────────────── */}
        <div className="flex-1 bg-secondary/30 rounded-xl border border-border shadow-inner p-2 md:p-4 flex flex-col items-start overflow-y-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4 animate-pulse w-full">
              <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center">
                <Wand2 className="h-8 w-8 text-primary animate-bounce delay-150" />
              </div>
              <div className="text-lg font-bold text-foreground">Orianna está redactando el documento...</div>
              <p className="text-sm max-w-md text-center">Este proceso requiere análisis archivístico, puede tomar entre 15 a 30 segundos.</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full max-w-lg text-center gap-4 w-full">
              <div className="h-16 w-16 bg-destructive/10 rounded-full flex items-center justify-center">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
              <h3 className="text-xl font-bold text-foreground">Ocurrió un error</h3>
              <p className="text-muted-foreground">{error}</p>
            </div>
          ) : !generatedHtml ? (
            <div className="flex flex-col items-center justify-center h-full max-w-md text-center gap-4 opacity-50 w-full">
              <FileText className="h-16 w-16 text-muted-foreground" />
              <h3 className="text-xl font-bold text-foreground">Vista Previa del Documento</h3>
              <p className="text-sm text-muted-foreground">Configura los parámetros en el panel izquierdo y presiona generar para ver el resultado.</p>
            </div>
          ) : (
            <div className="w-full flex flex-col gap-6 items-center">
              <div className="w-full max-w-4xl flex justify-end">
                <button onClick={handleExportPDF}
                  className="bg-slate-800 text-white hover:bg-slate-700 px-4 py-2 rounded-md font-bold text-sm shadow inline-flex items-center gap-2 transition">
                  <Download className="h-4 w-4" /> Exportar PDF
                </button>
              </div>

              {/* Hoja A4 */}
              <div
                id="documento-generado"
                className="w-full bg-white text-black shadow-xl rounded-sm print-content"
                style={{ minHeight: "297mm", width: "210mm", fontFamily: "'Inter', 'Roboto', sans-serif", padding: "25mm 25mm 25mm 20px", boxSizing: "border-box" }}
              >
                <style>{`
                  @media print { #documento-generado { padding: 10px !important; } }
                  #documento-generado h1 { font-size: 24px; font-weight: 800; text-transform: uppercase; margin-bottom: 24px; text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; }
                  #documento-generado h2 { font-size: 18px; font-weight: 700; margin-top: 30px; margin-bottom: 12px; color: #333; }
                  #documento-generado h3 { font-size: 16px; font-weight: 600; margin-top: 20px; margin-bottom: 8px; }
                  #documento-generado p { font-size: 14px; line-height: 1.6; margin-bottom: 12px; text-align: justify; outline: none; }
                  #documento-generado ul, #documento-generado ol { font-size: 14px; margin-bottom: 16px; padding-left: 24px; }
                  #documento-generado li { margin-bottom: 8px; line-height: 1.5; }
                  #documento-generado table { width: 100%; border-collapse: collapse; margin-top: 20px; margin-bottom: 20px; font-size: 13px; }
                  #documento-generado th, #documento-generado td { border: 1px solid #ccc; padding: 10px 12px; text-align: left; }
                  #documento-generado th { background-color: #f2f2f2; font-weight: bold; }
                  #documento-generado hr { border: 0; border-top: 2px dashed #ccc; margin: 32px 0; }
                `}</style>
                <div
                  contentEditable
                  suppressContentEditableWarning
                  dangerouslySetInnerHTML={{ __html: generatedHtml }}
                  className="prose max-w-none prose-sm outline-none focus:outline-none"
                />
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
