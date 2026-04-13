import React from "react";
import { Table, Printer, Check, Info, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * ESTILO ORGANIGRAMA: 
 * Usamos colores HEX puros (#xxxxxx) y bordes de 1px real para evitar que 
 * el motor de captura (html2canvas/dom-to-image) engorde las líneas (problema OKLCH).
 */
const HEX_BORDER = "#000000"; // Negro Puro Institucional
const HEX_BORDER_LIGHT = "#334155"; // Slate 700 para líneas de apoyo
const HEX_BG_HEADER = "#ffffff"; // Blanco puro como la referencia
const B = `1px solid ${"#000000"}`; // Borde delgado uniforme

export default function TRDGenerator({ rows = [], selectedIds = new Set(), onToggleRow, onToggleAll, currentUser, currentEntity, logoBase64 }) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-12 text-muted-foreground bg-white rounded-2xl border border-dashed" style={{ borderColor: HEX_BORDER_LIGHT }}>
        <div className="p-4 rounded-full mb-4" style={{ backgroundColor: HEX_BG_HEADER }}>
          <Table className="h-10 w-10" style={{ color: HEX_BORDER_LIGHT }} />
        </div>
        <p className="font-bold text-slate-800 text-lg">Tabla de Retención Vacía</p>
        <p className="text-sm mt-2 max-w-sm text-center text-slate-500 font-medium">
          Para generar el reporte oficial, primero debes completar la valoración técnica de tus series en el módulo "Valoración TRD".
        </p>
      </div>
    );
  }

  const exportRows = selectedIds.size > 0 ? rows.filter(r => selectedIds.has(r.id)) : rows;
  const oficinaPrincipal = rows[0]?.dependencia || "OFICINA PRODUCTORA";
  const codigoOficina = rows[0]?.codigo?.split('-')[0] || "1.1";

  return (
    <div className="flex flex-col gap-6 bg-slate-50 min-h-full pb-20">
      {/* Action Header */}
      <div className="flex items-center justify-between p-4 bg-white border-b sticky top-0 z-10 print:hidden shadow-sm" style={{ borderColor: HEX_BORDER_LIGHT }}>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg" style={{ backgroundColor: '#fff1f2' }}>
             <FileText className="h-5 w-5" style={{ color: '#e11d48' }} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Reporte Oficial TRD (Formato PDF)</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Previsualización del Documento Archivístico</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold text-slate-600 border" style={{ backgroundColor: HEX_BG_HEADER, borderColor: HEX_BORDER_LIGHT }}>
             <Info className="h-3.5 w-3.5" />
             {selectedIds.size > 0 ? `${selectedIds.size} seleccionados` : `Todos los registros (${rows.length})`}
          </div>
        </div>
      </div>

      {/* DANE FORMAT CONTAINER - THE CAPTURE TARGET */}
      <div 
        id="trd-capture-frame" 
        className="flex justify-center bg-white no-export print:block print:p-0 print:m-0 print:w-full print:flex-none"
        style={{ padding: '40px' }}
      >
        <div 
          id="trd-final-report-area" 
          className={cn(
             "bg-white flex flex-col font-sans h-fit",
             "shadow-2xl w-full max-w-[215mm] p-[10mm] border pb-8",
             "print:shadow-none print:border-0 print:m-0 print:p-[4mm] print:w-full print:max-w-none print:text-[9.5px]"
          )}
          style={{ borderColor: HEX_BORDER_LIGHT }}
        >
           {/* OFICIAL HEADER */}
          <div className="flex flex-col overflow-hidden print:rounded-none" style={{ border: B }}>
            <div className="flex" style={{ borderBottom: B }}>
              <div className="w-[15%] flex flex-col items-center justify-center p-2" style={{ borderRight: B }}>
                {(logoBase64 || currentEntity?.logoUrl) ? (
                   <img src={logoBase64 || currentEntity.logoUrl} alt="Logo Institucional" className="h-10 object-contain p-1" crossOrigin="anonymous" />
                ) : (
                   <span className="text-xl font-black tracking-tighter leading-none" style={{ color: '#e11d48' }}>TRD</span>
                )}
                <span className="text-[5px] font-bold text-slate-900 mt-1 uppercase whitespace-nowrap">Información para todos</span>
              </div>
              <div className="w-[60%] flex items-center justify-center p-4" style={{ borderRight: B }}>
                <h1 className="text-lg font-black uppercase text-center tracking-[0.2em] text-slate-900">Tabla de Retención Documental</h1>
              </div>
              <div className="w-[25%] flex flex-col text-[8px] font-bold">
                <div className="p-1 px-2 flex justify-between uppercase" style={{ borderBottom: B }}><span className="font-black">Código:</span> <span>GID-030-PDT-001-F-001</span></div>
                <div className="p-1 px-2 flex justify-between uppercase" style={{ borderBottom: B }}><span className="font-black">Versión:</span> <span>08</span></div>
                <div className="p-1 px-2 flex justify-between uppercase"><span className="font-black">Fecha:</span> <span>{new Date().toLocaleDateString('es-CO')}</span></div>
              </div>
            </div>

            {/* METADATA BAR */}
            <div className="flex text-[8px] p-2" style={{ borderBottom: B }}>
              <div className="flex flex-col gap-1 w-full uppercase">
                <div className="flex gap-2">
                  <span className="font-black w-32 shrink-0">Entidad Productora:</span>
                  <span className="font-bold text-slate-900">
                    {currentEntity?.nombre || currentEntity?.razonSocial || "OSE SISTEMA GLOBAL"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <span className="font-black w-32 shrink-0">Oficina productora:</span>
                  <span className="font-bold text-slate-900">{oficinaPrincipal}</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-black w-32 shrink-0">Código Oficina:</span>
                  <span className="font-bold text-slate-900">{codigoOficina}</span>
                </div>
              </div>
              <div className="shrink-0 flex items-end font-bold text-[9px] italic p-1">
                Pág 1 de 1
              </div>
            </div>

            {/* TABLE HEADERS */}
            <div className="flex text-[8px] font-black text-center bg-white" style={{ borderBottom: B, borderTop: B }}>
              <div className="w-16 print:w-[10%] shrink-0 flex flex-col" style={{ borderRight: B, borderLeft: B }}>
                <div className="h-10 flex items-center justify-center">CÓDIGO</div>
                <div className="h-8 grid grid-cols-3" style={{ borderTop: B }}>
                  <div className="flex items-center justify-center" style={{ borderRight: B }}>D</div>
                  <div className="flex items-center justify-center" style={{ borderRight: B }}>S</div>
                  <div className="flex items-center justify-center">SUB</div>
                </div>
              </div>
              <div className="flex-1 print:flex-none print:w-[25%] flex items-center justify-center p-1 uppercase" style={{ border: B }}>
                Serie, Subserie y Tipos Documentales
              </div>
              <div className="w-14 print:w-[8%] shrink-0 flex flex-col" style={{ borderRight: B }}>
                <div className="h-10 flex items-center justify-center leading-[8px] p-0.5 uppercase">Soporte o Formato</div>
                <div className="h-8 grid grid-cols-2 uppercase" style={{ borderTop: B }}>
                  <div className="flex items-center justify-center" style={{ borderRight: B }}>SF</div>
                  <div className="flex items-center justify-center">SE</div>
                </div>
              </div>
              <div className="w-16 print:w-[8%] shrink-0 flex flex-col" style={{ borderRight: B }}>
                <div className="h-10 flex items-center justify-center leading-[8px] p-1 uppercase">Tiempo de Retención (Años)</div>
                <div className="h-8 grid grid-cols-2 uppercase font-black" style={{ borderTop: B }}>
                  <div className="flex items-center justify-center" style={{ borderRight: B }}>A/G</div>
                  <div className="flex items-center justify-center">A/C</div>
                </div>
              </div>
              <div className="w-24 print:w-[12%] shrink-0 flex flex-col" style={{ borderRight: B }}>
                <div className="h-10 flex items-center justify-center uppercase">Disposición Final</div>
                <div className="h-8 grid grid-cols-4" style={{ borderTop: B }}>
                  <div className="flex items-center justify-center" style={{ borderRight: B }}>CT</div>
                  <div className="flex items-center justify-center" style={{ borderRight: B }}>M</div>
                  <div className="flex items-center justify-center" style={{ borderRight: B }}>S</div>
                  <div className="flex items-center justify-center">E</div>
                </div>
              </div>
              <div className="flex-1 print:flex-none print:w-[37%] flex items-center justify-center p-1 uppercase" style={{ border: B }}>Procedimiento</div>
            </div>

            {/* DATA ROWS */}
            <div className="flex flex-col" style={{ backgroundColor: '#ffffff' }}>
              {exportRows.map((row, idx) => {
                const parts = (row.codigo || "").split(/[- ._]/);
                const d = parts[0] || "";
                const s = parts[1] || "";
                const sub = parts[2] || "";

                return (
                  <div key={row.id || idx} className="flex text-[9px] min-h-[60px] items-stretch" style={{ borderBottom: B }}>
                    <div className="w-16 print:w-[10%] shrink-0 grid grid-cols-3 text-center font-bold" style={{ borderRight: B, borderLeft: B }}>
                      <div className="flex items-center justify-center" style={{ borderRight: B }}>{d}</div>
                      <div className="flex items-center justify-center" style={{ borderRight: B }}>{s}</div>
                      <div className="flex items-center justify-center">{sub}</div>
                    </div>
                    <div className="flex-1 print:flex-none print:w-[25%] p-3 flex flex-col gap-1" style={{ border: B }}>
                       {sub ? (
                         <>
                           <span className="font-black uppercase text-[10px] text-slate-900 leading-tight">{row.subserie}</span>
                           <div className="flex flex-col gap-0.5 mt-1 pl-2" style={{ borderLeft: B }}>
                             {row.tipoDocumental && row.tipoDocumental.split(',').map((type, tIdx) => (
                               <span key={tIdx} className="text-[8px] text-slate-700 font-bold italic uppercase tracking-tight">
                                  {type.trim()}
                                </span>
                             ))}
                           </div>
                         </>
                       ) : (
                         <span className="font-black uppercase text-[11px] text-slate-900 tracking-wide">{row.serie}</span>
                       )}
                    </div>
                    <div className="w-14 print:w-[8%] shrink-0 grid grid-cols-2 text-center" style={{ borderRight: B }}>
                       <div className="flex items-center justify-center" style={{ borderRight: B }}>{row.soporte === 'fisico' || !row.soporte ? <Check className="h-3 w-3" /> : ''}</div>
                       <div className="flex items-center justify-center">{row.soporte === 'electronico' ? <Check className="h-3 w-3" /> : ''}</div>
                    </div>
                    <div className="w-16 print:w-[8%] shrink-0 grid grid-cols-2 text-center font-black" style={{ borderRight: B }}>
                       <div className="flex items-center justify-center" style={{ borderRight: B }}>{row.retencionGestion}</div>
                       <div className="flex items-center justify-center">{row.retencionCentral}</div>
                    </div>
                    <div className="w-24 print:w-[12%] shrink-0 grid grid-cols-4 text-center font-black" style={{ borderRight: B }}>
                       <div className="flex items-center justify-center" style={{ borderRight: B }}>{(row.disposicion === 'Conservación total' || row.disposicion === 'CT') ? <Check className="h-3 w-3" /> : ''}</div>
                       <div className="flex items-center justify-center text-[7px]" style={{ borderRight: B }}>{(row.reproduccion === 'Digitalización' || row.reproduccion === 'Microfilmación') ? (row.reproduccion.charAt(0)) : ''}</div>
                       <div className="flex items-center justify-center" style={{ borderRight: B }}>{row.disposicion === 'Selección' ? <Check className="h-3 w-3" /> : ''}</div>
                       <div className="flex items-center justify-center">{row.disposicion === 'Eliminación' ? <Check className="h-3 w-3" /> : ''}</div>
                    </div>
                    <div className="flex-1 print:flex-none print:w-[37%] p-3 text-justify leading-[14px] text-slate-900 font-medium whitespace-pre-wrap text-[9px]" style={{ border: B }}>
                       {row.procedimiento || "No especificado."}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SIGNATURES */}
          <div className="mt-16 flex flex-col gap-12 px-6">
             <div className="grid grid-cols-3 gap-20 text-[8px] uppercase font-black text-center">
                <div className="flex flex-col gap-2">
                   <div className="w-full border-t-[1.5px]" style={{ borderColor: HEX_BORDER }} />
                   <span>Firma Responsable Dependencia</span>
                </div>
                <div className="flex flex-col gap-2">
                   <div className="w-full border-t-[1.5px]" style={{ borderColor: HEX_BORDER }} />
                   <span>Firma Secretaría General</span>
                </div>
                <div className="flex flex-col gap-2">
                   <div className="w-full border-t-[1.5px]" style={{ borderColor: HEX_BORDER }} />
                   <span>Comité Institucional de Gestión y Desempeño</span>
                </div>
             </div>
             
             <div className="mt-8 flex flex-col items-center gap-2">
                <div className="w-full border-t-[1px] opacity-20" style={{ borderColor: HEX_BORDER }} />
                <div className="text-[7px] text-slate-500 font-bold uppercase tracking-[0.3em]">
                   Documento Generado Electrónicamente con OSE IA - {new Date().getFullYear()}
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};
