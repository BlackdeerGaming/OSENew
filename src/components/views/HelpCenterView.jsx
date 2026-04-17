import React, { useState } from 'react';
import { HelpCircle, ChevronDown, ChevronRight, MessageSquare, BookOpen, Send, Lightbulb, Search, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

const FAQS = [
  {
    category: "General",
    items: [
      { q: "¿Qué es el sistema?", a: "Es una plataforma integral de gestión documental especializada en la creación, importación y valoración de Tablas de Retención Documental (TRD), integrando inteligencia artificial para automatizar flujos y búsquedas." },
      { q: "¿Para qué sirve?", a: "Sirve para digitalizar la jerarquía administrativa de tu entidad (dependencias) y automatizar el flujo de creación o importación de la TRD aplicando la Ley 594 de 2000." },
      { q: "¿Qué es una TRD?", a: "La Tabla de Retención Documental (TRD) es un listado de series, con sus correspondientes tipos documentales, a las cuales se les asigna un tiempo de permanencia en cada etapa del ciclo vital de los documentos." },
      { q: "¿Cómo funciona el flujo general?", a: "El flujo consta de tres pasos lógicos: 1) Crear el organigrama y áreas (Datos Estructurados), 2) Configurar las Series y Valoración Documental (Módulo TRD/Formularios), 3) Previsualizar y exportar la Tabla Final en PDF interactivo." }
    ]
  },
  {
    category: "TRD",
    items: [
      { q: "¿Cómo crear una TRD?", a: "Puedes usar los formularios en el módulo 'TRD' de la izquierda, o decirle directamente por chat a la IA (Orianna): 'Quiero crear una TRD para la Secretaría General'. Ella te pedirá los datos paso a paso." },
      { q: "¿Cómo importar una TRD?", a: "Si ya tienes tu TRD en PDF o imagen escaneada, ve a 'Importación TRD', sube el archivo, y nuestro motor de Visión e Inteligencia Artificial leerá el contenido para extraer la información. (Opción exclusiva para Administradores)." },
      { q: "¿Cómo aprobar una TRD?", a: "Al importar los datos, pasarán a un borrador. Deberás revisar la coincidencia de las series detectadas. Una vez que estés de acuerdo con los campos, presionas el botón 'APROBAR IMPORTACIÓN' para enviar la TRD a la base de datos oficial." },
      { q: "¿Cómo descargar una TRD?", a: "Desde la pantalla 'TRD', en la pestaña de 'Tabla Final', puedes dar clic en el botón 'Previsualizar y Exportar'. Esto generará una vista tipo documento oficial de alta calidad que puedes guardar en formato PDF." },
      { q: "¿Qué es la Tabla Final?", a: "Es el formato estándar o cuadro matriz (aprobado por el AGN / Archivo General) que resume visualmente cómo está conformada tu retención, listando códigos, retenciones numéricas en archivo de gestión y central, disposición técnica general y firmas." }
    ]
  },
  {
    category: "Datos Estructurados",
    items: [
      { q: "¿Qué son?", a: "Es la 'nuez' de información de tu entidad. Muestra jerárquicamente las Dependencias, enlazando qué Series y Subseries tiene configurada cada una." },
      { q: "¿Cómo se visualizan?", a: "Dependiendo de tu perfil, puedes usar el selector arriba a la derecha. Tienes dos vistas: 1) 'Jerárquica', estructurada por cajas en árbol y 2) 'Tipo Listado', visualizada como el clásico navegador de carpetas y archivos de Windows." },
      { q: "¿Cómo funcionan dependencias, series y subseries?", a: "Es un modelo descendente: Una dependencia (Oficina) produce una o varias Series. Una Serie genera cero, una o múltiples Subseries. Al asignar tipos a esas subseries, construyes la TRD de ese departamento." },
      { q: "¿Cómo usar los filtros y buscador?", a: "En la parte superior, tienes filtros desplegables para saltar hacia la caja específica de una dependencia o serie. El buscador unificado de texto abierto de la lupa busca por código y nombre instantáneamente." }
    ]
  },
  {
    category: "Organigrama",
    items: [
      { q: "¿Cómo crear dependencias?", a: "Ve al Menú lateral -> 'TRD' -> Dependencias. Puedes crearlas conversando con Orianna y diligenciando el formulario dinámico que aparece. También puedes subir una importación masiva." },
      { q: "¿Cómo editar desde el organigrama?", a: "Abre la previsualización del Organigrama. Al hacer doble clic sobre el rectángulo de una oficina, emergerá el modal de edición donde puedes actualizar su nombre, sigla o quién es su jefe sin salir de la gráfica." },
      { q: "¿Qué es una dependencia principal?", a: "Es una oficina que funciona como un árbol independiente o nodo raíz porque no tiene oficinas superiores por encima de ella. (Ej. El Despacho del Alcalde, el Concejo Municipal o la Personería). En el organigrama se dibujan como árboles de flujo separados." }
    ]
  },
  {
    category: "Usuarios y roles",
    items: [
      { q: "¿Qué puede hacer un administrador?", a: "Un Administrador goza de permisos de edición sobre todos los Datos Estructurados de su Empresa. Puede importar TRD, realizar valoraciones, agregar usuarios, generar PDF y gestionar metadatos avanzados." },
      { q: "¿Qué puede hacer un usuario de consulta?", a: "Un perfil de Consulta no puede editar nada. Solamente tiene permisos para visualizar el Dashboard Estadístico general, descargar PDFs de las TRD publicadas, usar Documencio en la RAG y leer ayuda." },
      { q: "¿Cómo funcionan los permisos?", a: "Nos valemos de Control de Acceso Basado en Roles (RBAC). El módulo lee el nivel de usuario; si tu cuenta carece de privilegios operativos, no verás o no funcionarán los botones de lapiz, papelera o edición por comandos." }
    ]
  },
  {
    category: "Biblioteca",
    items: [
      { q: "¿Qué es la Biblioteca?", a: "Es un repositorio inteligente y seguro alimentado por un sistema RAG adaptativo (Generación Aumentada por Recuperación) que aloja Actos Administrativos, Manuales de Funciones, Archivos Resolutivos y Acuerdos Municipales." },
      { q: "¿Cómo consultar documentos?", a: "Puedes verlos directamente en los visores listados de RAG, descargarlos con el clic derecho, o previsualizarlos en pantalla a la derecha seleccionando el elemento de la tabla de archivos vigentes." },
      { q: "¿Cómo funciona el RAG?", a: "Cuando haces una pregunta desde el chatbot integrado de la Biblioteca, la IA escanea el contenido y página exacta de los PDF que cargaste de la Biblioteca (contexto validado) evitando crear alucinaciones o invenciones." }
    ]
  },
  {
    category: "Inteligencia Artificial (IA)",
    items: [
      { q: "Orianna: ¿Qué hace?", a: "Orianna es la Agente Especialista Principal experta en Ley 594 de 2000. Actúa como navegadora guiando qué formularios necesitas y puede responder sobre retenciones de TRD de manera conversacional, ahorrándote clics." },
      { q: "Orianna: ¿Qué tipo de preguntas puedo hacer?", a: "Preguntale cómo se valora un tipo de contrato de prestación de servicios, en qué consiste la 'Disposición de Conservación Permanente' o simplemente ponle instrucciones como: 'Borremos todos los datos de la última subserie creada'." },
      { q: "Orianna: ¿Puede crear dependencias, series y subseries?", a: "¡Sí! Sólo dile: 'Quiero crear una nueva Secretaría' y abrirá la cascada de preguntas adecuadas. Guardará los datos apenas respondas." },
      { q: "Orianna: Ejemplos de uso", a: "• 'Explícame qué código debe llevar un decreto en la Administración pública'\n• 'Modifica la dependencia Secretaría de Gobierno a Secretaría General'\n• 'Empieza una Importación nueva'" },
      { q: "Documencio / Biblioteca: ¿Cómo consulta documentos?", a: "Manda un prompt en el chat de Biblioteca como: 'Según el Manual de Operaciones Capítulo 3, qué pasa si ocurre X?', Documencio lee inmediatamente los PDFs en el banco." },
      { q: "Documencio / Biblioteca: ¿Cómo hacer preguntas?", a: "Asegúrate de ser específico y que el documento que aborda el tema esté listado y analizado por el servidor. Hazlo como si charlaras con un bibliotecario." },
      { q: "Documencio / Biblioteca: ¿Qué esperar de sus respuestas?", a: "Respuesta textual y extractada directamente basada EN LOS DOCUMENTOS de la empresa. Si el RAG no encuentra una respuesta en tu propia Biblioteca, admitirá que no lo sabe." }
    ]
  },
  {
    category: "Importación TRD",
    roles: ['superadmin', 'admin'],
    items: [
      { q: "¿Cómo funciona el OCR?", a: "Utiliza Procesamiento de Imágenes Computacional (LLM visuales) avanzado. Busca bordes tabulares en el PDF, saca el texto o imagen con distorsión, y mapea inteligentemente columnas como (CÓDIGO, TIPO DOCUMENTAL) al estricto modelo SQL interno." },
      { q: "¿Qué pasa si hay errores?", a: "La vista preaprobatoria de OSE destacará en ambar si identificó falta de jerarquización correcta. Podrás editar o borrar la fila en cuestión manualmente antes de mandarlo a la base." },
      { q: "¿Cómo aprobar datos?", a: "Navegas a Importación TRD, la IA terminará el flujo de inferencia y te presentará el resultado tabulado en pantalla. Si das al botón verde 'Completar Importación a Base de Datos' viajarán todos." }
    ]
  }
];

const GUIDES = [
  {
    title: "1. Quiero crear una TRD",
    steps: [
      "Si eres Admin/Super, ubícate en el menú lateral y dale clic a 'TRD (Módulo)'.",
      "Empieza el flujo con inteligencia conversacional o por clic: Crea Dependencia.",
      "Asigna al menos una Serie y su Código asociándola a la Dependencia.",
      "Abre 'Valoración TRD' completando cronogramas (Archivo Gestión/Central), Disposición (Conserva Total/Minuta) y Soporte Técnico.",
      "Verifica tus cambios desde 'Datos Estructurados'."
    ]
  },
  {
    title: "2. Quiero importar un archivo",
    roles: ['superadmin', 'admin'],
    steps: [
      "Ve a 'Importación TRD' en el Panel de Opciones (Sidebar).",
      "Encontrarás el Dropzone. Arrastra tu documento matriz de la TRD actual de la organización.",
      "Espera que el Job Runner de IA procese las páginas tabulares de tus PDF o Scans (podría tomar de segundos a minutos según tamaño).",
      "Finaliza corrigiendo las posibles incongruencias que el motor te avise en rojo mediante el visor en pantalla."
    ]
  },
  {
    title: "3. Quiero consultar documentos",
    steps: [
      "En el menú lateral dirigete a 'Biblioteca' (Módulo RAG).",
      "Haz clik sobre el nombre del Archivo o Libro en la lista derecha y oprime 'Previsualizar' permitiéndote leerlo integralmente en HTML.",
      "¿Mucho texto? Mejor charla con Documencio en la ventana de chat a la izquierda y pídele un resumen o un dato específico."
    ]
  },
  {
    title: "4. Quiero usar Orianna",
    roles: ['superadmin', 'admin'],
    steps: [
      "Desde cualquier vista de TRD, fíjate en el gran componente flotante interactivo de chat.",
      "Escribe cualquier petición natural. Ej: 'Cuáles son las leyes en torno a microfilmar TRDs'.",
      "O úsala como agente: 'Hola Orianna, editemos la Serie x para actualizarle su código'."
    ]
  }
];

function AccordionItem({ q, a }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white mb-2 shadow-sm">
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="w-full flex items-center justify-between p-4 text-left hover:bg-slate-50 transition-colors"
      >
        <span className="font-bold text-slate-800 text-sm">{q}</span>
        {isOpen ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
      </button>
      {isOpen && (
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
          <p className="text-sm text-slate-600 leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  );
}

export default function HelpCenterView({ currentUser }) {
  const [activeTab, setActiveTab] = useState('faq');
  const [searchQuery, setSearchQuery] = useState('');
  const [ticket, setTicket] = useState({ name: currentUser?.nombre || '', email: currentUser?.email || '', type: 'duda', message: '' });
  const [isSent, setIsSent] = useState(false);

  const role = currentUser?.role || 'user';

  // Combinar búsqueda con FAQs
  const filteredFaqs = FAQS.map(category => {
    // Si no aplica al rol, omitir por completo (ejemplo futuro)
    if (category.roles && !category.roles.includes(role)) return null;

    const filteredItems = category.items.filter(item => 
      item.q.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.a.toLowerCase().includes(searchQuery.toLowerCase())
    );
    return { ...category, items: filteredItems };
  }).filter(c => c && c.items.length > 0);

  const handleSendTicket = (e) => {
    e.preventDefault();
    if(!ticket.message) return;
    
    setIsSent(true);
    setTimeout(() => {
      setTicket({ ...ticket, message: '', type: 'duda' });
      setIsSent(false);
    }, 5000);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden relative">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-8 shrink-0">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary border border-primary/20">
              <HelpCircle className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">Centro de Ayuda y FAQ</h1>
              <p className="text-sm text-slate-500 font-medium mt-1">Encuentra respuestas, aprende a usar el sistema o contacta soporte.</p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="max-w-4xl mx-auto mt-8 flex border-b border-slate-200">
          <button 
            onClick={() => setActiveTab('faq')}
            className={cn(
              "px-6 py-3 text-sm font-bold tracking-tight border-b-2 transition-all flex items-center gap-2",
              activeTab === 'faq' ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            <BookOpen className="h-4 w-4" /> Preguntas Frecuentes
          </button>
          <button 
            onClick={() => setActiveTab('guides')}
            className={cn(
              "px-6 py-3 text-sm font-bold tracking-tight border-b-2 transition-all flex items-center gap-2",
              activeTab === 'guides' ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            <Lightbulb className="h-4 w-4" /> Guías Rápidas
          </button>
          <button 
            onClick={() => setActiveTab('support')}
            className={cn(
              "px-6 py-3 text-sm font-bold tracking-tight border-b-2 transition-all flex items-center gap-2",
              activeTab === 'support' ? "border-primary text-primary" : "border-transparent text-slate-500 hover:text-slate-800"
            )}
          >
            <MessageSquare className="h-4 w-4" /> Contactar Soporte
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto p-4 md:p-8">
        <div className="max-w-4xl mx-auto">
          
          {/* FAQ TAB */}
          {activeTab === 'faq' && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Buscador */}
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <input 
                  type="text"
                  placeholder="¿Qué estás buscando? (Ej. importar, Orianna, descargar)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 rounded-xl border border-slate-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-sm font-medium"
                />
              </div>

              {filteredFaqs.length === 0 ? (
                <div className="p-12 text-center text-slate-500 border border-slate-200 rounded-xl border-dashed">
                  No encontramos resultados para tu búsqueda.
                </div>
              ) : (
                filteredFaqs.map((category, idx) => (
                  <div key={idx} className="mb-8">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 px-2">
                       {category.category}
                    </h3>
                    <div className="space-y-2">
                      {category.items.map((item, i) => (
                        <AccordionItem key={i} q={item.q} a={item.a} />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* GUIDES TAB */}
          {activeTab === 'guides' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {GUIDES.filter(g => !g.roles || g.roles.includes(role)).map((guide, idx) => (
                <div key={idx} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -mr-16 -mt-16 transition-transform group-hover:scale-110" />
                  <h3 className="text-base font-bold text-slate-900 mb-4">{guide.title}</h3>
                  <ol className="space-y-3 relative z-10">
                    {guide.steps.map((step, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                        <span className="shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-slate-100 text-[10px] font-bold text-slate-500 mt-0.5">
                          {i + 1}
                        </span>
                        <span className="leading-relaxed">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          )}

          {/* SUPPORT TAB */}
          {activeTab === 'support' && (
            <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-2xl p-8 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center gap-3 mb-6 p-4 rounded-xl bg-amber-50 relative overflow-hidden border border-amber-100">
                <Info className="h-5 w-5 text-amber-500 shrink-0" />
                <p className="text-sm font-medium text-amber-800">
                  ¿Encontraste un error técnico o necesitas configuración especial? 
                  Envía el siguiente formulario y un agente humano (no la IA) te contactará en breve.
                </p>
              </div>

              {isSent ? (
                <div className="text-center py-12 animate-in zoom-in-95 duration-300">
                  <div className="h-16 w-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Send className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Mensaje enviado exitosamente</h3>
                  <p className="text-slate-500">Nuestro equipo ha recibido tu solicitud y te responderá pronto al correo registrado.</p>
                </div>
              ) : (
                <form onSubmit={handleSendTicket} className="space-y-5">
                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <label className="block text-[11px] font-black uppercase text-slate-500 mb-2">Nombre</label>
                      <input type="text" value={ticket.name} readOnly className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 outline-none" />
                    </div>
                    <div>
                      <label className="block text-[11px] font-black uppercase text-slate-500 mb-2">Correo</label>
                      <input type="email" value={ticket.email} readOnly className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600 outline-none" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-black uppercase text-slate-500 mb-2">¿Qué tipo de problema tienes?</label>
                    <select 
                      value={ticket.type} 
                      onChange={e => setTicket({...ticket, type: e.target.value})}
                      className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                    >
                      <option value="duda">Tengo una duda general de cómo usar algo</option>
                      <option value="bug">Encontré un error o bug en la plataforma</option>
                      <option value="sugerencia">Tengo una sugerencia de mejora</option>
                      <option value="plan">Quiero mejorar mi plan / Aumentar cupos RAG</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-black uppercase text-slate-500 mb-2">Descripción del problema</label>
                    <textarea 
                      required
                      placeholder="Explícanos en detalle lo que necesitas..."
                      value={ticket.message}
                      onChange={e => setTicket({...ticket, message: e.target.value})}
                      className="w-full h-32 px-4 py-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 resize-none"
                    />
                  </div>

                  <button 
                    type="submit"
                    className="w-full py-3.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white rounded-xl text-sm font-bold shadow-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Send className="h-4 w-4" />
                    Enviar Ticket a Soporte
                  </button>
                </form>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
