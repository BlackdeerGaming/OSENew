import React, { useState, useEffect } from "react";
import { FileText, Download, Loader2, Wand2, Briefcase, FileUp, Building2, AlertCircle } from "lucide-react";
import { handleExportPDFGeneral } from "../../utils/exportUtils";
import { cn } from "@/lib/utils";
import API_BASE_URL from "../../config/api";

export default function GeneradorDocumentalView({ dependencias, entities, currentUser, forceMode }) {
  const [activeTab, setActiveTab] = useState("ccd"); // "ccd" o "manual"
  const generationMode = forceMode || "ai"; // prop instead of state
  const [entrevistadosList, setEntrevistadosList] = useState([]);
  const [funcionesList, setFuncionesList] = useState([]);
  
  // States for Manual IA
  const [selectedCargo, setSelectedCargo] = useState("");
  const [selectedDependenciaId, setSelectedDependenciaId] = useState("");

  // States for Manual Literal
  const [manualCargo, setManualCargo] = useState("");
  const [manualProposito, setManualProposito] = useState("");
  const [manualFunciones, setManualFunciones] = useState("");
  const [manualRelaciones, setManualRelaciones] = useState("");

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
        headers: { "Authorization": `Bearer ${currentUser?.token || ''}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        setEntrevistadosList(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchFunciones = async () => {
    try {
      const resp = await fetch(`${API_BASE_URL}/trd/entity/${activeEntityId}/funciones`, {
        headers: { "Authorization": `Bearer ${currentUser?.token || ''}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        setFuncionesList(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Re-compute manual CCD structure if mode changes
  useEffect(() => {
    if (generationMode === "manual") {
      if (activeTab === "ccd") {
         let html = `<h1>Cuadro de Clasificación Documental</h1>`;
         html += `<h2>Fondo: ${entities.find(e => e.id === activeEntityId)?.razonSocial || 'Entidad Central'}</h2>`;
         html += `<table border="1" width="100%"><thead><tr><th>Código</th><th>Sección (Dependencia)</th><th>Serie/Función</th></tr></thead><tbody>`;
         
         const rels = dependencias.filter(d => d.entity_id === activeEntityId || !d.entity_id);
         rels.forEach(dep => {
            const depFuns = funcionesList.filter(f => f.dependencia_id === dep.id);
            if (depFuns.length === 0) {
               html += `<tr><td>${dep.codigo || ''}</td><td><strong>${dep.nombre}</strong></td><td>Sin funciones</td></tr>`;
            } else {
               depFuns.forEach((f, idx) => {
                 html += `<tr>`;
                 if (idx === 0) {
                   html += `<td rowspan="${depFuns.length}">${dep.codigo || ''}</td>`;
                   html += `<td rowspan="${depFuns.length}"><strong>${dep.nombre}</strong></td>`;
                 }
                 html += `<td>${f.codigo_funcion ? f.codigo_funcion + " - " : ""}${f.titulo}</td>`;
                 html += `</tr>`;
               });
            }
         });
         html += `</tbody></table>`;
         setGeneratedHtml(html);
      } else {
         let html = `<h1>Manual de Funciones</h1>`;
         html += `<h2>Identificación del Cargo: ${manualCargo || '[Escriba Cargo]'}</h2>`;
         html += `<h3>Propósito Principal</h3><p>${manualProposito || 'Describa el propósito principal aquí...'}</p>`;
         html += `<h3>Funciones Principales y Deberes</h3><p>${manualFunciones.replace(/\n/g, '<br/>') || 'Liste las funciones...'}</p>`;
         html += `<h3>Relación con Otras Áreas</h3><p>${manualRelaciones || 'Describa dependencias inter-áreas...'}</p>`;
         setGeneratedHtml(html);
      }
    }
  }, [generationMode, activeTab, dependencias, funcionesList, activeEntityId, entities, manualCargo, manualProposito, manualFunciones, manualRelaciones]);

  const handleGenerateCCD = async () => {
    if (!activeEntityId) return;
    setLoading(true);
    setError(null);
    setGeneratedHtml("");

    try {
      const resp = await fetch(`${API_BASE_URL}/trd/entity/${activeEntityId}/generate/ccd`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${currentUser?.token || ''}` }
      });
      if (!resp.ok) throw new Error("Error generando CCD");
      const data = await resp.json();
      setGeneratedHtml(data.html);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateManual = async () => {
    if (!activeEntityId || !selectedCargo || !selectedDependenciaId) return;
    setLoading(true);
    setError(null);
    setGeneratedHtml("");

    try {
      const resp = await fetch(`${API_BASE_URL}/trd/entity/${activeEntityId}/generate/manual-funciones`, {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${currentUser?.token || ''}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          cargo: selectedCargo,
          dependencia_id: selectedDependenciaId
        })
      });
      if (!resp.ok) throw new Error("Error generando Manual");
      const data = await resp.json();
      setGeneratedHtml(data.html);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    const filename = activeTab === "ccd" 
      ? 'Cuadro_Clasificacion_Documental' 
      : `Manual_Funciones_${selectedCargo || 'cargo'}`;
    
    handleExportPDFGeneral('documento-generado', filename);
  };

  // Extraer lista única de cargos basados en la lista de entrevistados
  // Map cargo -> obj for easy picking
  const cargosUnicos = [];
  const mapCargos = new Set();
  entrevistadosList.forEach(e => {
     if (!mapCargos.has(e.cargo)) {
       mapCargos.add(e.cargo);
       cargosUnicos.push(e.cargo);
     }
  });

  return (
    <div className="flex flex-col h-full bg-background relative">
      {/* Header Panel */}
      <div className="bg-card w-full border-b border-border shadow-sm p-6 shrink-0 relative z-10 hidden md:block">
        <div className="max-w-6xl mx-auto flex items-end justify-between gap-4">
          <div className="flex-1 space-y-1 relative pl-12">
            <div className="absolute left-0 top-0.5 bg-primary/10 w-10 h-10 rounded-lg flex items-center justify-center shadow-inner">
              <Wand2 className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              Generador Documental IA
            </h2>
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              Construcción automática de manuales y cuadros con modelo analítico archivístico.
            </p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-4 md:p-6 flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto w-full">
        
        {/* Panel Izquierdo: Controles */}
        <div className="w-full lg:w-96 flex flex-col gap-4 shrink-0">
          <div className="bg-card border border-border shadow-sm rounded-xl p-4 flex flex-col gap-2">
            <div className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-1">Seleccione el Reporte</div>
            
            <button 
              onClick={() => { setActiveTab("ccd"); setGeneratedHtml(""); setError(null); }}
              className={cn(
                "w-full text-left px-4 py-3 rounded-lg border transition-all flex items-center gap-3",
                activeTab === "ccd" 
                  ? "bg-primary/10 border-primary text-primary shadow-sm" 
                  : "bg-background border-border text-foreground hover:bg-secondary"
              )}
            >
              <Building2 className={cn("h-5 w-5", activeTab === "ccd" ? "text-primary" : "text-muted-foreground")} />
              <div className="flex flex-col">
                <span className="font-bold text-sm">Cuadro de Clasificación</span>
                <span className="text-xs opacity-80">CCD General Normativo</span>
              </div>
            </button>

            <button 
              onClick={() => { setActiveTab("manual"); setGeneratedHtml(""); setError(null); }}
              className={cn(
                "w-full text-left px-4 py-3 rounded-lg border transition-all flex items-center gap-3",
                activeTab === "manual" 
                  ? "bg-primary/10 border-primary text-primary shadow-sm" 
                  : "bg-background border-border text-foreground hover:bg-secondary"
              )}
            >
              <Briefcase className={cn("h-5 w-5", activeTab === "manual" ? "text-primary" : "text-muted-foreground")} />
              <div className="flex flex-col">
                <span className="font-bold text-sm">Manual de Funciones</span>
                <span className="text-xs opacity-80">Específico por Cargo</span>
              </div>
            </button>
          </div>

          <div className="bg-card border border-border shadow-sm rounded-xl p-5 flex flex-col gap-4">
             {generationMode === "ai" ? (
               activeTab === "ccd" ? (
                  <>
                    <div className="text-sm font-semibold text-foreground">Generación Global</div>
                    <p className="text-xs text-muted-foreground mb-4">
                      La inteligencia artificial leerá todo el fondo estructurado (Entidad, Secciones y Series de la TRD) para ensamblar el cuadro normativo.
                    </p>
                    <button 
                      onClick={handleGenerateCCD}
                      disabled={loading}
                      className="w-full bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2.5 rounded-lg font-bold text-sm shadow transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70 disabled:active:scale-100"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                      {loading ? "Generando..." : "Generar CCD Automático"}
                    </button>
                  </>
               ) : (
                  <>
                    <div className="text-sm font-semibold text-foreground mb-2">Configurar Manual con IA</div>
                    
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

                    <div className="flex flex-col gap-1.5 mt-2">
                      <label className="text-xs font-bold text-muted-foreground">Cargo (extraído de entrevistas)</label>
                      <select 
                        value={selectedCargo}
                        onChange={(e) => setSelectedCargo(e.target.value)}
                        className="w-full bg-background border border-input rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                        disabled={cargosUnicos.length === 0}
                      >
                        <option value="">{cargosUnicos.length === 0 ? "No hay cargos registrados" : "Seleccione un cargo..."}</option>
                        {cargosUnicos.map(cargo => (
                          <option key={cargo} value={cargo}>{cargo}</option>
                        ))}
                      </select>
                    </div>

                    <button 
                      onClick={handleGenerateManual}
                      disabled={loading || !selectedDependenciaId || !selectedCargo}
                      className="w-full mt-4 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2.5 rounded-lg font-bold text-sm shadow transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-70 disabled:active:scale-100"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                      {loading ? "Redactando..." : "Redactar Manual IA"}
                    </button>
                  </>
               )
             ) : (
                activeTab === "ccd" ? (
                  <>
                    <div className="text-sm font-semibold text-foreground">Ensamblaje Manual (Directo BD)</div>
                    <p className="text-xs text-muted-foreground mb-4">
                      El sistema cruzará dependencias y funciones exactamente como están capturadas en base de datos. Modifícalo libremente si es necesario haciendo doble clic en el documento generado a tu derecha.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="text-sm font-semibold text-foreground mb-3">Redactar Manual Formal</div>
                    
                    <div className="flex flex-col gap-3">
                       <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-bold text-muted-foreground uppercase">Cargo</label>
                          <input type="text" value={manualCargo} onChange={(e) => setManualCargo(e.target.value)} className="bg-background border border-input rounded h-9 px-3 text-sm focus:ring-1 focus:ring-slate-400 focus:border-slate-400 outline-none" placeholder="Nombre Oficial del Cargo" />
                       </div>
                       <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-bold text-muted-foreground uppercase">Propósito Principal</label>
                          <textarea value={manualProposito} onChange={(e) => setManualProposito(e.target.value)} className="bg-background border border-input rounded min-h-20 p-2 text-sm focus:ring-1 focus:ring-slate-400 focus:border-slate-400 outline-none resize-none" placeholder="Misión o propósito fundamental..."></textarea>
                       </div>
                       <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-bold text-muted-foreground uppercase">Funciones</label>
                          <textarea value={manualFunciones} onChange={(e) => setManualFunciones(e.target.value)} className="bg-background border border-input rounded min-h-24 p-2 text-sm focus:ring-1 focus:ring-slate-400 focus:border-slate-400 outline-none resize-none" placeholder="1. Coordinar...&#10;2. Ejecutar..."></textarea>
                       </div>
                       <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-bold text-muted-foreground uppercase">Relación Áreas</label>
                          <input type="text" value={manualRelaciones} onChange={(e) => setManualRelaciones(e.target.value)} className="bg-background border border-input rounded h-9 px-3 text-sm focus:ring-1 focus:ring-slate-400 focus:border-slate-400 outline-none" placeholder="Otras dependencias vinculadas" />
                       </div>
                    </div>
                  </>
                )
             )}
          </div>
        </div>

        {/* Panel Derecho: Visor del Documento */}
        <div className="flex-1 bg-secondary/30 rounded-xl border border-border shadow-inner p-4 md:p-8 flex flex-col items-center overflow-y-auto">
           {loading ? (
             <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4 animate-pulse">
                <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center">
                   <Wand2 className="h-8 w-8 text-primary animate-bounce delay-150" />
                </div>
                <div className="text-lg font-bold text-foreground">Orianna está redactando el documento...</div>
                <p className="text-sm max-w-md text-center">Este proceso requiere análisis archivístico, puede tomar entre 15 a 30 segundos.</p>
             </div>
           ) : error ? (
             <div className="flex flex-col items-center justify-center h-full max-w-lg text-center gap-4">
                <div className="h-16 w-16 bg-destructive/10 rounded-full flex items-center justify-center">
                   <AlertCircle className="h-8 w-8 text-destructive" />
                </div>
                <h3 className="text-xl font-bold text-foreground">Ocurrió un error</h3>
                <p className="text-muted-foreground">{error}</p>
             </div>
           ) : !generatedHtml ? (
             <div className="flex flex-col items-center justify-center h-full max-w-md text-center gap-4 opacity-50">
                <FileText className="h-16 w-16 text-muted-foreground" />
                <h3 className="text-xl font-bold text-foreground">Vista Previa del Documento</h3>
                <p className="text-sm text-muted-foreground">Configura los parámetros en el panel izquierdo y presiona generar para ver el resultado redactado por el sistema.</p>
             </div>
           ) : (
             <div className="w-full flex flex-col gap-6 items-center">
                <div className="w-full max-w-4xl flex justify-end">
                   <button 
                     onClick={handleExportPDF}
                     className="bg-slate-800 text-white hover:bg-slate-700 px-4 py-2 rounded-md font-bold text-sm shadow inline-flex items-center gap-2 transition"
                   >
                     <Download className="h-4 w-4" /> Exportar PDF
                   </button>
                </div>
                {/* Hoja A4 virtual */}
                <div 
                  id="documento-generado"
                  className="w-full max-w-4xl bg-white text-black p-10 md:p-16 shadow-xl rounded-sm print-content"
                  style={{ minHeight: "297mm", fontFamily: "'Inter', 'Roboto', sans-serif" }}
                >
                  <style>
                    {`
                      @media print {
                        #documento-generado { padding: 10px !important; }
                      }
                      #documento-generado h1 { font-size: 24px; font-weight: 800; text-transform: uppercase; margin-bottom: 24px; text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; }
                      #documento-generado h2 { font-size: 18px; font-weight: 700; margin-top: 30px; margin-bottom: 12px; color: #333; }
                        #documento-generado h3 { font-size: 16px; font-weight: 600; margin-top: 20px; margin-bottom: 8px; }
                        #documento-generado p { font-size: 14px; line-height: 1.6; margin-bottom: 12px; text-align: justify; outline: none; }
                        #documento-generado ul, #documento-generado ol { font-size: 14px; margin-bottom: 16px; padding-left: 24px; }
                      #documento-generado li { margin-bottom: 8px; line-height: 1.5; }
                      #documento-generado table { width: 100%; border-collapse: collapse; margin-top: 20px; margin-bottom: 20px; font-size: 13px; }
                      #documento-generado th, #documento-generado td { border: 1px solid #ccc; padding: 10px 12px; text-align: left; }
                      #documento-generado th { background-color: #f2f2f2; font-weight: bold; }
                    `}
                  </style>
                  <div contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: generatedHtml }} className="prose max-w-none prose-sm outline-none focus:outline-none" />
                </div>
             </div>
           )}
        </div>

      </div>
    </div>
  );
}
