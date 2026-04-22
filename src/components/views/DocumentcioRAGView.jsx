import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import {
  MessageSquare, Send, FileText, Loader2, Database, Search,
  Trash2, Download, UploadCloud, BrainCircuit, X, 
  CheckCircle2, AlertCircle, Eye, BookOpen, Clock, 
  Filter, LayoutGrid, List, Sparkles, ShieldCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import API_BASE_URL from '@/config/api';
import { DocumentCard, ChatBubble } from './RAGComponents';
import ViewHeader from '../ui/ViewHeader';

// ─── HELPER: CHAT PANEL ────────────────────────────────────────────────────────

function ChatPanel({ currentEntityId, currentUser }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      content: '¡Hola! Soy Documencio, tu Asistente de Biblioteca. He sido entrenado con tus documentos institucionales para resolver dudas sobre tiempos de retención, disposición final y normatividad vigente. ¿Qué deseas consultar?'
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  useEffect(() => {
    const fetchHistory = async () => {
      if (!currentUser?.token) return;
      try {
        const res = await fetch(`${API_BASE_URL}/chat-history/documencio`, {
          headers: { "Authorization": `Bearer ${currentUser.token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.messages && data.messages.length > 0) setMessages(data.messages);
        }
      } catch (e) { console.error("Error cargando historial:", e); }
    };
    fetchHistory();
  }, [currentUser]);

  useEffect(() => {
    const saveHistory = async () => {
      if (!currentUser?.token || messages.length <= 1) return;
      try {
        await fetch(`${API_BASE_URL}/chat-history/documencio`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${currentUser.token}`
          },
          body: JSON.stringify({ messages })
        });
      } catch (e) { console.error("Error guardando historial:", e); }
    };
    const timer = setTimeout(saveHistory, 2000);
    return () => clearTimeout(timer);
  }, [messages, currentUser]);

  const handleSend = async () => {
    const query = inputValue.trim();
    if (!query || isTyping) return;

    const userMsgId = `${Date.now()}`;
    setMessages(prev => [...prev, { id: userMsgId, role: 'user', content: query }]);
    setInputValue('');
    setIsTyping(true);

    try {
      const res = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser?.token}`
        },
        body: JSON.stringify({ query, entidadId: currentEntityId })
      });
      
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `Error del servidor (${res.status})`);
      }
      
      const data = await res.json();
      setMessages(prev => [...prev, {
        id: `${Date.now()}-ai`,
        role: 'assistant',
        content: data.answer,
        sources: data.sources
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        id: 'err',
        role: 'assistant',
        content: `Lo siento, encontré un problema técnico: ${err.message}. Por favor, intenta de nuevo.`
      }]);
    } finally { setIsTyping(false); }
  };

  return (
    <div className="flex flex-col h-full bg-white relative overflow-hidden">
      {/* Header */}
      <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between shrink-0 bg-white/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-[1.25rem] flex items-center justify-center text-primary border border-primary/20 shadow-inner">
            <BrainCircuit className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-900 uppercase italic tracking-tighter leading-none">Documencio AI</h2>
            <div className="flex items-center gap-1.5 mt-1">
               <span className="w-1.5 h-1.5 rounded-full bg-primary" />
               <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Motor RAG Activo</p>
            </div>
          </div>
        </div>
        <button 
          onClick={() => setMessages([{ id: 1, role: 'assistant', content: '¡Hola! ¿En qué te puedo ayudar hoy?' }])}
          className="p-2 hover:bg-slate-50 rounded-xl text-slate-400 transition-colors"
        >
          <Clock className="w-4 h-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar bg-slate-50/20">
        {messages.map((m) => <ChatBubble key={m.id} message={m} />)}
        {isTyping && <ChatBubble message={{ role: 'assistant', content: '' }} isTyping />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-8 bg-white border-t border-slate-50 shrink-0">
        <div className="relative">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Pregunta a tu biblioteca..."
            disabled={isTyping}
            className="w-full bg-slate-50/50 border border-slate-100 rounded-[1.5rem] px-8 py-5 pr-20 text-sm font-medium focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary/20 focus:bg-white transition-all disabled:opacity-60"
          />
          <button
            onClick={() => handleSend()}
            disabled={!inputValue.trim() || isTyping}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center hover:bg-primary transition-all disabled:opacity-40 shadow-xl"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── HELPER: UPLOAD MODAL ──────────────────────────────────────────────────────

function UploadModal({ onClose, onUploaded, currentUser }) {
  const [file, setFile] = useState(null);
  const [status, setStatus] = useState('idle');
  const [step, setStep] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const onDrop = useCallback((acceptedFiles) => {
    setFile(acceptedFiles[0]);
    setStatus('idle');
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'application/pdf': ['.pdf'] }, maxFiles: 1
  });

  const handleUpload = async () => {
    if (!file) return;
    setStatus('uploading');
    setStep('Indexando documento...');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('entidad_id', currentUser?.entidadId || '');

      const res = await fetch(`${API_BASE_URL}/upload`, {
        method: 'POST',
        headers: { "Authorization": `Bearer ${currentUser?.token}` },
        body: formData
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.detail || 'Error en carga');
      }

      setStatus('success');
      setTimeout(() => { onUploaded(); onClose(); }, 1500);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
             <div className="p-3 bg-primary/10 rounded-2xl text-primary"><UploadCloud className="w-6 h-6" /></div>
             <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">Cargar Inteligencia</h3>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:bg-slate-50 rounded-xl"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-8 space-y-6">
          <div {...getRootProps()} className={cn(
            "border-2 border-dashed rounded-[2rem] p-12 text-center transition-all cursor-pointer",
            isDragActive ? "border-primary bg-primary/5" : "border-slate-100 hover:border-primary/20 bg-slate-50/50"
          )}>
            <input {...getInputProps()} />
            <div className="w-20 h-20 bg-white rounded-3xl shadow-xl flex items-center justify-center mx-auto mb-6 text-slate-300">
               <FileText className="w-10 h-10" />
            </div>
            {file ? (
              <p className="font-black text-slate-900 uppercase italic">{file.name}</p>
            ) : (
              <div className="space-y-1">
                <p className="font-black text-slate-900 uppercase italic tracking-tight">Arrastra tu PDF aquí</p>
                <p className="text-xs text-slate-400 font-medium text-slate-400">Tamaño máximo: 20MB</p>
              </div>
            )}
          </div>

          {status === 'uploading' && (
            <div className="flex flex-col items-center gap-3 py-4 animate-pulse">
               <Loader2 className="w-6 h-6 text-primary animate-spin" />
               <p className="text-[10px] font-black text-primary uppercase tracking-widest">{step}</p>
            </div>
          )}

          {status === 'error' && (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3 text-rose-600">
               <AlertCircle className="w-5 h-5" />
               <p className="text-xs font-bold">{errorMsg}</p>
            </div>
          )}
        </div>

        <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end gap-4">
           <button onClick={onClose} className="px-6 py-3 text-sm font-bold text-slate-400">Cancelar</button>
           <button 
             onClick={handleUpload}
             disabled={!file || status === 'uploading'}
             className="px-10 py-3.5 bg-slate-900 text-white font-black uppercase italic tracking-widest text-[11px] rounded-2xl hover:bg-primary transition-all disabled:opacity-40 shadow-xl"
           >
             Comenzar Indexación
           </button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN VIEW ─────────────────────────────────────────────────────────────────

export default function DocumentcioRAGView({ currentUser }) {
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [viewDoc, setViewDoc] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  
  const isSuperAdmin = currentUser?.role === 'superadmin';
  const iaAvailable = currentUser?.iaDisponible ?? true;

  const fetchDocs = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/rag-documents?entidad_id=${currentUser?.entidadId}`, {
        headers: { "Authorization": `Bearer ${currentUser?.token}` }
      });
      const data = await res.json();
      setDocuments(Array.isArray(data) ? data : []);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  };

  useEffect(() => { fetchDocs(); }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar este documento?')) return;
    try {
      await fetch(`${API_BASE_URL}/rag-documents/${id}`, { 
        method: 'DELETE',
        headers: { "Authorization": `Bearer ${currentUser?.token}` }
      });
      setDocuments(prev => prev.filter(d => d.id !== id));
    } catch (e) { console.error(e); }
  };

  const filteredDocs = documents.filter(doc => {
    const term = searchQuery.toLowerCase();
    const name = (doc.metadata?.label || doc.filename || '').toLowerCase();
    return name.includes(term);
  });

  return (
    <div className="flex flex-col lg:flex-row w-full h-full bg-[#fbfcfd] overflow-hidden">
      
      {/* Sidebar: Chat */}
      <aside className="w-full lg:w-[50%] border-r border-slate-100 flex flex-col shrink-0 bg-white">
         <ChatPanel currentUser={currentUser} currentEntityId={currentUser?.entidadId} />
      </aside>

      {/* Main Content: Library */}
      <main className="flex-1 flex flex-col overflow-hidden">
        
        {/* Header */}
        <ViewHeader
          icon={Database}
          title="Biblioteca RAG"
          subtitle="Repositorio de documentos institucionales indexados con inteligencia artificial"
          actions={
            <>
              {/* View Toggle */}
              <div className="flex bg-secondary/50 p-1 rounded-lg border border-border mr-2">
                <button 
                  onClick={() => setViewMode('grid')}
                  className={cn(
                    "p-1.5 rounded-md transition-all",
                    viewMode === 'grid' ? "bg-white shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                  title="Vista Cuadrícula"
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setViewMode('list')}
                  className={cn(
                    "p-1.5 rounded-md transition-all",
                    viewMode === 'list' ? "bg-white shadow-sm text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                  title="Vista Lista"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Buscar en el repositorio..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-52 pl-9 pr-3 py-1.5 bg-background border border-input rounded-md text-[12.5px] focus:outline-none focus:ring-1 focus:ring-ring transition-all"
                />
              </div>
              {isSuperAdmin && (
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-primary text-primary-foreground text-[12.5px] font-semibold rounded-md hover:bg-primary/90 transition-all active:scale-95"
                >
                  <UploadCloud className="w-3.5 h-3.5" /> Cargar PDF
                </button>
              )}
            </>
          }
        />

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-5 pb-8">
          
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4">
               <Loader2 className="w-10 h-10 text-primary animate-spin" />
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sincronizando Archivos...</p>
            </div>
          ) : filteredDocs.length > 0 ? (
            viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                 {filteredDocs.map(doc => (
                   <DocumentCard 
                     key={doc.id} 
                     doc={doc} 
                     isSuperAdmin={isSuperAdmin}
                     onDelete={handleDelete}
                     onView={setViewDoc}
                     onEdit={(d) => console.log('Edit', d)}
                   />
                 ))}
              </div>
            ) : (
              <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-700">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50/50 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nombre</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tipo</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Fecha</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estado</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filteredDocs.map(doc => (
                      <tr key={doc.id} className="hover:bg-slate-50/30 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-primary/5 text-primary flex items-center justify-center shrink-0">
                              <FileText className="w-4 h-4" />
                            </div>
                            <span className="font-bold text-slate-700 truncate max-w-[200px]">
                              {doc.metadata?.label || doc.filename}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-1 rounded">
                            {doc.filename?.split('.').pop() || 'PDF'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-500 font-medium">
                          {new Date(doc.created_at || Date.now()).toLocaleDateString('es-CO')}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Indexado</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => setViewDoc(doc)}
                              className="p-1.5 hover:bg-primary/10 text-primary rounded-md transition-all"
                              title="Ver"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {isSuperAdmin && (
                              <button 
                                onClick={() => handleDelete(doc.id)}
                                className="p-1.5 hover:bg-rose-50 text-rose-500 rounded-md transition-all"
                                title="Eliminar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-center">
               <div className="w-32 h-32 bg-slate-50 rounded-[3rem] flex items-center justify-center text-slate-200 mb-8 border border-slate-100">
                  <Database className="w-16 h-16" />
               </div>
               <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tight">Repositorio Vacío</h3>
               <p className="text-slate-400 text-sm font-medium mt-2 max-w-sm">
                 {searchQuery ? 'No encontramos coincidencias para tu búsqueda.' : 'No se han cargado documentos en la biblioteca RAG todavía.'}
               </p>
            </div>
          )}
        </div>

        {/* Floating status */}
        <div className="px-10 py-4 bg-white/80 backdrop-blur-md border-t border-slate-50 flex items-center justify-between shrink-0">
           <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                 <div className="h-2 w-2 rounded-full bg-emerald-500" />
                 <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{documents.length} Documentos Totales</span>
              </div>
              <div className="flex items-center gap-2">
                 <div className="h-2 w-2 rounded-full bg-primary" />
                 <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">IA Operativa</span>
              </div>
           </div>
           <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.3em]">Neural Documencio Engine v3.0</p>
        </div>
      </main>

      {/* Modals */}
      {showUploadModal && <UploadModal onClose={() => setShowUploadModal(false)} onUploaded={fetchDocs} currentUser={currentUser} />}
      
      {viewDoc && (
        <div className="fixed inset-0 z-[110] flex items-center justify-end">
           <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={() => setViewDoc(null)} />
           <div className="relative w-full max-w-4xl h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-500">
              <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <BookOpen className="w-6 h-6 text-primary" />
                    <h3 className="font-black uppercase italic tracking-tighter truncate max-w-lg">{viewDoc.metadata?.label || viewDoc.filename}</h3>
                 </div>
                 <button onClick={() => setViewDoc(null)} className="p-2 hover:bg-white/10 rounded-xl transition-colors"><X className="w-5 h-5" /></button>
              </div>
              <div className="flex-1 bg-slate-100">
                 {viewDoc.metadata?.file_url ? (
                   <iframe src={`${viewDoc.metadata.file_url}#toolbar=0`} className="w-full h-full border-none" />
                 ) : (
                   <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-4">
                      <AlertCircle className="w-12 h-12" />
                      <p className="font-bold uppercase tracking-widest text-[10px]">Archivo original no disponible en Storage</p>
                   </div>
                 )}
              </div>
           </div>
        </div>
      )}

      {/* IA Restricted Overlay */}
      {!iaAvailable && (
        <div className="absolute inset-0 z-[120] flex items-center justify-center p-6 bg-slate-950/60 backdrop-blur-md">
           <div className="bg-white p-12 rounded-[3rem] shadow-2xl text-center max-w-md animate-in zoom-in-95">
              <div className="w-20 h-20 bg-primary/10 text-primary rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-inner border border-primary/20">
                 <BrainCircuit className="w-10 h-10" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 uppercase italic tracking-tighter mb-4">Módulo Restringido</h2>
              <p className="text-slate-500 font-medium leading-relaxed mb-10">Tu perfil actual no cuenta con privilegios de consulta en la Biblioteca de Inteligencia Artificial.</p>
              <button className="w-full py-4 bg-slate-900 text-white font-black uppercase tracking-[0.2em] text-[10px] rounded-2xl hover:bg-primary transition-all shadow-xl shadow-primary/20">Contactar Administrador</button>
           </div>
        </div>
      )}
    </div>
  );
}
