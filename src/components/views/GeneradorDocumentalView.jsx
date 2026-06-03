import React, { useState, useEffect, useRef, useCallback } from "react";
import { FileText, Download, Loader2, Wand2, Briefcase, Building2, AlertCircle, Plus, X, ChevronDown, Save, History, CheckCircle2, RotateCcw, Layers, GitBranch } from "lucide-react";
import { handleExportPDFGeneral } from "../../utils/exportUtils";
import { cn } from "@/lib/utils";
import API_BASE_URL from "../../config/api";
import ViewHeader from "../ui/ViewHeader";
import CCDTable from "../trd/CCDTable";

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

export default function GeneradorDocumentalView({ dependencias, entities, currentUser, forceMode, selectedEntityId }) {

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
  const [ccdData, setCcdData] = useState(null);       // datos estructurados CCD (AGN format)
  const [ccdFlatMode, setCcdFlatMode] = useState(false);            // false = jerárquico, true = plano
  const [ccdOrientation, setCcdOrientation] = useState("landscape"); // landscape | portrait
  const [ccdPageSize,    setCcdPageSize]    = useState("a4");        // a4 | carta | oficio
  const [ccdZoom,        setCcdZoom]        = useState(75);          // % zoom visual pantalla
  const ccdContainerRef = useRef(null);
  const [officialDocs, setOfficialDocs] = useState([]);
  const [showConfirmSave, setShowConfirmSave] = useState(false);
  const [isSavingOfficial, setIsSavingOfficial] = useState(false);

  const activeEntityId = selectedEntityId || entities?.[0]?.id || currentUser?.entidadId || currentUser?.entity_id;

  // Ancho del papel en px a 96 dpi (25.4 mm = 1 inch = 96 px)
  const PAPER_PX = {
    a4:    { landscape: 1123, portrait: 794  },
    carta: { landscape: 1054, portrait: 816  },
    oficio:{ landscape: 1345, portrait: 816  },
  };

  // Calcula el zoom para que el papel quepa exacto en el contenedor
  const calcAutoZoom = useCallback(() => {
    if (!ccdContainerRef.current) return;
    const available = ccdContainerRef.current.clientWidth - 8; // 4px padding c/lado
    const paperW    = PAPER_PX[ccdPageSize]?.[ccdOrientation] ?? 1123;
    // Sin mínimo: el zoom encoge hasta que el papel quepa exacto en el contenedor
    setCcdZoom(Math.min(100, Math.floor((available / paperW) * 100)));
  }, [ccdPageSize, ccdOrientation]);

  // Re-calcular cuando cambia orientación o tamaño de papel
  useEffect(() => { calcAutoZoom(); }, [calcAutoZoom]);

  // Re-calcular cuando el contenedor cambia de tamaño (panel Orianna abierto/cerrado)
  useEffect(() => {
    const el = ccdContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(calcAutoZoom);
    ro.observe(el);
    return () => ro.disconnect();
  }, [calcAutoZoom, ccdData]);


  useEffect(() => {
    if (activeEntityId) {
      fetchEntrevistados();
      fetchFunciones();
      fetchOfficialDocs();
    }
  }, [activeEntityId]);

  const fetchOfficialDocs = async () => {
    if (!activeEntityId) return;
    try {
      const resp = await fetch(`${API_BASE_URL}/trd/entity/${activeEntityId}/documentos-oficiales`, {
        headers: { "Authorization": `Bearer ${currentUser?.token || ""}` }
      });
      if (resp.ok) setOfficialDocs(await resp.json());
    } catch (e) { console.error(e); }
  };

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

  // Auto-carga el CCD en formato AGN al entrar al tab o cambiar de entidad
  useEffect(() => {
    if (activeTab === "ccd" && activeEntityId && !loading) {
      handleLoadCCD();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, activeEntityId]);

  useEffect(() => {
    if (generationMode === "manual" || generationMode === "standard") {
      if (activeTab === "ccd") {
        // El CCD ahora usa el formato AGN (auto-cargado por el useEffect anterior)
      } else {
        // --- MANUAL DE FUNCIONES: HERENCIA AUTOMÁTICA ---
        let html = `<h1 style="text-align:center;">Manual de Funciones y Competencias</h1>`;
        html += `<h2 style="text-align:center;color:#666;margin-bottom:40px;">${entities.find(e => e.id === activeEntityId)?.razonSocial || "Entidad Central"}</h2>`;
        
        const rels = dependencias.filter(d => String(d.entidadId) === String(activeEntityId));
        
        if (rels.length === 0) {
          html += `<p style="text-align:center;margin-top:60px;color:#999;">No se encontraron dependencias para generar el manual.</p>`;
        } else {
          let hasFunctions = false;
          rels.forEach((dep, idx) => {
            const depFuns = funcionesList.filter(f => String(f.dependencia_id) === String(dep.id));
            if (depFuns.length > 0) {
              hasFunctions = true;
              if (idx > 0) html += `<div style="page-break-before:always;height:20px;"></div>`;
              
              html += `<div style="border:2px solid #333;padding:20px;margin-bottom:30px;">`;
              html += `<h2 style="margin:0;border-bottom:1px solid #eee;padding-bottom:10px;">I. IDENTIFICACIÓN DE LA UNIDAD</h2>`;
              html += `<table width="100%" style="margin-top:15px;border:none;">
                        <tr><td width="30%"><strong>Denominación:</strong></td><td>${dep.nombre}</td></tr>
                        <tr><td><strong>Código:</strong></td><td>${dep.codigo || "S/C"}</td></tr>
                        <tr><td><strong>Sigla:</strong></td><td>${dep.sigla || "S/S"}</td></tr>
                        <tr><td><strong>Ubicación:</strong></td><td>${dep.ciudad || ""}, ${dep.departamento || ""}</td></tr>
                      </table>`;
              html += `</div>`;

              html += `<h2 style="background:#eee;padding:10px;">II. PROPÓSITO PRINCIPAL</h2>`;
              html += `<p style="text-align:justify;">Ejecutar y coordinar las funciones administrativas y técnicas asignadas a la unidad de <strong>${dep.nombre}</strong>, asegurando el cumplimiento de la misión institucional y la normativa archivística vigente (Ley 594 de 2000).</p>`;

              html += `<h2 style="background:#eee;padding:10px;">III. DESCRIPCIÓN DE FUNCIONES ESENCIALES</h2>`;
              html += `<table border="1" width="100%" style="border-collapse:collapse;margin-top:10px;">
                        <thead style="background:#f2f2f2;">
                          <tr><th width="15%">CÓDIGO</th><th>DESCRIPCIÓN DE LA FUNCIÓN</th></tr>
                        </thead>
                        <tbody>`;
              
              depFuns.forEach(f => {
                html += `<tr>
                          <td style="text-align:center;font-family:monospace;">${f.codigo_funcion || "---"}</td>
                          <td><strong>${f.titulo}</strong><br/><span style="font-size:12px;color:#555;">${f.descripcion || ""}</span></td>
                        </tr>`;
              });
              
              html += `</tbody></table>`;
              
              html += `<h2 style="background:#eee;padding:10px;margin-top:30px;">IV. CONTRIBUCIONES INTEGRALES</h2>`;
              html += `<p>Los productos y servicios derivados de estas funciones contribuyen directamente a la eficiencia operativa de la entidad y al fortalecimiento del patrimonio documental del Estado.</p>`;
            }
          });

          if (!hasFunctions) {
            html += `<div style="text-align:center;padding:100px 0;">
                      <p style="font-size:18px;color:#666;">No hay <strong>Funciones</strong> asociadas a las dependencias de esta entidad.</p>
                      <p style="color:#999;">Por favor, registre las funciones en el módulo de "Funciones" para que aparezcan aquí automáticamente.</p>
                    </div>`;
          }
        }
        setGeneratedHtml(html);
      }
    }
  }, [generationMode, activeTab, dependencias, funcionesList, activeEntityId, entities]);


  // ── Handlers ────────────────────────────────────────────────────────────

  /** Carga el CCD estructurado en formato AGN (10 columnas, sin IA). */
  const handleLoadCCD = async () => {
    if (!activeEntityId) return;
    setLoading(true); setError(null); setCcdData(null); setGeneratedHtml("");
    try {
      const resp = await fetch(`${API_BASE_URL}/trd/entity/${activeEntityId}/ccd-data`, {
        headers: { "Authorization": `Bearer ${currentUser?.token || ""}` }
      });
      if (!resp.ok) throw new Error("Error cargando CCD");
      const data = await resp.json();
      setCcdData(data);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  /** Genera el CCD usando IA (mantiene compatibilidad para modo AI avanzado). */
  const handleGenerateCCD = async () => {
    if (!activeEntityId) return;
    setLoading(true); setError(null); setGeneratedHtml(""); setCcdData(null);
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
    const orientation = activeTab === "ccd" ? ccdOrientation : "portrait";
    // exportUtils usa "letter"/"legal"/"a4" — mapeamos los nombres de pantalla
    const paperMap  = { a4: "a4", carta: "letter", oficio: "legal" };
    const paperSize = paperMap[activeTab === "ccd" ? ccdPageSize : "a4"] || "a4";
    handleExportPDFGeneral("documento-generado", label, orientation, paperSize);
  };

  const handleSaveOfficial = async () => {
    const hasCcdContent = activeTab === "ccd" && ccdData;
    if (!hasCcdContent && !generatedHtml) return;
    if (!activeEntityId) return;
    setIsSavingOfficial(true);

    // Para el CCD estructurado, capturamos el HTML renderizado del DOM
    let contenidoToSave = generatedHtml;
    if (hasCcdContent) {
      const el = document.getElementById("documento-generado");
      contenidoToSave = el ? el.outerHTML : "";
    }

    try {
      const tipo = activeTab === "ccd" ? "ccd" : "manual_funciones";
      const resp = await fetch(`${API_BASE_URL}/trd/entity/${activeEntityId}/documentos-oficiales`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${currentUser?.token || ""}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ tipo, contenido: contenidoToSave })
      });
      if (!resp.ok) throw new Error("Error al guardar el documento oficial");
      await fetchOfficialDocs();
      setShowConfirmSave(false);
      alert("Documento guardado como versión ACTIVA. El anterior ha pasado a BACKUP.");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSavingOfficial(false);
    }
  };

  const handleRestore = async (docId) => {
    if (!confirm("¿Deseas restaurar este backup? El documento activo actual pasará a ser el nuevo backup.")) return;
    setLoading(true);
    try {
      const resp = await fetch(`${API_BASE_URL}/trd/entity/${activeEntityId}/documentos-oficiales/restore/${docId}`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${currentUser?.token || ""}` }
      });
      if (!resp.ok) throw new Error("Error al restaurar el documento");
      await fetchOfficialDocs();
      const restored = await resp.json();
      setGeneratedHtml(restored.contenido);
      alert("Documento restaurado con éxito.");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const activeDoc = officialDocs.find(d => d.tipo === (activeTab === "ccd" ? "ccd" : "manual_funciones") && d.is_active);
  const backupDoc = officialDocs.find(d => d.tipo === (activeTab === "ccd" ? "ccd" : "manual_funciones") && d.is_backup);

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
    <div className="flex flex-col min-h-full bg-background">
      <ViewHeader
        icon={Wand2}
        title="Generador Documental IA"
        subtitle="Generación automática de manuales y cuadros con herencia de funciones y modelo IA"
        actions={
          <button
            onClick={() => {
              fetchEntrevistados();
              fetchFunciones();
              fetchOfficialDocs();
            }}
            className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-secondary/80 text-foreground rounded-lg text-xs font-bold transition-all border border-border"
          >
            <RotateCcw className="h-4 w-4" />
            SINCRONIZAR DATOS
          </button>
        }
      />

      <div className="p-4 md:p-6 flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto w-full">

        {/* ── Panel Izquierdo ──────────────────────────────────────────── */}
        <div className="w-full lg:w-96 flex flex-col gap-4 shrink-0">

          {/* Tab selector */}
          <div className="bg-card border border-border shadow-sm rounded-xl p-4 flex flex-col gap-2">
            <div className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-1">Seleccione el Reporte</div>
            <button
              onClick={() => { setActiveTab("ccd"); setGeneratedHtml(""); setCcdData(null); setError(null); }}
              className={cn("w-full text-left px-4 py-3 rounded-lg border transition-all flex items-center gap-3",
                activeTab === "ccd" ? "bg-primary/10 border-primary text-primary shadow-sm" : "bg-background border-border text-foreground hover:bg-secondary")}
            >
              <Building2 className={cn("h-5 w-5", activeTab === "ccd" ? "text-primary" : "text-muted-foreground")} />
              <div className="flex flex-col">
                <span className="font-bold text-sm">Cuadro de Clasificación</span>
                <span className="text-xs opacity-80">CCD con Herencia de Funciones</span>

              </div>
            </button>

            <button
              onClick={() => { setActiveTab("manual"); setGeneratedHtml(""); setCcdData(null); setError(null); }}
              className={cn("w-full text-left px-4 py-3 rounded-lg border transition-all flex items-center gap-3",
                activeTab === "manual" ? "bg-primary/10 border-primary text-primary shadow-sm" : "bg-background border-border text-foreground hover:bg-secondary")}
            >
              <Briefcase className={cn("h-5 w-5", activeTab === "manual" ? "text-primary" : "text-muted-foreground")} />
              <div className="flex flex-col">
                <span className="font-bold text-sm">Manual de Funciones</span>
                <span className="text-xs opacity-80">Herencia Automática por Dependencia</span>

              </div>
            </button>
          </div>

          {/* Controls */}
          <div className="bg-card border border-border shadow-sm rounded-xl p-5 flex flex-col gap-4">
            {generationMode === "ai" ? (
              activeTab === "ccd" ? (
                <>
                  <div className="text-sm font-semibold text-foreground">Formato AGN — Acuerdo 001 / 2024</div>
                  <p className="text-xs text-muted-foreground -mt-2">
                    Genera el CCD en el formato oficial del Archivo General de la Nación (10 columnas, pie de firmas).
                  </p>
                  <button onClick={handleLoadCCD} disabled={loading}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2.5 rounded-lg font-bold text-sm shadow transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
                    {loading ? "Cargando..." : "Generar CCD"}
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
                  <div className="text-sm font-semibold text-foreground">Formato AGN — Acuerdo 001 / 2024</div>
                  <p className="text-xs text-muted-foreground">
                    Genera el CCD en el formato oficial del Archivo General de la Nación (10 columnas, pie de firmas).
                  </p>
                  <button onClick={handleLoadCCD} disabled={loading}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2.5 rounded-lg font-bold text-sm shadow transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Building2 className="h-4 w-4" />}
                    {loading ? "Cargando..." : "Generar CCD"}
                  </button>
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

          {/* Versioning status panel */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
             <div className="flex items-center gap-2 text-xs font-black text-slate-500 uppercase tracking-widest">
               <History size={14} /> Control de Versiones
             </div>

             <div className="space-y-2">
                <div className={cn(
                  "p-3 rounded-lg border flex flex-col gap-1 transition-all",
                  activeDoc ? "bg-emerald-50 border-emerald-100" : "bg-slate-100/50 border-slate-100 grayscale opacity-60"
                )}>
                   <div className="flex items-center justify-between">
                     <span className="text-[10px] font-bold text-emerald-700 uppercase">Versión Activa</span>
                     {activeDoc && <CheckCircle2 size={12} className="text-emerald-500" />}
                   </div>
                   <div className="text-xs font-bold text-slate-700">
                     {activeDoc ? `Última actualización: ${new Date(activeDoc.created_at).toLocaleDateString()}` : "No hay documento activo"}
                   </div>
                   {activeDoc && (
                     <button 
                       onClick={() => setGeneratedHtml(activeDoc.contenido)}
                       className="text-[10px] text-emerald-600 font-bold hover:underline text-left mt-1"
                     >
                       CARGAR EN VISOR
                     </button>
                   )}
                </div>

                {backupDoc && (
                  <div className="p-3 rounded-lg border bg-amber-50 border-amber-100 flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-amber-700 uppercase">Respaldo (Backup)</span>
                      <RotateCcw size={12} className="text-amber-500" />
                    </div>
                    <div className="text-xs font-bold text-slate-700">
                      Fecha: {new Date(backupDoc.created_at).toLocaleDateString()}
                    </div>
                    <div className="flex gap-3 mt-1">
                      <button 
                        onClick={() => setGeneratedHtml(backupDoc.contenido)}
                        className="text-[10px] text-amber-600 font-bold hover:underline"
                      >
                        VER CONTENIDO
                      </button>
                      <button 
                        onClick={() => handleRestore(backupDoc.id)}
                        className="text-[10px] text-amber-600 font-bold hover:underline"
                      >
                        RESTAURAR A ACTIVO
                      </button>
                    </div>
                  </div>
                )}
             </div>
          </div>
        </div>

        {/* ── Panel Derecho: Visor ─────────────────────────────────────── */}
        <div className="flex-1 min-w-0 overflow-hidden bg-secondary/30 rounded-xl border border-border shadow-inner p-2 md:p-4 flex flex-col items-start">
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
          ) : (!generatedHtml && !ccdData) ? (
            <div className="flex flex-col items-center justify-center h-full max-w-md text-center gap-4 opacity-50 w-full">
              <FileText className="h-16 w-16 text-muted-foreground" />
              <h3 className="text-xl font-bold text-foreground">Vista Previa del Documento</h3>
              <p className="text-sm text-muted-foreground">Configura los parámetros en el panel izquierdo y presiona generar para ver el resultado.</p>
            </div>
          ) : (
            <div className="w-full flex flex-col gap-6 items-center">
              {/* Botones de acción */}
              <div className="w-full max-w-5xl flex justify-between items-center flex-wrap gap-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <button
                    onClick={() => setShowConfirmSave(true)}
                    className="bg-emerald-600 text-white hover:bg-emerald-500 px-4 py-2 rounded-md font-bold text-sm shadow inline-flex items-center gap-2 transition active:scale-95"
                  >
                    <Save className="h-4 w-4" /> Guardar como Oficial
                  </button>
                  {activeDoc && (
                    <div className="flex items-center gap-2 bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-full text-[10px] font-black uppercase">
                      <CheckCircle2 size={12} /> Documento Activo
                    </div>
                  )}
                  {/* Toggles de vista — solo en tab CCD */}
                  {activeTab === "ccd" && ccdData && (
                    <>
                      <button
                        onClick={() => setCcdFlatMode(m => !m)}
                        title={ccdFlatMode ? "Cambiar a vista jerárquica" : "Cambiar a vista plana"}
                        className={cn(
                          "px-3 py-2 rounded-md font-bold text-xs shadow inline-flex items-center gap-2 transition border",
                          ccdFlatMode
                            ? "bg-indigo-600 text-white border-indigo-700 hover:bg-indigo-500"
                            : "bg-white text-indigo-700 border-indigo-300 hover:bg-indigo-50"
                        )}
                      >
                        {ccdFlatMode
                          ? <><GitBranch className="h-3.5 w-3.5" /> Vista Jerárquica</>
                          : <><Layers className="h-3.5 w-3.5" /> Vista Plana</>
                        }
                      </button>
                      <button
                        onClick={() => setCcdOrientation(o => o === "landscape" ? "portrait" : "landscape")}
                        title={ccdOrientation === "landscape" ? "Cambiar a orientación vertical" : "Cambiar a orientación horizontal"}
                        className={cn(
                          "px-3 py-2 rounded-md font-bold text-xs shadow inline-flex items-center gap-2 transition border",
                          ccdOrientation === "portrait"
                            ? "bg-amber-600 text-white border-amber-700 hover:bg-amber-500"
                            : "bg-white text-amber-700 border-amber-300 hover:bg-amber-50"
                        )}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        {ccdOrientation === "landscape" ? "Horizontal" : "Vertical"}
                      </button>
                      {/* Zoom */}
                      <div className="flex items-center gap-0 border border-slate-300 rounded-md overflow-hidden shadow-sm text-xs font-bold">
                        <button onClick={() => setCcdZoom(z => Math.max(40, z - 5))} className="px-2.5 py-2 bg-white text-slate-600 hover:bg-slate-100 transition">−</button>
                        <span className="px-2 py-2 bg-white text-slate-700 select-none min-w-[44px] text-center">{ccdZoom}%</span>
                        <button onClick={() => setCcdZoom(z => Math.min(150, z + 5))} className="px-2.5 py-2 bg-white text-slate-600 hover:bg-slate-100 transition">+</button>
                        <button onClick={() => setCcdZoom(100)} title="Restablecer zoom" className="px-2.5 py-2 bg-white text-slate-500 hover:bg-slate-100 transition border-l border-slate-300">
                          <RotateCcw className="h-3 w-3" />
                        </button>
                      </div>
                      {/* Selector tamaño de papel */}
                      <div className="flex items-center gap-1 border border-slate-300 rounded-md overflow-hidden shadow-sm text-xs font-bold">
                        {["a4", "carta", "oficio"].map(sz => (
                          <button
                            key={sz}
                            onClick={() => setCcdPageSize(sz)}
                            className={cn(
                              "px-2.5 py-2 transition uppercase tracking-wide",
                              ccdPageSize === sz
                                ? "bg-slate-700 text-white"
                                : "bg-white text-slate-600 hover:bg-slate-100"
                            )}
                          >
                            {sz === "a4" ? "A4" : sz === "carta" ? "Carta" : "Oficio"}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <button
                  onClick={handleExportPDF}
                  className="bg-slate-800 text-white hover:bg-slate-700 px-4 py-2 rounded-md font-bold text-sm shadow inline-flex items-center gap-2 transition"
                >
                  <Download className="h-4 w-4" /> Exportar PDF
                </button>
              </div>

              {/* ── CCD estructurado (formato AGN) ─────────────────────── */}
              {activeTab === "ccd" && ccdData ? (
                /* Zoom wrapper — fuera de documento-generado → PDF no se ve afectado */
                <div ref={ccdContainerRef} style={{ width: "100%", overflow: "hidden" }}>
                  <div style={{
                    transform:       `scale(${ccdZoom / 100})`,
                    transformOrigin: "top left",
                    marginBottom:    `${(ccdZoom - 100) * -0.5}%`,
                    transition:      "transform 0.15s ease",
                  }}>
                    <div id="documento-generado">
                      <CCDTable
                        data={ccdData}
                        entityName={entities?.find(e => e.id === activeEntityId)?.razonSocial || ""}
                        flatMode={ccdFlatMode}
                        orientation={ccdOrientation}
                        pageSize={ccdPageSize}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                /* ── Manual / HTML generado por IA ──────────────────────── */
                <div
                  id="documento-generado"
                  className="w-full bg-white text-black shadow-xl rounded-sm print-content"
                  style={{
                    minHeight: "297mm",
                    width: "210mm",
                    fontFamily: "'Inter', 'Roboto', sans-serif",
                    padding: "25mm 25mm 25mm 20px",
                    boxSizing: "border-box",
                  }}
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
              )}
            </div>
          )}
        </div>

      </div>

      {/* Confirmation Modal */}
      {showConfirmSave && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center mb-4 mx-auto">
                <AlertCircle className="h-6 w-6 text-amber-600" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 text-center mb-2">¿Confirmar Versión Oficial?</h3>
              <p className="text-sm text-slate-500 text-center mb-6">
                Esta acción establecerá el documento actual como la <strong>Versión Activa</strong> de la entidad. 
                El documento activo actual se guardará como <strong>Backup</strong> y el respaldo anterior será reemplazado permanentemente.
              </p>
              
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleSaveOfficial}
                  disabled={isSavingOfficial}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2"
                >
                  {isSavingOfficial ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {isSavingOfficial ? "Guardando..." : "Sí, Reemplazar y Guardar"}
                </button>
                <button
                  onClick={() => setShowConfirmSave(false)}
                  disabled={isSavingOfficial}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-600 py-3 rounded-xl font-bold text-sm transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
            <div className="bg-slate-50 p-4 border-t border-slate-100">
              <p className="text-[10px] text-slate-400 text-center uppercase font-black tracking-widest">
                Sistema de Control de Versiones OSE IA
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
