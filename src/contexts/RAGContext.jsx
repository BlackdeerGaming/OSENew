import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import API_BASE_URL from '../config/api';

const RAGContext = createContext();

export const useRAG = () => {
  const context = useContext(RAGContext);
  if (!context) {
    throw new Error('useRAG debe ser usado dentro de un RAGProvider');
  }
  return context;
};

export const RAGProvider = ({ children }) => {
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('ose_copilot_messages');
    return saved ? JSON.parse(saved) : [
      {
        id: 1,
        role: 'assistant',
        content: '¡Hola! Soy OSE Copilot. Sube un documento PDF para que pueda procesarlo con mi motor RAG (VectorDB + Embeddings) y responder tus consultas basándome estrictamente en esa información.'
      }
    ];
  });
  
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStep, setUploadStep] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [fileData, setFileData] = useState(() => {
    const saved = localStorage.getItem('ose_copilot_file');
    return saved ? JSON.parse(saved) : null;
  });

  // Persistencia
  useEffect(() => {
    localStorage.setItem('ose_copilot_messages', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (fileData) {
      localStorage.setItem('ose_copilot_file', JSON.stringify(fileData));
    } else {
      localStorage.removeItem('ose_copilot_file');
    }
  }, [fileData]);

  const handleFileUpload = async (file) => {
    if (!file) return;
    
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
    setUploadProgress(10);
    setUploadStep('Subiendo archivo a la nube...');
    
    const formData = new FormData();
    formData.append("file", file);

    const progressInterval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev < 40) return prev + 5;
        if (prev < 70) return prev + 2;
        if (prev < 90) return prev + 0.5;
        return prev;
      });
    }, 1000);

    try {
      // Etapas simuladas
      setTimeout(() => setUploadStep('Analizando estructura del documento...'), 2000);
      setTimeout(() => setUploadStep('Ejecutando Visión IA (OCR Avanzado)...'), 4000);
      setTimeout(() => setUploadStep('Indexando en VectorDB (Pinecone)...'), 7000);

      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: "POST",
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || `HTTP error ${response.status}`);
      }

      const data = await response.json();
      setFileData({ name: file.name, chunks: data.chunks_created });
      
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'system',
        content: `✅ Documento "${file.name}" cargado y memorizado con éxito. Ya puedes hacerme preguntas sobre él.`
      }]);

    } catch (error) {
      clearInterval(progressInterval);
      console.error("Upload error:", error);
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'system',
        content: `❌ Mensaje del servidor: ${error.message}`
      }]);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setUploadStep('');
    }
  };

  const resetSession = () => {
    localStorage.removeItem('ose_copilot_messages');
    localStorage.removeItem('ose_copilot_file');
    window.location.reload();
  };

  const handleSendMessage = async (query) => {
    if (!query.trim() || isTyping) return;

    const userMessage = { id: Date.now(), role: 'user', content: query };
    setMessages(prev => [...prev, userMessage]);
    setIsTyping(true);

    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });

      const data = await response.json();

      if (response.ok) {
        setMessages(prev => [...prev, { 
          id: Date.now() + 1, 
          role: 'assistant', 
          content: data.answer,
          sources: data.sources 
        }]);
      } else {
        setMessages(prev => [...prev, { 
          id: Date.now() + 1, 
          role: 'system', 
          content: `❌ Error: ${data.detail || "No se pudo obtener respuesta."}` 
        }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { 
        id: Date.now() + 1, 
        role: 'system', 
        content: "❌ Error de conexión con el servidor RAG." 
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <RAGContext.Provider value={{
      messages,
      isUploading,
      uploadProgress,
      uploadStep,
      isTyping,
      fileData,
      handleFileUpload,
      handleSendMessage,
      resetSession,
      setMessages
    }}>
      {children}
    </RAGContext.Provider>
  );
};
