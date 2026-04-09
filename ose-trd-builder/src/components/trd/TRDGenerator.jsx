import React from "react";
import { Table, Printer, Check, Info, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export default function TRDGenerator({ rows = [], selectedIds = new Set(), onToggleRow, onToggleAll, currentUser }) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-12 text-muted-foreground bg-white rounded-2xl border border-slate-200 border-dashed">
        <div className="p-4 bg-slate-50 rounded-full mb-4">
          <Table className="h-10 w-10 text-slate-300" />
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
      <div className="flex items-center justify-between p-4 bg-white border-b border-slate-200 sticky top-0 z-10 print:hidden shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-rose-50 rounded-lg">
             <FileText className="h-5 w-5 text-rose-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-tight">Reporte Oficial TRD (Formato DANE)</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Previsualización del Documento Archivístico</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-full text-[10px] font-bold text-slate-600 border border-slate-200">
             <Info className="h-3.5 w-3.5" />
             {selectedIds.size > 0 ? `${selectedIds.size} seleccionados` : `Todos los registros (${rows.length})`}
          </div>
        </div>
      </div>

      {/* DANE FORMAT CONTAINER */}
      <div className="flex justify-center p-4 md:p-8">
        <div id="trd-final-report-area" className="bg-white shadow-2xl border border-slate-300 w-full max-w-[215mm] p-[8mm] flex flex-col font-sans print:shadow-none print:border-none print:p-0 print:m-0 h-fit">
          
          {/* OFICIAL HEADER */}
          <div className="border-[0.1px] border-slate-400 flex flex-col overflow-hidden rounded-sm">
            <div className="flex border-b-[0.1px] border-slate-400">
              <div className="w-[15%] flex flex-col items-center justify-center p-2 border-r-[0.1px] border-slate-400">
                <span className="text-xl font-black tracking-tighter text-rose-600 leading-none">DANE</span>
                <span className="text-[6px] font-bold text-slate-900 mt-1 uppercase whitespace-nowrap">Información para todos</span>
              </div>
              <div className="w-[60%] flex items-center justify-center p-4 border-r-[0.1px] border-slate-400">
                <h1 className="text-sm font-black uppercase text-center tracking-widest">Tabla de Retención Documental</h1>
              </div>
              <div className="w-[25%] flex flex-col text-[7px] divide-y-[0.1px] divide-slate-400">
                <div className="p-1 px-2 flex justify-between uppercase"><span className="font-black">Código:</span> <span>GID-030-PDT-001-F-001</span></div>
                <div className="p-1 px-2 flex justify-between uppercase"><span className="font-black">Versión:</span> <span>08</span></div>
                <div className="p-1 px-2 flex justify-between uppercase"><span className="font-black">Fecha:</span> <span>{new Date().toLocaleDateString()}</span></div>
              </div>
            </div>

            {/* METADATA BAR */}
            <div className="flex text-[7px] bg-slate-50/50 p-2 border-b-[0.1px] border-slate-400">
              <div className="flex flex-col gap-1 w-full uppercase">
                <div className="flex gap-2">
                  <span className="font-black w-28 shrink-0">Entidad Productora:</span>
                  <span className="font-bold text-slate-700">DEPARTAMENTO ADMINISTRATIVO NACIONAL DE ESTADÍSTICA - DANE</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-black w-28 shrink-0">Oficina productora:</span>
                  <span className="font-bold text-slate-700">{oficinaPrincipal}</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-black w-28 shrink-0">Código Oficina:</span>
                  <span className="font-bold text-slate-700">{codigoOficina}</span>
                </div>
              </div>
              <div className="shrink-0 flex items-end font-black text-[8px] italic">
                Pág 1 de 1
              </div>
            </div>

            {/* TABLE HEADERS */}
            <div className="flex text-[7px] font-black text-center divide-x-[0.1px] divide-slate-400 border-b-[0.1px] border-slate-400 bg-white">
              <div className="w-16 flex flex-col">
                <div className="h-8 flex items-center justify-center bg-slate-50">CÓDIGO</div>
                <div className="h-6 grid grid-cols-3 border-t-[0.1px] border-slate-400 divide-x-[0.1px] divide-slate-400">
                  <div className="flex items-center justify-center">D</div>
                  <div className="flex items-center justify-center">S</div>
                  <div className="flex items-center justify-center">SUB</div>
                </div>
              </div>
              <div className="flex-1 flex items-center justify-center p-1 bg-slate-50 uppercase min-w-[180px]">
                Serie, Subserie y Tipos Documentales
              </div>
              <div className="w-14 flex flex-col">
                <div className="h-8 flex items-center justify-center bg-slate-50 leading-[8px] p-0.5 uppercase">Soporte o Formato</div>
                <div className="h-6 grid grid-cols-2 border-t-[0.1px] border-slate-400 divide-x-[0.1px] divide-slate-400 uppercase">
                  <div className="flex items-center justify-center">SF</div>
                  <div className="flex items-center justify-center">SE</div>
                </div>
              </div>
              <div className="w-16 flex flex-col">
                <div className="h-8 flex items-center justify-center bg-slate-50 leading-[8px] p-1 uppercase">Tiempo de Retención (Años)</div>
                <div className="h-6 grid grid-cols-2 border-t-[0.1px] border-slate-400 divide-x-[0.1px] divide-slate-400 uppercase font-black">
                  <div className="flex items-center justify-center">A/G</div>
                  <div className="flex items-center justify-center">A/C</div>
                </div>
              </div>
              <div className="w-24 flex flex-col">
                <div className="h-8 flex items-center justify-center bg-slate-50 uppercase">Disposición Final</div>
                <div className="h-6 grid grid-cols-4 border-t-[0.1px] border-slate-400 divide-x-[0.1px] divide-slate-400">
                  <div className="flex items-center justify-center">CT</div>
                  <div className="flex items-center justify-center">M</div>
                  <div className="flex items-center justify-center">S</div>
                  <div className="flex items-center justify-center">E</div>
                </div>
              </div>
              <div className="w-48 flex items-center justify-center p-1 bg-slate-50 uppercase">Procedimiento</div>
            </div>

            {/* DATA ROWS */}
            <div className="flex flex-col divide-y-[0.1px] divide-slate-400">
              {exportRows.map((row, idx) => {
                const parts = (row.codigo || "").split(/[- ._]/);
                const d = parts[0] || "";
                const s = parts[1] || "";
                const sub = parts[2] || "";

                return (
                  <div key={row.id || idx} className="flex text-[7px] min-h-[36px] divide-x-[0.1px] divide-slate-400 items-stretch bg-white">
                    <div className="w-16 grid grid-cols-3 divide-x-[0.1px] divide-slate-400 text-center font-bold">
                      <div className="flex items-center justify-center">{d}</div>
                      <div className="flex items-center justify-center">{s}</div>
                      <div className="flex items-center justify-center">{sub}</div>
                    </div>
                    <div className="flex-1 p-1.5 flex flex-col gap-0.5 min-w-[180px]">
                       {sub ? (
                         <>
                           <span className="font-black uppercase text-[7.5px] text-slate-800">{row.subserie}</span>
                           <div className="flex flex-col gap-0.5 mt-1 border-l border-slate-200 pl-2">
                             {row.tipoDocumental && row.tipoDocumental.split(',').map((type, tIdx) => (
                               <span key={tIdx} className="text-[6.5px] text-slate-500 font-medium italic translate-x-1 uppercase tracking-tight">
                                  {type.trim()}
                               </span>
                             ))}
                           </div>
                         </>
                       ) : (
                         <span className="font-black uppercase text-[8px] text-slate-900 bg-slate-50/50">{row.serie}</span>
                       )}
                    </div>
                    <div className="w-14 grid grid-cols-2 divide-x-[0.1px] divide-slate-400 text-center">
                       <div className="flex items-center justify-center">{row.soporte === 'fisico' || !row.soporte ? <Check className="h-2 w-2" /> : ''}</div>
                       <div className="flex items-center justify-center">{row.soporte === 'electronico' ? <Check className="h-2 w-2" /> : ''}</div>
                    </div>
                    <div className="w-16 grid grid-cols-2 divide-x-[0.1px] divide-slate-400 text-center font-black bg-slate-50/20">
                       <div className="flex items-center justify-center">{row.retencionGestion}</div>
                       <div className="flex items-center justify-center">{row.retencionCentral}</div>
                    </div>
                    <div className="w-24 grid grid-cols-4 divide-x-[0.1px] divide-slate-400 text-center font-black">
                       <div className="flex items-center justify-center">{row.disposicion === 'Conservación total' || row.disposicion === 'CT' ? <Check className="h-2 w-2" /> : ''}</div>
                       <div className="flex items-center justify-center text-[6px]">{(row.reproduccion === 'Digitalización' || row.reproduccion === 'Microfilmación') ? 'D' : ''}</div>
                       <div className="flex items-center justify-center">{row.disposicion === 'Selección' ? <Check className="h-2 w-2" /> : ''}</div>
                       <div className="flex items-center justify-center">{row.disposicion === 'Eliminación' ? <Check className="h-2 w-2" /> : ''}</div>
                    </div>
                    <div className="w-48 p-1.5 text-justify leading-[9px] text-slate-700 font-medium">
                       {row.procedimiento || "No especificado."}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SIGNATURES */}
          <div className="mt-8 flex flex-col gap-8 px-2">
             <div className="grid grid-cols-3 gap-12 text-[7px] uppercase font-black">
                <div className="flex flex-col gap-8 border-t-[0.1px] border-slate-400 pt-1">
                   <span>Firma Responsable Dependencia</span>
                </div>
                <div className="flex flex-col gap-8 border-t-[0.1px] border-slate-400 pt-1">
                   <span>Firma Secretaría General</span>
                </div>
                <div className="flex flex-col gap-8 border-t-[0.1px] border-slate-400 pt-1">
                   <span>Comité Institucional de Gestión y Desempeño</span>
                </div>
             </div>
             
             <div className="flex items-center justify-center mt-2 border-t border-slate-200 pt-4 text-[6px] text-slate-400 font-bold uppercase tracking-widest print:hidden">
                Documento Generado Electrónicamente con OSE IA - {new Date().getFullYear()}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
