import React, { useState, useEffect, useRef } from 'react';
import { UploadCloud, MessageSquare, Send, FileText, Loader2 } from 'lucide-react';
import { useRAG } from '../../contexts/RAGContext';

export default function CopilotView() {
  const {
    messages,
    isUploading,
    uploadProgress,
    uploadStep,
    isTyping,
    fileData,
    handleFileUpload,
    handleSendMessage,
    resetSession
  } = useRAG();

  const [inputValue, setInputValue] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const onFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) handleFileUpload(file);
    e.target.value = ''; // Reset input for same file upload
  };

  const onSendMessage = () => {
    if (!inputValue.trim() || isTyping) return;
    handleSendMessage(inputValue);
    setInputValue('');
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-l-2xl border-l border-y shadow-inner relative">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-20 rounded-tl-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
            <MessageSquare className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              OSE Copilot (RAG) <span className="text-amber-500 text-xs">✨</span>
            </h2>
            <p className="text-xs text-slate-500 font-medium">Tu asistente inteligente</p>
          </div>
        </div>

        {/* Upload Button & Progress */}
        <div className="flex items-center gap-3">
          {fileData && !isUploading && (
            <button 
              onClick={resetSession}
              className="flex items-center gap-2 text-slate-400 hover:text-danger px-3 py-2 rounded-lg text-xs font-medium transition-colors"
              title="Reiniciar Sesión"
            >
              <Loader2 className="w-3.5 h-3.5" /> Nueva Sesión
            </button>
          )}
          
          <div className="relative">
            <label className="cursor-pointer flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-colors">
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin text-primary" /> : <UploadCloud className="w-4 h-4" />}
              {isUploading ? "Procesando..." : "Cargar PDF para RAG"}
              <input type="file" accept=".pdf" className="hidden" onChange={onFileUpload} disabled={isUploading} />
            </label>

            {isUploading && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-white border border-border rounded-xl shadow-xl p-3 z-50 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-primary uppercase tracking-wider">{uploadStep}</span>
                  <span className="text-xs font-bold text-slate-600">{Math.round(uploadProgress)}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-primary to-primary-light transition-all duration-500 ease-out rounded-full"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
        {messages.map((m) => (
          <div key={m.id} className={`flex gap-4 ${m.role === 'user' ? 'justify-end' : ''}`}>
            {m.role !== 'user' && (
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white shrink-0 shadow-sm">
                <MessageSquare className="w-5 h-5" />
              </div>
            )}
            <div className={`max-w-[80%] rounded-2xl p-4 shadow-sm ${
              m.role === 'user' 
                ? 'bg-primary text-white rounded-tr-none' 
                : m.role === 'system'
                  ? 'bg-slate-50 border border-slate-200 text-slate-600 text-sm'
                  : 'bg-white border border-slate-100 text-slate-700 rounded-tl-none'
            }`}>
              <div className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</div>
              
              {m.sources && m.sources.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100 flex flex-wrap gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block w-full mb-1">Fuentes:</span>
                  {m.sources.map(s => (
                    <span key={s} className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded flex items-center gap-1">
                      <FileText className="w-3 h-3" /> Pág. {s}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {m.role === 'user' && (
              <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center text-slate-500 shrink-0 shadow-sm">
                <Loader2 className="w-5 h-5" />
              </div>
            )}
          </div>
        ))}

        {isTyping && (
          <div className="flex gap-4">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white shrink-0 shadow-sm">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-2xl rounded-tl-none p-4 shadow-sm">
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" />
                <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:0.2s]" />
                <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-6 bg-white border-t border-slate-100 rounded-bl-2xl">
        {fileData && (
          <div className="mb-3 px-3 py-1.5 bg-success/10 text-success text-[10px] font-bold rounded-lg inline-flex items-center gap-1.5 border border-success/20">
            <div className="w-1.5 h-1.5 bg-success rounded-full animate-pulse" />
            ÍNDICE ACTIVO: {fileData.name.toUpperCase()} ({fileData.chunks} CHUNKS)
          </div>
        )}
        
        <div className="relative group">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSendMessage()}
            placeholder={fileData ? "Haz una consulta al documento..." : "Sube un PDF primero para hacer preguntas..."}
            disabled={!fileData || isTyping}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-5 py-3.5 pr-14 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all disabled:opacity-60"
          />
          <button
            onClick={onSendMessage}
            disabled={!fileData || !inputValue.trim() || isTyping}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-primary text-white rounded-lg flex items-center justify-center hover:bg-primary-dark transition-all disabled:opacity-50 disabled:grayscale transform active:scale-95"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
        <p className="text-[10px] text-center text-slate-400 mt-3 font-medium">
          Copilot procesa la información en chunks mediante RAG local. Exige respuestas basadas en datos reales.
        </p>
      </div>
    </div>
  );
}
