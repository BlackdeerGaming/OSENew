import React, { useState, useRef, useEffect } from 'react';
import { BrainCircuit, Send, Sparkles, UploadCloud, FileText, Loader2, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import API_BASE_URL from '../../config/api';

export default function CopilotView({ currentUser }) {
  const isSuperAdmin = currentUser?.perfil === 'superadmin';
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'assistant',
      content: '¡Hola! Soy OSE Copilot. Sube un documento PDF para que pueda procesarlo con mi motor RAG (VectorDB + Embeddings) y responder tus consultas basándome estrictamente en esa información.'
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [fileData, setFileData] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert("Por favor sube solo archivos PDF.");
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      // Intentar conectarse al backend Python RAG
      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || `HTTP error ${response.status}`);
      }

      const data = await response.json();
      setFileData({ name: file.name, chunks: data.chunks_created });
      
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'system',
        content: `✅ Documento "${file.name}" indexado con éxito → ${data.chunks_created} chunks (${data.text_pages ?? '?'} páginas de texto + ${data.images_processed ?? 0} imágenes procesadas con visión IA).`
      }]);

    } catch (error) {
      console.error("Upload error:", error);
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'system',
        content: `❌ Mensaje del servidor: ${error.message}`
      }]);
    } finally {
      setIsUploading(false);
      e.target.value = ''; // reset input
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isTyping) return;

    const userQuery = inputValue;
    const newMessageId = Date.now();
    
    setMessages(prev => [...prev, {
      id: newMessageId,
      role: 'user',
      content: userQuery
    }]);
    
    setInputValue('');
    setIsTyping(true);

    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ query: userQuery })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || `HTTP error ${response.status}`);
      }

      const data = await response.json();
      
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'assistant',
        content: data.answer,
        sources: data.sources
      }]);

    } catch (error) {
       console.error("Chat error:", error);
       setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'assistant',
        content: `❌ No se pudo procesar: ${error.message}`
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex-1 p-2 sm:p-4 lg:p-8 overflow-hidden w-full h-full flex flex-col items-center">
      <div className="w-full max-w-4xl h-full flex flex-col bg-card border border-border shadow-md rounded-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-border bg-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 sm:gap-4">
              <div className="h-10 w-10 sm:h-12 sm:w-12 bg-primary rounded-xl flex items-center justify-center shadow-inner shrink-0">
                <BrainCircuit className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
                  OSE Copilot <Sparkles className="h-4 w-4 text-warning" />
                </h2>
                <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                  <span className="hidden xs:inline">Asistente RAG</span>
                  {fileData && (
                    <span className="flex items-center gap-1 bg-success/10 text-success px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-semibold">
                       <FileText className="w-3 h-3"/> Activo
                    </span>
                  )}
                </div>
              </div>
          </div>
          
          {/* Upload Button */}
          <div className="w-full sm:w-auto">
            {isSuperAdmin && (
              <label className="cursor-pointer flex items-center justify-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold shadow-sm transition-colors w-full sm:w-auto">
                {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                {isUploading ? "Procesando..." : "Cargar PDF"}
                <input type="file" accept=".pdf" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
              </label>
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 p-6 overflow-y-auto bg-slate-50/50 flex flex-col gap-6">
          {messages.map((msg) => {
             if (msg.role === 'system') {
                return (
                  <div key={msg.id} className="flex justify-center my-2">
                     <span className="bg-slate-200/50 text-slate-500 px-4 py-1.5 rounded-full text-xs font-medium text-center max-w-lg">
                        {msg.content}
                     </span>
                  </div>
                );
             }

             const isUser = msg.role === 'user';
             return (
                <div key={msg.id} className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
                  {/* Avatar */}
                  <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm", isUser ? "bg-slate-200" : "bg-primary")}>
                    {isUser ? <User className="w-5 h-5 text-slate-600" /> : <BrainCircuit className="w-6 h-6 text-white" />}
                  </div>

                  {/* Message Bubble */}
                  <div className={cn("flex flex-col gap-2 max-w-[85%]", isUser ? "items-end" : "items-start")}>
                      <div className={cn(
                          "px-5 py-3.5 rounded-2xl shadow-sm text-[15px] leading-relaxed whitespace-pre-wrap",
                          isUser 
                            ? "bg-slate-800 text-white rounded-tr-sm" 
                            : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm"
                        )}
                      >
                        {msg.content}
                      </div>

                      {/* Sources Badge */}
                      {msg.sources && msg.sources.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-xs text-slate-400 font-medium">Fuentes recuperadas:</span>
                          {msg.sources.map((src, i) => (
                             <span key={i} className="flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-md text-[11px] font-semibold">
                               <FileText className="w-3 h-3" /> Pág. {src}
                             </span>
                          ))}
                        </div>
                      )}
                  </div>
                </div>
             )
          })}
          
          {isTyping && (
             <div className="flex gap-3">
               <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center shrink-0 shadow-sm">
                 <BrainCircuit className="w-6 h-6 text-white" />
               </div>
               <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm p-4 shadow-sm flex gap-1 items-center">
                  <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '300ms' }} />
               </div>
             </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-3 sm:p-4 bg-white border-t border-border mt-auto">
          <div className="relative max-w-4xl mx-auto flex items-center shadow-sm rounded-2xl bg-white border border-slate-200 focus-within:border-primary/40 transition-all p-1">
            <textarea 
              rows={1}
              placeholder="Pregunta algo..."
              className="w-full text-sm sm:text-base border-none py-2.5 sm:py-3 pl-3 sm:pl-4 pr-12 focus:outline-none bg-transparent resize-none max-h-32"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isTyping}
            />
            <button 
               onClick={handleSendMessage}
               disabled={!inputValue.trim() || isTyping}
               className={cn(
                 "absolute right-2 p-2 rounded-xl transition-all shadow-sm",
                 inputValue.trim() && !isTyping ? "bg-primary text-white hover:bg-primary/90 active:scale-95" : "bg-slate-100 text-slate-400"
               )}
            >
              <Send className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
