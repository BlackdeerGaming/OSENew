import React, { useState, useEffect, useRef } from "react";
import { Send, Bot, User, HelpCircle, Sparkles, Edit2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export default function AgentChat({ messages, onSendMessage, isTyping, quickOptions, onClearChat }) {
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    onSendMessage(inputValue);
    setInputValue("");
  };

  const handleQuickOption = (option) => {
    onSendMessage(option);
  };

  return (
    <div className="flex h-full flex-col bg-background/50 backdrop-blur-sm border-r border-border shadow-sm">
      {/* Intro Banner */}
      <div className="p-4 border-b border-border bg-secondary/50 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Orianna IA</h2>
            <p className="text-xs text-muted-foreground">Especialista en Archivística (Ley 594)</p>
          </div>
        </div>

        {/* New Chat Button */}
        {onClearChat && (
           <button 
             onClick={onClearChat}
             title="Limpiar memoria del chat"
             className="text-xs font-semibold flex items-center gap-1.5 px-2.5 py-1.5 rounded-md hover:bg-destructive/10 text-destructive/80 hover:text-destructive transition-colors border border-transparent hover:border-destructive/20"
           >
              Nuevo Chat
           </button>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6" ref={scrollRef}>
        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => (
            <motion.div
              key={msg.id || idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex flex-col max-w-[85%]",
                msg.sender === "user" ? "ml-auto items-end" : "mr-auto items-start"
              )}
            >
              <div className="flex items-end gap-2 mb-1">
                {msg.sender === "agent" && (
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Bot className="h-3 w-3" />
                  </div>
                )}
                <div
                  className={cn(
                    "px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-sm",
                    msg.sender === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-card border border-border text-foreground rounded-bl-sm"
                  )}
                >
                  {msg.text}
                </div>
                {msg.sender === "user" && (
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                    <User className="h-3 w-3" />
                  </div>
                )}
              </div>
              
              {/* Optional Edit button for user messages */}
              {msg.sender === "user" && idx === messages.length - (isTyping ? 1 : 2) && (
                <button className="text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1 mt-1 mr-8 transition-colors">
                  <Edit2 className="h-3 w-3" /> Editar respuesta
                </button>
              )}
            </motion.div>
          ))}
          {isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-end gap-2 max-w-[85%]"
            >
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Bot className="h-3 w-3" />
              </div>
              <div className="px-4 py-3 rounded-2xl bg-card border border-border rounded-bl-sm shadow-sm flex gap-1 items-center">
                <motion.div className="h-1.5 w-1.5 bg-muted-foreground rounded-full" animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0 }} />
                <motion.div className="h-1.5 w-1.5 bg-muted-foreground rounded-full" animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} />
                <motion.div className="h-1.5 w-1.5 bg-muted-foreground rounded-full" animate={{ y: [0, -3, 0] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Input Area */}
      <div className="p-4 bg-background border-t border-border">
        {/* Dynamic Quick Options */}
        {quickOptions && quickOptions.length > 0 && !isTyping && (
          <div className="flex flex-wrap gap-2 mb-3">
            {quickOptions.map((opt) => (
              <button
                key={opt}
                onClick={() => handleQuickOption(opt)}
                className="px-3 py-1.5 text-xs font-medium rounded-full bg-secondary border border-border text-foreground hover:bg-primary/10 hover:border-primary hover:text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {opt}
              </button>
            ))}
          </div>
        )}

        {/* Support Buttons */}
        <div className="flex gap-2 mb-3">
          <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none rounded-md focus-visible:ring-2 focus-visible:ring-ring">
             <HelpCircle className="h-3.5 w-3.5" /> No sé qué responder
          </button>
          <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none rounded-md focus-visible:ring-2 focus-visible:ring-ring">
             <Sparkles className="h-3.5 w-3.5" /> Sugerir valores
          </button>
        </div>

        {/* Input Form */}
        <form onSubmit={handleSend} className="relative flex items-center">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isTyping}
            placeholder="Escribe tu respuesta aquí..."
            className="w-full pl-4 pr-12 py-3 rounded-xl border border-border bg-card text-sm focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary disabled:opacity-50 transition-all shadow-sm"
          />
          <button
            type="submit"
            disabled={isTyping || !inputValue.trim()}
            className="absolute right-2 p-1.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-50 disabled:bg-muted hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
