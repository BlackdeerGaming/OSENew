import React, { useState, useRef, useEffect } from 'react';
import { BrainCircuit, Send, Sparkles, UploadCloud, FileText, Loader2, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import API_BASE_URL from '../../config/api';

export default function CopilotView() {
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

    // Límite de Vercel Serverless (4.5 MB)
    const MAX_SIZE = 4.5 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'system',
        content: `⚠️ El archivo "${file.name}" es demasiado grande (${(file.size / (1024 * 1024)).toFixed(2)} MB). El límite máximo para el motor RAG en la nube es de 4.5 MB. Por favor sube un archivo más pequeño.`
      }]);
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
    <div className="flex-1 p-6 lg:p-8 overflow-hidden w-full h-full flex flex-col items-center">
      <div className="w-full max-w-4xl h-full flex flex-col bg-card border border-border shadow-md rounded-2xl overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-border bg-slate-50 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-primary rounded-xl flex items-center justify-center shadow-inner">
                <BrainCircuit className="h-7 w-7 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
                  OSE Copilot (RAG) <Sparkles className="h-4 w-4 text-warning" />
                </h2>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Tu asistente inteligente</span>
                  {fileData && (
                    <span className="flex items-center gap-1 bg-success/10 text-success px-2 py-0.5 rounded-full text-xs font-semibold">
                       <FileText className="w-3 h-3"/> Base Indexada activa
                    </span>
                  )}
                </div>
              </div>
          </div>
          
          {/* Upload Button */}
          <div>
            <label className="cursor-pointer flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-lg text-sm font-semibold shadow-sm transition-colors">
               {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
               {isUploading ? "Procesando VectorDB..." : "Cargar PDF para RAG"}
               <input type="file" accept=".pdf" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
            </label>
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
        <div className="p-4 bg-white border-t border-border">
          <div className="relative max-w-4xl mx-auto flex items-center shadow-[0_0_15px_rgba(0,0,0,0.05)] rounded-2xl bg-white border border-slate-200 focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/20 transition-all p-1.5 focus-within:shadow-md">
            <textarea 
              rows={1}
              placeholder={fileData ? "Haz una pregunta sobre el documento..." : "Sube un PDF primero para hacer preguntas..."}
              className="w-full text-base border-none py-3 pl-4 pr-14 focus:outline-none bg-transparent resize-none max-h-32"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isTyping}
            />
            <button 
               onClick={handleSendMessage}
               disabled={!inputValue.trim() || isTyping}
               className={cn(
                 "absolute right-3 p-2.5 rounded-xl transition-all shadow-sm",
                 inputValue.trim() && !isTyping ? "bg-primary text-white hover:bg-primary/90 active:scale-95" : "bg-slate-100 text-slate-400"
               )}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
          <div className="text-center mt-3 text-xs text-slate-400">
            Copilot procesa la información en chunks mediante RAG local. Exige respuestas basadas en datos reales.
          </div>
        </div>

      </div>
    </div>
  );
}
