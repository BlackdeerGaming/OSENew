import React, { useState, useEffect } from 'react';
import { Database, Search, Trash2, FileText, Calendar, Info, Clock, ExternalLink, HardDrive, Download } from 'lucide-react';
import API_BASE_URL from '@/config/api';

export default function RAGDocumentView({ currentUser }) {
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/rag-documents`);
      const data = await res.json();
      setDocuments(data);
    } catch (err) {
      console.error('Error fetching RAG docs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Estás seguro de eliminar este documento de la base de conocimientos RAG?')) return;
    
    try {
      await fetch(`${API_BASE_URL}/rag-documents/${id}`, { method: 'DELETE' });
      setDocuments(prev => prev.filter(d => d.id !== id));
    } catch (err) {
      console.error('Error deleting doc:', err);
    }
  };

  const filteredDocs = documents.filter(doc => 
    doc.filename?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.metadata?.source?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto w-full flex flex-col gap-8 p-6 pb-20 overflow-y-auto h-full">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Biblioteca RAG</h1>
        <p className="text-slate-500 max-w-2xl">
          Gestión de documentos fuente para el sistema de recuperación y asistencia con IA. Estos documentos alimentan el contexto de Orianna.
        </p>
      </header>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-primary/10 rounded-xl text-primary">
            <HardDrive className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Total Documentos</span>
            <span className="text-2xl font-black text-slate-900">{documents.length}</span>
          </div>
        </div>
        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-100 rounded-xl text-amber-600">
            <Database className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Índice Vectorial</span>
            <span className="text-xl font-bold text-slate-700 uppercase tracking-tighter">Activo</span>
          </div>
        </div>
        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-100 rounded-xl text-emerald-600">
            <Info className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Estado del Copilot</span>
            <span className="text-xl font-bold text-emerald-600 uppercase tracking-tighter">Sincronizado</span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar documentos en la biblioteca..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <button 
            onClick={fetchDocuments}
            className="p-2.5 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-colors"
            title="Recargar"
          >
            <Clock className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Docs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          Array(6).fill(0).map((_, i) => (
            <div key={i} className="h-48 bg-slate-100 animate-pulse rounded-2xl border border-slate-200" />
          ))
        ) : filteredDocs.length === 0 ? (
          <div className="col-span-full py-20 text-center flex flex-col items-center gap-4 bg-white rounded-3xl border border-dashed border-slate-200">
             <FileText className="h-12 w-12 text-slate-200" />
             <p className="text-slate-400 font-bold">No se encontraron documentos en el sistema RAG</p>
          </div>
        ) : (
          filteredDocs.map((doc) => (
            <div 
              key={doc.id} 
              className="bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all group overflow-hidden"
            >
              <div className="p-5 flex flex-col h-full">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-slate-50 rounded-xl group-hover:bg-primary/5 transition-colors">
                    <FileText className="h-6 w-6 text-slate-500 group-hover:text-primary transition-colors" />
                  </div>
                  <div className="flex gap-2">
                    {currentUser?.role === 'superadmin' && doc.metadata?.file_url && (
                        <a 
                          href={doc.metadata.file_url} 
                          target="_blank" rel="noreferrer download"
                          className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                          title="Descarga Restringida: Documento Original"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                     )}
                    {currentUser?.role === 'superadmin' && (
                      <button 
                        onClick={() => handleDelete(doc.id)}
                        className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                        title="Eliminar del RAG"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
                
                <h3 className="font-bold text-slate-900 mb-1 truncate" title={doc.filename}>
                  {doc.filename || 'Documento sin nombre'}
                </h3>
                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase mb-4">
                  <Calendar className="h-3 w-3" />
                  {new Date(doc.created_at).toLocaleDateString()}
                </div>

                <div className="mt-auto pt-4 border-t border-slate-50 flex flex-col gap-2">
                   <div className="flex justify-between text-[11px]">
                     <span className="text-slate-500">Páginas:</span>
                     <span className="font-bold text-slate-700">{doc.metadata?.pages || 'N/A'}</span>
                   </div>
                   <div className="flex justify-between text-[11px]">
                     <span className="text-slate-500">Tipo:</span>
                     <span className="px-2 py-0.5 bg-slate-100 rounded text-slate-600 font-bold uppercase text-[9px]">
                        {doc.metadata?.type || 'General'}
                     </span>
                   </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
