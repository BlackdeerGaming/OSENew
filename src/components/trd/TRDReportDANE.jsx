import React from "react";
import { Table, Printer, FileText, ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Componente TRDReportDANE
 * Implementa el formato estándar de Tablas de Retención Documental del DANE / AGN Colombia.
 */
export default function TRDReportDANE({ rows = [], currentUser }) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-12 text-muted-foreground bg-white rounded-xl border border-slate-200">
        <Table className="h-12 w-12 opacity-20 mb-4 text-slate-400" />
        <p className="font-bold text-slate-800">No hay datos para el reporte</p>
        <p className="text-sm mt-1 max-w-md text-center">Debes aprobar valoraciones TRD para que aparezcan aquí.</p>
      </div>
    );
  }

  // Agrupar por oficina productora si es necesario o filtrar
  const oficinaPrincipal = rows[0]?.dependencia || "OFICINA POR DEFINIR";
  const codigoOficina = rows[0]?.codigo?.split('-')[0] || "1.1";

  return (
    <div className="flex flex-col gap-6 p-2 bg-slate-100 min-h-full overflow-y-auto">
      {/* Botones de Acción */}
      <div className="flex justify-end gap-3 print:hidden px-4 pt-2">
        <button 
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold shadow-lg hover:bg-slate-800 transition-all hover:scale-105"
        >
          <Printer className="h-4 w-4" />
          Imprimir Reporte Oficial
        </button>
      </div>

      {/* Formato DANE */}
      <div className="bg-white mx-auto shadow-2xl border-2 border-slate-300 w-[210mm] min-h-[297mm] p-[10mm] flex flex-col font-sans print:shadow-none print:border-none print:w-full print:p-0">
        
        {/* ENCABEZADO DANE */}
        <div className="border border-slate-900 flex flex-col mb-4">
          <div className="flex border-b border-slate-900 h-16">
            <div className="w-1/4 flex items-center justify-center p-2 border-r border-slate-900">
               <div className="text-center">
                 <h1 className="text-xl font-black text-rose-600 leading-none">DANE</h1>
                 <p className="text-[7px] font-bold uppercase">Información para todos</p>
               </div>
            </div>
            <div className="w-2/4 flex items-center justify-center p-2 border-r border-slate-900 bg-slate-50">
               <h2 className="text-sm font-bold uppercase tracking-widest text-center">Tabla de Retención Documental</h2>
            </div>
            <div className="w-1/4 text-[8px] flex flex-col">
               <div className="p-1 border-bottom border-slate-900 h-1/3 flex items-center justify-between px-2">
                  <span className="font-bold">CÓDIGO:</span>
                  <span>GID-030-PDT-001-f-001</span>
               </div>
               <div className="p-1 border-y border-slate-900 h-1/3 flex items-center justify-between px-2 bg-slate-50">
                  <span className="font-bold">VERSIÓN:</span>
                  <span>08</span>
               </div>
               <div className="p-1 h-1/3 flex items-center justify-between px-2">
                  <span className="font-bold">FECHA:</span>
                  <span>{new Date().toLocaleDateString()}</span>
               </div>
            </div>
          </div>
          <div className="flex text-[8px] bg-slate-50 p-2 border-b border-slate-900">
             <div className="flex flex-col gap-1 w-full">
                <div className="flex gap-4">
                  <span className="font-bold w-32 uppercase">Entidad Productora:</span>
                  <span className="uppercase text-slate-700 font-medium">DEPARTAMENTO ADMINISTRATIVO NACIONAL DE ESTADÍSTICA - DANE</span>
                </div>
                <div className="flex gap-4">
                  <span className="font-bold w-32 uppercase">Oficina productora:</span>
                  <span className="uppercase text-slate-700 font-medium">{oficinaPrincipal}</span>
                </div>
                <div className="flex gap-4">
                  <span className="font-bold w-32 uppercase">Código Oficina:</span>
                  <span className="uppercase text-slate-700 font-medium">{codigoOficina}</span>
                </div>
             </div>
             <div className="flex items-end justify-end w-32 pb-1">
                <span className="font-bold">Hoja 1 de 1</span>
             </div>
          </div>

          {/* TABLA DE DATOS */}
          <div className="flex flex-col">
            {/* Headers de Columnas */}
            <div className="flex text-[8px] font-bold text-center border-b border-slate-900 bg-slate-100">
               <div className="w-24 border-r border-slate-900 flex flex-col">
                  <span className="p-2 h-1/2 flex items-center justify-center">CÓDIGO</span>
                  <div className="grid grid-cols-3 border-t border-slate-900 h-1/2">
                    <span className="border-r border-slate-900 flex items-center justify-center">D</span>
                    <span className="border-r border-slate-900 flex items-center justify-center">S</span>
                    <span className="flex items-center justify-center">SUB</span>
                  </div>
               </div>
               <div className="flex-1 border-r border-slate-900 flex items-center justify-center p-2 uppercase min-w-[200px]">
                  Serie, Subserie y Tipos Documentales
               </div>
               <div className="w-24 border-r border-slate-900 flex flex-col">
                  <span className="p-1 h-1/2 flex items-center justify-center">SOPORTE O FORMATO</span>
                  <div className="grid grid-cols-2 border-t border-slate-900 h-1/2">
                    <span className="border-r border-slate-900 flex items-center justify-center">SF</span>
                    <span className="flex items-center justify-center">SE</span>
                  </div>
               </div>
               <div className="w-24 border-r border-slate-900 flex flex-col">
                  <span className="p-1 h-3/4 flex items-center justify-center leading-tight">TIEMPO DE RETENCIÓN (Años)</span>
                  <div className="grid grid-cols-2 border-t border-slate-900 h-1/4">
                    <span className="border-r border-slate-900 flex items-center justify-center">A/G</span>
                    <span className="flex items-center justify-center">A/C</span>
                  </div>
               </div>
               <div className="w-32 border-r border-slate-900 flex flex-col">
                  <span className="p-2 h-1/2 flex items-center justify-center">DISPOSICIÓN FINAL</span>
                  <div className="grid grid-cols-4 border-t border-slate-900 h-1/2">
                    <span className="border-r border-slate-900 flex items-center justify-center">CT</span>
                    <span className="border-r border-slate-900 flex items-center justify-center">M</span>
                    <span className="border-r border-slate-900 flex items-center justify-center">S</span>
                    <span className="flex items-center justify-center">E</span>
                  </div>
               </div>
               <div className="w-48 flex items-center justify-center p-2 border-slate-900">
                  PROCEDIMIENTO
               </div>
            </div>

            {/* FILAS DE DATOS */}
            <div className="flex flex-col divide-y divide-slate-800">
              {rows.map((row, index) => {
                // Parsear código
                const parts = (row.codigo || "").split(/[-\s]/);
                const d = parts[0] || "";
                const s = parts[1] || "";
                const sub = parts[2] || "";

                return (
                  <div key={index} className="flex text-[7.5px] min-h-[40px] items-stretch">
                    <div className="w-24 border-r border-slate-900 grid grid-cols-3">
                      <span className="border-r border-slate-900 flex items-center justify-center font-bold px-1">{d}</span>
                      <span className="border-r border-slate-900 flex items-center justify-center font-bold px-1">{s}</span>
                      <span className="flex items-center justify-center font-bold px-1">{sub}</span>
                    </div>
                    <div className="flex-1 border-r border-slate-900 p-2 flex flex-col gap-1 min-w-[200px]">
                      {sub ? (
                        <>
                          <span className="font-bold uppercase">{row.subserie}</span>
                          <div className="pl-3 border-l-2 border-slate-200 mt-1 flex flex-col gap-0.5 italic text-slate-500">
                             {/* Tipos documentales simulados o reales */}
                             {row.tipoDocumental && row.tipoDocumental.split(',').map((type, tIdx) => (
                               <span key={tIdx}>• {type.trim()}</span>
                             ))}
                          </div>
                        </>
                      ) : (
                        <span className="font-black uppercase text-[8px] bg-slate-100 p-1">{row.serie}</span>
                      )}
                    </div>
                    <div className="w-24 border-r border-slate-900 grid grid-cols-2">
                      <span className="border-r border-slate-900 flex items-center justify-center text-slate-400">
                        {row.soporte === 'fisico' || row.soporte === 'ambos' ? <Check className="h-2 w-2 text-slate-900" /> : ''}
                      </span>
                      <span className="flex items-center justify-center text-slate-400">
                        {row.soporte === 'electronico' || row.soporte === 'ambos' ? <Check className="h-2 w-2 text-slate-900" /> : ''}
                      </span>
                    </div>
                    <div className="w-24 border-r border-slate-900 grid grid-cols-2">
                      <span className="border-r border-slate-900 flex items-center justify-center font-bold">{row.retencionGestion}</span>
                      <span className="flex items-center justify-center font-bold">{row.retencionCentral}</span>
                    </div>
                    <div className="w-32 border-r border-slate-900 grid grid-cols-4">
                      <span className="border-r border-slate-900 flex items-center justify-center">
                        {row.disposicion === 'CT' ? 'CT' : ''}
                      </span>
                      <span className="border-r border-slate-900 flex items-center justify-center uppercase">
                        {row.disposicion === 'M' || row.disposicion === 'D' ? 'D' : ''}
                      </span>
                      <span className="border-r border-slate-900 flex items-center justify-center uppercase">
                        {row.disposicion === 'S' ? 'S' : ''}
                      </span>
                      <span className="flex items-center justify-center uppercase">
                        {row.disposicion === 'E' ? 'E' : ''}
                      </span>
                    </div>
                    <div className="w-48 p-2 text-justify leading-snug break-words">
                      {row.procedimiento || "No especificado."}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* PIE DE PÁGINA / FIRMAS */}
        <div className="mt-auto pt-8 flex flex-col gap-6 text-[8px]">
          <div className="grid grid-cols-3 gap-8 px-4">
             <div className="border-t border-slate-900 pt-1 flex flex-col italic">
                <span className="font-bold">Responsable Oficina Productora:</span>
                <span className="mt-4 text-center">Firma y Sello</span>
             </div>
             <div className="border-t border-slate-900 pt-1 flex flex-col italic">
                <span className="font-bold">Secretaría General:</span>
                <span className="mt-4 text-center">Firma y Sello</span>
             </div>
             <div className="border-t border-slate-900 pt-1 flex flex-col italic">
                <span className="font-bold">Presidente Comité Archivo:</span>
                <span className="mt-4 text-center">Firma y Sello</span>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
