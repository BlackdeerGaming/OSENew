import React, { useState, useEffect } from 'react';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import AgentChat from './components/chat/AgentChat';
import DependenciaForm from './components/forms/DependenciaForm';
import SerieForm from './components/forms/SerieForm';
import SubserieForm from './components/forms/SubserieForm';
import TRDForm from './components/forms/TRDForm';
import StructuredDataView from './components/data/StructuredDataView';
import TRDGenerator from './components/trd/TRDGenerator';
import { Save, Bot } from 'lucide-react';
import Login from './components/auth/Login';
import SignUp from './components/auth/SignUp';
import ActivateAccount from './components/auth/ActivateAccount';
import ForgotPassword from './components/auth/ForgotPassword';
import ResetPassword from './components/auth/ResetPassword';
import MainSidebar from './components/layout/MainSidebar';
import MainHeader from './components/layout/MainHeader';
import DashboardView from './components/views/DashboardView';
import CopilotView from './components/views/CopilotView';
import UsersView from './components/views/UsersView';
import SettingsView from './components/views/SettingsView';
import OrgChartView from './components/views/OrgChartView';
import EntitiesView from './components/views/EntitiesView';
import API_BASE_URL from './config/api';
import { RAGProvider } from './contexts/RAGContext';
import { useTRDData } from './hooks/useTRDData';

const DEPS_FLOW = [
  { field: 'nombre', query: 'Vamos a crear una nueva dependencia. ¿Cuál es el nombre?', type: 'text', quick: [] },
  { field: 'sigla', query: '¿Tiene alguna sigla? (Ej. AC)', type: 'text', quick: [] },
  { field: 'codigo', query: '¿Qué código numérico le asignarás?', type: 'text', quick: [] },
  { field: 'pais', query: '¿En qué país se ubica?', type: 'select', quick: ['Colombia'] },
  { field: 'departamento', query: '¿En qué departamento?', type: 'text', quick: ['Cundinamarca', 'Antioquia'] },
  { field: 'ciudad', query: '¿Y en qué ciudad?', type: 'text', quick: ['Bogotá', 'Medellín'] },
  { field: 'direccion', query: 'Dime la dirección física de la dependencia.', type: 'textarea', quick: [] },
  { field: 'telefono', query: '¿Algún teléfono de contacto?', type: 'text', quick: [] },
  { field: 'dependeDe', query: 'Por último, ¿esta dependencia depende administrativamente de alguna otra?', type: 'text', quick: ['Despacho del Alcalde', 'Gerencia General'] },
];

const SERIE_FLOW = [
  { field: 'dependenciaId', query: 'Vamos a crear una Serie Documental. Primero, dime a qué área o dependencia de las que has guardado le pertenece esto.', type: 'select', quick: [] },
  { field: 'nombre', query: '¿Cuál es el nombre de esta Serie?', type: 'text', quick: ['Contratos', 'Hojas de Vida', 'Informes'] },
  { field: 'codigo', query: '¿Qué código le das a la serie?', type: 'text', quick: [] },
  { field: 'tipoDocumental', query: 'Enumera los tipos documentales que la componen (separados por coma).', type: 'textarea', quick: [] },
  { field: 'descripcion', query: '¿Deseas añadir una descripción del propósito de la serie? Si no la necesitas, escribe "No aplica".', type: 'textarea', quick: ['No aplica'] }
];

const SUBSERIE_FLOW = [
  { field: 'dependenciaId', query: 'Para esta Subserie, elige primero la Dependencia y la Serie principal a la que pertenece.', type: 'select', quick: [] },
  { field: 'serieId', query: '¿Y la serie asociada?', type: 'select', quick: [] },
  { field: 'nombre', query: '¿Cuál es el nombre de esta Subserie?', type: 'text', quick: [] },
  { field: 'codigo', query: '¿Alfanumérico o código que la identifique?', type: 'text', quick: [] },
  { field: 'tipoDocumental', query: 'Tipos documentales específicos de esta subserie.', type: 'textarea', quick: [] },
  { field: 'descripcion', query: '¿Deseas añadir una descripción o justificación para esta subserie? Si no la necesitas, escribe "No aplica".', type: 'textarea', quick: ['No aplica'] }
];

const TRDFORM_FLOW = [
  { field: 'dependenciaId', query: 'Vamos a realizar la Valoración Documental. Selecciona a qué dependencia aplicaremos estos valores.', type: 'select', quick: [] },
  { field: 'serieId', query: 'Selecciona la Serie.', type: 'select', quick: [] },
  { field: 'subserieId', query: '¿Lleva alguna Subserie asociada? Si no es el caso, elige "No aplica".', type: 'select', quick: ['No aplica'] },
  { field: 'estadoConservacion', query: '¿Cuál es el estado de conservación?', type: 'select', quick: ['Bueno', 'Regular', 'Malo'] },
  { field: 'ordenacion', query: '¿Cuál es su ordenación? (Puedes responder separaradas por coma: Alfabética, Cronológica, Numérica, Otra).', type: 'text', quick: ['Alfabética', 'Cronológica', 'Numérica'] },
  { field: 'disposicion', query: '¿Cuál es su Disposición Final? (Conservación total, Eliminación, Selección).', type: 'text', quick: ['Conservación total', 'Eliminación', 'Selección'] },
  { field: 'valor', query: '¿Qué Valor Documental posee? (Administrativo, Legal, Técnico, Histórico...).', type: 'text', quick: ['Administrativo', 'Legal', 'Técnico', 'Histórico'] },
  { field: 'retencionGestion', query: '¿Cuántos Años de retención en Archivo de Gestión?', type: 'number', quick: ['1', '2', '5'] },
  { field: 'retencionCentral', query: '¿Cuántos Años de retención en Archivo Central?', type: 'number', quick: ['5', '10', '20'] },
  { field: 'ddhh', query: '¿Esta serie está vinculada a DDHH / DIH?', type: 'select', quick: ['Si', 'No'] },
  { field: 'reproduccion', query: '¿Se requiere Reproducción Técnica? (Microfilmación, Digitalización, Ninguna).', type: 'text', quick: ['Ninguna', 'Microfilmación', 'Digitalización'] },
  { field: 'procedimiento', query: 'Describe brevemente el Procedimiento.', type: 'textarea', quick: [] },
  { field: 'actoAdmo', query: 'Finalmente, menciona el Acto Administrativo que lo sustenta.', type: 'textarea', quick: [] },
];

function App() {
  // Auth State
  const [authView, setAuthView] = useState('login'); 
  const [currentUser, setCurrentUser] = useState(null); 
  const [activationToken, setActivationToken] = useState(null);
  const [resetToken, setResetToken] = useState(null);

  // SaaS Context State
  const [mainView, setMainView] = useState('dashboard');
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');

  // Global App Data State
  const [entities, setEntities] = useState([
    { 
      id: 'e1', 
      razonSocial: 'Alcaldía Municipal de Cota', 
      nit: '800.123.456-7', 
      email: 'contacto@cota-cundinamarca.gov.co', 
      telefono: '3124567890',
      pais: 'Colombia',
      departamento: 'Cundinamarca',
      ciudad: 'Cota',
      sigla: 'AMC',
      direccion: 'Carrera 4 # 12-34'
    },
    { 
      id: 'e2', 
      razonSocial: 'Gobernación de Antioquia', 
      nit: '900.987.654-3', 
      email: 'notificaciones@antioquia.gov.co', 
      telefono: '6042345678',
      pais: 'Colombia',
      departamento: 'Antioquia',
      ciudad: 'Medellín',
      sigla: 'GDA',
      direccion: 'Calle 42 # 52-186'
    },
    { 
      id: 'e3', 
      razonSocial: 'Ministerio de Transporte', 
      nit: '899.999.001-9', 
      email: 'tramites@mintransporte.gov.co', 
      telefono: '6013240800',
      pais: 'Colombia',
      departamento: 'Bogotá D.C.',
      ciudad: 'Bogotá',
      sigla: 'MINTR',
      direccion: 'Avenida El Dorado # 60-00'
    }
  ]);
  const [users, setUsers] = useState([
    { 
      id: 'u0', 
      nombre: 'Super', 
      apellido: 'Admin', 
      email: 'superadmin@ose.com', 
      username: 'superadmin',
      perfil: 'superadmin', 
      estado: 'Activo', 
      isActivated: true,
      activationToken: null,
      password: 'admin' 
    }
  ]);


  // Detectar tokens en la URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    
    // Activación de cuenta
    const actToken = params.get('token');
    if (actToken) {
      setActivationToken(actToken);
      setAuthView('activate');
    }

    // Recuperación de contraseña
    const rstToken = params.get('reset_token');
    if (rstToken) {
      setResetToken(rstToken);
      setAuthView('reset-password');
    }

    // Cargar usuarios y entidades iniciales desde el backend
    const fetchData = async () => {
      try {
        const [usersRes, entitiesRes] = await Promise.all([
          fetch(`${API_BASE_URL}/users`),
          fetch(`${API_BASE_URL}/entities`)
        ]);

        if (usersRes.ok) {
          const data = await usersRes.json();
          if (data.length > 0) setUsers(data);
        }
        if (entitiesRes.ok) {
          const data = await entitiesRes.json();
          if (data.length > 0) setEntities(data);
        }
      } catch (err) {
        console.error("Error fetching initial data:", err);
      }
    };
    fetchData();
  }, []);

  const handleActivateUser = async (token, newPassword) => {
    try {
      const response = await fetch(`${API_BASE_URL}/activate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: token,
          password: newPassword
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        return { success: true };
      } else {
        return { success: false, message: data.detail || 'Error al activar la cuenta.' };
      }
    } catch (err) {
      console.error("Error activating user:", err);
      return { success: false, message: 'Hubo un error de conexión con el servidor.' };
    }
  };

  const handleResetPassword = (token, newPassword) => {
    // Si estamos en dev (petición simulada), buscamos el token en los usuarios
    const userIndex = users.findIndex(u => u.resetToken === token);
    
    if (userIndex === -1) {
       // Mock para tokens generados en la misma sesión dev (si no hay persistencia)
       if (token.startsWith("RESET-")) {
          return { success: true };
       }
       return { success: false, message: 'El enlace de recuperación no es válido o ha expirado.' };
    }

    const updatedUsers = [...users];
    updatedUsers[userIndex] = {
      ...users[userIndex],
      password: newPassword,
      resetToken: null,
      resetExpiry: null
    };
    
    setUsers(updatedUsers);
    return { success: true };
  };

  const handleIssueResetToken = (email, token) => {
    setUsers(users.map(u => u.email.toLowerCase() === email.toLowerCase() ? {
      ...u,
      resetToken: token,
      resetExpiry: Date.now() + (60 * 60 * 1000) // 1 hora
    } : u));
  };

  const {
    dependencias, series, subseries, trdRecords,
    setDependencias, setSeries, setSubseries, setTrdRecords,
    addDependencia, deleteDependencia,
    addSerie, deleteSerie,
    addSubserie, deleteSubserie,
    addTrdRecord,
    isLoading: trdLoading, isSynced,
  } = useTRDData();

  // UI State
  const handleUpdateUserProfile = (updatedData) => {
    // Actualizar en el array global
    const updatedUsers = users.map(u => 
      u.id === currentUser.id ? { ...u, ...updatedData } : u
    );
    setUsers(updatedUsers);
    
    // Actualizar el usuario actual en sesión
    setCurrentUser(prev => ({ ...prev, ...updatedData }));
    return { success: true };
  };

  const [activeModule, setActiveModule] = useState('dependencias');
  const [activeFormData, setActiveFormData] = useState({});
  const [flowStep, setFlowStep] = useState(0);
  const [isAgentOpen, setIsAgentOpen] = useState(true);
  const [selectedTrdIds, setSelectedTrdIds] = useState(new Set());
  
  // Chat State
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [currentOptions, setCurrentOptions] = useState([]);

  // Calculate current flow array
  const currentFlow = activeModule === 'dependencias' ? DEPS_FLOW
                    : activeModule === 'series' ? SERIE_FLOW
                    : activeModule === 'subseries' ? SUBSERIE_FLOW
                    : activeModule === 'trdform' ? TRDFORM_FLOW
                    : [];

  const activeField = currentFlow[flowStep] ? currentFlow[flowStep].field : null;
  const quickOptions = currentOptions.length > 0 ? currentOptions : (currentFlow[flowStep] ? currentFlow[flowStep].quick : []);

  // Inicializar un saludo base si no hay mensajes
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{ sender: 'agent', text: '¡Hola! Soy Orianna, tu asistente especializada en TRD. Puedo ayudarte a construir toda la estructura (Dependencias, Series, Subseries) directamente además de las TRD y organigramas. Escribe lo que necesites.' }]);
    }
  }, [messages.length]);


  // Unified simulateAgent
  const simulateAgentResponse = (text, options = null) => {
    setIsTyping(true);
    setTimeout(() => {
      setMessages(prev => [...prev, { sender: 'agent', text }]);
      setIsTyping(false);
      if (options) {
        setCurrentOptions(options);
      }
    }, 800 + Math.random() * 500); // slightly faster interactions
  };

  const executeAgentActions = (actions) => {
    const idMap = {};
    actions.forEach(action => {
      if (action.type === 'CREATE') {
         const newId = Date.now().toString() + "_" + Math.floor(Math.random()*10000);
         if (action.id) idMap[action.id] = newId;

         const rawPayload = { ...action.payload };
         
         // Robust mapping for common variations in field names
         const payload = {
            nombre: rawPayload.nombre || rawPayload.name || "Sin nombre",
            codigo: rawPayload.codigo || rawPayload.code || (Math.floor(Math.random() * 900) + 100).toString(),
            sigla: rawPayload.sigla || rawPayload.abbreviation || "GEN",
            pais: rawPayload.pais || rawPayload.country || "Colombia",
            departamento: rawPayload.departamento || rawPayload.state || "Cundinamarca",
            ciudad: rawPayload.ciudad || rawPayload.city || "Bogotá",
            direccion: rawPayload.direccion || rawPayload.address || "Carrera 7 # 12-34",
            telefono: rawPayload.telefono || rawPayload.phone || "6012345678",
            dependeDe: idMap[rawPayload.dependeDe] || rawPayload.dependeDe || rawPayload.parent || "ninguna",
            // For series/subseries
            dependenciaId: idMap[rawPayload.dependenciaId] || rawPayload.dependenciaId || rawPayload.dependencyId,
            serieId: idMap[rawPayload.serieId] || rawPayload.serieId || rawPayload.seriesId,
            tipoDocumental: rawPayload.tipoDocumental || rawPayload.documentType || "Documentos generales"
         };

         const newRecord = { ...payload, id: newId };
         
         // Use Supabase-backed hook methods
         if (action.entity === 'dependencias') addDependencia(newRecord);
         else if (action.entity === 'series') addSerie(newRecord);
         else if (action.entity === 'subseries') addSubserie(newRecord);
      } 
      else if (action.type === 'UPDATE') {
         const updated = (list) => list.map(item => item.id === action.id ? { ...item, ...action.payload } : item);
         // For updates, apply locally (Supabase update via addDependencia/addSerie which upserts)
         if (action.entity === 'dependencias') { addDependencia({ ...dependencias.find(x => x.id === action.id), ...action.payload, id: action.id }); }
         else if (action.entity === 'series') { addSerie({ ...series.find(x => x.id === action.id), ...action.payload, id: action.id }); }
         else if (action.entity === 'subseries') { addSubserie({ ...subseries.find(x => x.id === action.id), ...action.payload, id: action.id }); }
      }
      else if (action.type === 'DELETE') {
         handleDelete(action.entity, action.id);
      }
    });
  };

  const handleUserMessage = (text) => {
    setMessages(prev => [...prev, { sender: 'user', text }]);
    setCurrentOptions([]);
    
    // --- UNIVERSAL AI CRUD INTERCEPTOR ---
    // This allows Orianna to perform actions like CREATE/UPDATE/DELETE across all relevant modules
    if (['dependencias', 'series', 'subseries', 'datos', 'trd', 'orgchart', 'trdform'].includes(activeModule)) {
       simulateAgentResponse("Procesando instrucción...");
       
       const context = { dependencias, series, subseries };
       const history = messages.map(m => ({ role: m.sender === 'user' ? 'user' : 'agent', content: m.text }));
       
       fetch(`${API_BASE_URL}/agent-action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: text, context, history })
       })
       .then(res => {
          if (!res.ok) throw new Error("Error HTTP");
          return res.json();
       })
       .then(data => {
          if (data.actions && Array.isArray(data.actions) && data.actions.length > 0) {
             executeAgentActions(data.actions);
          }
          simulateAgentResponse(data.message || "Acción completada exitosamente.");
          // Reset old forms to prevent wizard conflicts
          setFlowStep(0);
          setActiveFormData({});
       })
       .catch(err => {
          console.error(err);
          simulateAgentResponse("Lo siento, hubo un problema técnico ejecutando la instrucción con la IA.");
       });
       
       return; 
    }
    // ---------------------------------------------

    // NLP basic cleanup - More robust handling
    let cleaned = text.trim();
    // Remove starting conversational fillers
    cleaned = cleaned.replace(/^(creo que\s*)?(el nombre de la dependencia es|la (nueva )?dependencia se llama|la dependencia es|el nombre es|es|mi|se llama|quiero que se llame|llamada)\s+/gi, '').trim();
    // Remove quotes
    cleaned = cleaned.replace(/["']/g, '');
    // Capitalize first letter if it exists
    if (cleaned.length > 0) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }

    // Fill data
    if (activeField) {
      // VALIDATION: Relation Selects (dependenciaId, serieId, subserieId)
      if (activeField === 'dependenciaId') {
        if (dependencias.length === 0) {
          simulateAgentResponse("Error: No has creado ninguna dependencia. Ve al módulo de Dependencias primero para crear al menos una. No podemos continuar sin dependencias base.");
          return;
        }
        const matches = dependencias.filter(d => d.nombre.toLowerCase().includes(cleaned.toLowerCase()) || d.codigo === cleaned);
        if (matches.length === 0) {
          simulateAgentResponse(`No encontré ninguna dependencia que coincida con "${text}". Por favor revisa el nombre o código exacto ingresado.`);
          return;
        }
        if (matches.length > 1) {
          simulateAgentResponse(`He encontrado varias dependencias con ese nombre (${matches.map(m => m.codigo).join(", ")}). Por favor, escribe únicamente el código exacto de la que deseas.`);
          return;
        }
        cleaned = matches[0].id; // Store ID
      } 
      else if (activeField === 'serieId') {
        if (series.length === 0) {
          simulateAgentResponse("Error: No has creado ninguna serie. Necesitas crear una serie primero antes de continuar.");
          return;
        }
        const activeDepSeries = activeFormData.dependenciaId ? series.filter(s => s.dependenciaId === activeFormData.dependenciaId) : series;
        const matches = activeDepSeries.filter(s => s.nombre.toLowerCase().includes(cleaned.toLowerCase()) || s.codigo === cleaned);
        if (matches.length === 0) {
          simulateAgentResponse(`No encontré ninguna serie que coincida con "${text}" para la dependencia seleccionada. Por favor verifica.`);
          return;
        }
        if (matches.length > 1) {
          simulateAgentResponse(`Hay varias series llamadas igual (${matches.map(m => m.codigo).join(", ")}). Por favor, proporciona el código exacto.`);
          return;
        }
        cleaned = matches[0].id; // Store ID
      }
      else if (activeField === 'subserieId') {
        // Subseries in TRD form are optional or required depending on the serie
        if (subseries.length === 0 && !['ninguna', 'no aplica'].includes(cleaned.toLowerCase()) && cleaned !== '') {
           // Allow empty or "ninguna"
           simulateAgentResponse("Actualmente no tienes subseries creadas. Puedes continuar omitiendo este campo de subserie escribiendo 'ninguna' o 'no aplica'.");
           return;
        }
        if (!['ninguna', 'no aplica'].includes(cleaned.toLowerCase()) && cleaned !== '') {
          const activeSerieSubseries = activeFormData.serieId ? subseries.filter(s => s.serieId === activeFormData.serieId) : subseries;
          const matches = activeSerieSubseries.filter(s => s.nombre.toLowerCase().includes(cleaned.toLowerCase()) || s.codigo === cleaned);
          if (matches.length === 0) {
            simulateAgentResponse(`No encontré subserie coincidente con "${text}". Verifica el nombre o escribe "ninguna" para omitir.`);
            return;
          }
          if (matches.length > 1) {
             simulateAgentResponse(`Múltiples subseries coinciden (${matches.map(m => m.codigo).join(", ")}). Ingresa el código numérico de cuál usar.`);
             return;
          }
          cleaned = matches[0].id; // Store ID
        } else {
          cleaned = ""; // No subserie
        }
      } else if (activeField === 'ordenacion') {
         const updates = {};
         ['Alfabética', 'Cronológica', 'Numérica', 'Otra'].forEach(opt => {
           if (cleaned.toLowerCase().includes(opt.toLowerCase())) updates[`ord_${opt}`] = true;
         });
         if (Object.keys(updates).length > 0) setActiveFormData(prev => ({ ...prev, ...updates }));
         cleaned = null;
      } else if (activeField === 'disposicion') {
         const updates = {};
         ['Conservación total', 'Eliminación', 'Selección'].forEach(opt => {
           if (cleaned.toLowerCase().includes(opt.toLowerCase())) updates[`disp_${opt}`] = true;
         });
         if (Object.keys(updates).length > 0) setActiveFormData(prev => ({ ...prev, ...updates }));
         cleaned = null;
      } else if (activeField === 'valor') {
         const updates = {};
         ['Administrativo', 'Técnico', 'Contable', 'Fiscal', 'Legal', 'Histórico', 'Sin Valor', 'Otro'].forEach(opt => {
           if (cleaned.toLowerCase().includes(opt.toLowerCase())) updates[`val_${opt}`] = true;
         });
         if (Object.keys(updates).length > 0) setActiveFormData(prev => ({ ...prev, ...updates }));
         cleaned = null;
      } else if (activeField === 'reproduccion') {
         const updates = {};
         if (cleaned.toLowerCase().includes('microfilma')) updates['rep_microfilmacion'] = true;
         if (cleaned.toLowerCase().includes('digitali')) updates['rep_digitalizacion'] = true;
         setActiveFormData(prev => ({ ...prev, ...updates }));
         cleaned = null;
      }

      if (cleaned !== null && typeof cleaned === 'string') {
        if (cleaned.toLowerCase() === 'no aplica' || cleaned.toLowerCase() === 'ninguna') {
           cleaned = "";
        }
      }

      // "No aplica" for description
      if (activeField === 'descripcion' && ['no aplica', 'ninguna'].includes(cleaned.toLowerCase())) {
        cleaned = "";
      }

      // Save Data
      if (cleaned !== null) {
        setActiveFormData(prev => ({ ...prev, [activeField]: cleaned }));
      }
      
      const nextStep = flowStep + 1;
      setFlowStep(nextStep);

      if (nextStep < currentFlow.length) {
        simulateAgentResponse(`¡Anotado! ${currentFlow[nextStep].query}`);
      } else {
        simulateAgentResponse('¡Has completado todos los campos asistidos! Revisa el formulario a la derecha y presiona "Guardar Registro" cuando estés seguro.');
      }
    } else {
      simulateAgentResponse('El formulario ya está completo. Presiona "Guardar Registro" en el panel derecho.');
    }
  };

  const handleSave = () => {
    // Required fields validation
    const requiredFields = {
      dependencias: ['nombre', 'codigo', 'pais', 'departamento', 'ciudad', 'direccion'],
      series: ['nombre', 'codigo', 'dependenciaId'],
      subseries: ['nombre', 'codigo', 'dependenciaId', 'serieId'],
      trdform: ['dependenciaId', 'serieId', 'estadoConservacion', 'retencionGestion', 'retencionCentral', 'ddhh', 'procedimiento', 'actoAdmo']
    };
    const reqs = requiredFields[activeModule] || [];
    for (const field of reqs) {
      if (!activeFormData[field]) {
         simulateAgentResponse(`¡Alto ahí! Te falta completar un campo obligatorio marcado con asterisco (*). Por favor revisa el formulario y vuelve a intentar guardar.`);
         return;
      }
    }

    // Unique code validation (Global)
    if (activeFormData.codigo && activeModule !== 'trdform') {
      let isDuplicate = false;
      if (activeModule === 'dependencias') isDuplicate = dependencias.some(x => x.codigo === activeFormData.codigo && x.id !== activeFormData.id);
      else if (activeModule === 'series') isDuplicate = series.some(x => x.codigo === activeFormData.codigo && x.id !== activeFormData.id);
      else if (activeModule === 'subseries') isDuplicate = subseries.some(x => x.codigo === activeFormData.codigo && x.id !== activeFormData.id);
      
      if (isDuplicate) {
         simulateAgentResponse(`¡Cuidado! El código "${activeFormData.codigo}" ya existe en el sistema. Los códigos deben ser únicos. Por favor, modifícalo.`);
         return;
      }
    }

    const isUpdate = !!activeFormData.id;
    const record = isUpdate ? activeFormData : { ...activeFormData, id: Date.now().toString() };

    if (activeModule === 'dependencias') {
      addDependencia(record);
    } else if (activeModule === 'series') {
      addSerie(record);
    } else if (activeModule === 'subseries') {
      addSubserie(record);
    } else if (activeModule === 'trdform') {
      addTrdRecord(record);
    }

    // Restart form
    setActiveFormData({});
    setFlowStep(0);
    simulateAgentResponse(`¡Registro guardado exitosamente! Ha sido almacenado en Supabase. ☁️\nSi deseas registrar otro, ${currentFlow[0]?.query.toLowerCase()}`);
  };

  const handleEdit = (moduleType, record) => {
    setActiveModule(moduleType);
    setActiveFormData(record);
    setFlowStep(0);
  };

  // Cascade delete when a TRD record linked to deleted ID
  const handleDelete = (moduleType, recordId) => {
    if (moduleType === 'dependencias') {
      deleteDependencia(recordId); // Cascade handled by hook + DB
    } else if (moduleType === 'series') {
      deleteSerie(recordId);
    } else if (moduleType === 'subseries') {
      deleteSubserie(recordId);
    }
    if (activeFormData.id === recordId) {
      setActiveFormData({});
    }
  };

  // Calculate TRD Rows globally so Header can export PDF
  const trdRows = trdRecords.map(record => {
    const dep = dependencias.find(d => d.id === record.dependenciaId) || {};
    const serie = series.find(s => s.id === record.serieId) || {};
    const subserie = record.subserieId ? subseries.find(s => s.id === record.subserieId) : null;

    let disposicionStr = [];
    if (record['disp_Conservación total']) disposicionStr.push("CT");
    if (record['disp_Eliminación']) disposicionStr.push("E");
    if (record['disp_Selección']) disposicionStr.push("S");

    return {
      id: record.id,
      dependencia: dep.nombre || "(Desconocida)",
      codigo: subserie ? subserie.codigo : serie.codigo || "",
      serie: serie.nombre || "",
      subserie: subserie ? subserie.nombre : "",
      tipoDocumental: subserie ? subserie.tipoDocumental : serie.tipoDocumental || "",
      retencionGestion: record.retencionGestion || "",
      retencionCentral: record.retencionCentral || "",
      disposicion: disposicionStr.join(", ") || record.disposicion || "N/A"
    };
  });

  // Filtered rows for PDF (only selected, or all if none selected)
  const exportRows = selectedTrdIds.size === 0 ? trdRows : trdRows.filter(r => selectedTrdIds.has(r.id));

  const toggleTrdRow = (id) => {
    setSelectedTrdIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllTrdRows = (checked) => {
    if (checked) setSelectedTrdIds(new Set(trdRows.map(r => r.id)));
    else setSelectedTrdIds(new Set());
  };

  const handleLogin = (user) => {
    setCurrentUser(user);
    setAuthView('dashboard');
  };

  // Determine which entities the current user can see/select
  const userEntities = React.useMemo(() => {
    if (!currentUser) return entities;
    if (currentUser.role === 'superadmin') return entities;
    // If user has entidadIds (multi) use those, fall back to single entidadId
    const ids = currentUser.entidadIds?.length > 0
      ? currentUser.entidadIds
      : currentUser.entidadId ? [currentUser.entidadId] : [];
    return ids.length > 0 ? entities.filter(e => ids.includes(e.id)) : entities;
  }, [currentUser, entities]);

  // Auto pre-select entity when navigating to a form module if user has exactly one entity
  const handleNavigation = (moduleId) => {
    setActiveModule(moduleId);
    const autoData = {};
    if (userEntities.length === 1) {
      autoData.entidadId = userEntities[0].id;
    }
    setActiveFormData(autoData);
    setFlowStep(0);
  };

  // Renderización de Autenticación
  if (['login', 'signup', 'activate', 'forgot-password', 'reset-password'].includes(authView) && !currentUser) {
    return (
      <div className="min-h-screen bg-slate-50">
        {authView === 'login' && (
          <Login 
            onLogin={handleLogin} 
            onNavigateToSignUp={() => setAuthView('signup')} 
            onNavigateToForgotPassword={() => setAuthView('forgot-password')} 
            users={users} 
          />
        )}
        {authView === 'signup' && (
          <SignUp 
            onSignUp={(u) => { setUsers([...users, u]); setAuthView('login'); }} 
            onNavigateToLogin={() => setAuthView('login')} 
          />
        )}
        {authView === 'activate' && (
          <ActivateAccount 
            token={activationToken} 
            onActivate={handleActivateUser} 
            onBackToLogin={() => setAuthView('login')} 
          />
        )}
        {authView === 'forgot-password' && (
          <ForgotPassword 
            onNavigateToLogin={() => setAuthView('login')} 
            onIssueToken={handleIssueResetToken} 
          />
        )}
        {authView === 'reset-password' && (
          <ResetPassword 
            token={resetToken} 
            onReset={handleResetPassword} 
            onNavigateToLogin={() => setAuthView('login')} 
          />
        )}
      </div>
    );
  }

  const fakeStats = {
    totalDocs: trdRecords.length > 0 ? trdRecords.length * 12 : 145,
    expiredDocs: trdRecords.length > 0 ? Math.floor(trdRecords.length * 2.5) : 24,
    riskLevel: trdRecords.length > 0 ? 'Medio' : 'Bajo',
    aiQueries: 128
  };

  const renderLegacyTRDLayout = () => (
    <div className="flex flex-1 overflow-hidden w-full h-full bg-background rounded-l-2xl border-l border-y shadow-inner">
      {/* Navigation Sidebar */}
      <Sidebar 
        activeModule={activeModule} 
        onNavigate={handleNavigation} 
        isAgentOpen={isAgentOpen}
        onToggleAgent={() => setIsAgentOpen(v => !v)}
        currentUser={currentUser}
      />

      {/* Dynamic Left Panel: Chat (only for forms, and when agent is open) */}
      {['dependencias', 'series', 'subseries', 'trdform', 'trd', 'datos', 'orgchart'].includes(activeModule) && isAgentOpen && (
        <section className="w-[350px] shrink-0 border-r border-border h-full shadow-lg z-10 bg-card transition-all duration-300">
          <AgentChat 
            messages={messages} 
            onSendMessage={handleUserMessage} 
            isTyping={isTyping}
            quickOptions={isTyping ? [] : quickOptions} 
            currentUser={currentUser}
            onClearChat={() => setMessages([])}
          />
        </section>
      )}

      {/* Right Panel: Content Area */}
      <main className="flex-1 bg-secondary/10 relative overflow-y-auto w-full rounded-br-2xl">
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-primary/[0.02] to-transparent" />
        <div className="relative p-6 h-full flex flex-col">
          {/* Header removed as requested */}
          
          <div className="flex-1">
            {activeModule === 'dependencias' && (
              <DependenciaForm data={activeFormData} onChange={setActiveFormData} activeField={activeField} dependencias={dependencias} entities={userEntities} currentUser={currentUser} />
            )}
            {activeModule === 'orgchart' && (
              <OrgChartView dependencias={dependencias} currentUser={currentUser} />
            )}
            {activeModule === 'series' && (
              <SerieForm data={activeFormData} onChange={setActiveFormData} activeField={activeField} dependencias={dependencias} entities={userEntities} currentUser={currentUser} />
            )}
            {activeModule === 'subseries' && (
              <SubserieForm data={activeFormData} onChange={setActiveFormData} activeField={activeField} dependencias={dependencias} series={series} entities={userEntities} currentUser={currentUser} />
            )}
            {activeModule === 'trdform' && (
              <TRDForm data={activeFormData} onChange={setActiveFormData} activeField={activeField} dependencias={dependencias} series={series} subseries={subseries} entities={userEntities} currentUser={currentUser} />
            )}
            {activeModule === 'datos' && (
              <StructuredDataView dependencias={dependencias} series={series} subseries={subseries} onEdit={handleEdit} onDelete={handleDelete} currentUser={currentUser} />
            )}
            {activeModule === 'trd' && (
              <TRDGenerator 
                rows={trdRows} 
                selectedIds={selectedTrdIds}
                onToggleRow={toggleTrdRow}
                onToggleAll={toggleAllTrdRows}
                currentUser={currentUser}
              />
            )}
          </div>

          {/* Save Button floating dock for forms */}
          {/* Orianna status moved to sidebar */}

          {['dependencias', 'series', 'subseries', 'trdform'].includes(activeModule) && currentUser?.role !== 'user' && (
           <div className="mt-6 flex justify-end max-w-4xl w-full mx-auto pb-8">
             <button 
               onClick={handleSave}
               className="flex items-center gap-2 bg-success text-success-foreground hover:bg-success/90 px-6 py-2.5 rounded-md shadow-md text-sm font-semibold transition-all transform active:scale-95"
             >
               <Save className="h-5 w-5" />
               {activeFormData.id ? "Actualizar Registro" : "Guardar Registro"}
             </button>
           </div>
          )}
        </div>
      </main>
    </div>
  );

  return (
    <RAGProvider>
      <div className="flex flex-col h-screen overflow-hidden bg-background font-sans">
      <div className="flex h-screen overflow-hidden">
          <MainSidebar 
            activeView={mainView} 
            onNavigate={(id) => {
              setMainView(id);
              if (id === 'trd') setActiveModule('trd');
            }}
            searchQuery={globalSearchQuery}
            onSearchQueryChange={setGlobalSearchQuery}
            currentUser={currentUser}
          />
         
         <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
            <MainHeader 
               onLogout={() => { setAuthView('login'); setCurrentUser(null); }}
               mainView={mainView}
               trdProps={{ status: "En Progreso", rows: exportRows }}
               currentUser={currentUser}
            />

            <div className="flex-1 overflow-hidden relative flex">
              {mainView === 'dashboard' && <DashboardView stats={fakeStats} searchQuery={globalSearchQuery} currentUser={currentUser} />}
              {mainView === 'entities' && <EntitiesView entities={entities} setEntities={setEntities} />}
              {mainView === 'copilot' && <CopilotView currentUser={currentUser} />}
              {mainView === 'users' && <UsersView searchQuery={globalSearchQuery} currentUser={currentUser} users={users} setUsers={setUsers} entities={entities} />}
              {mainView === 'settings' && <SettingsView currentUser={currentUser} onUpdate={handleUpdateUserProfile} />}
              
              {/* TRD Módulo (Layout Anterior embebido) */}
              {mainView === 'trd' && renderLegacyTRDLayout()}
            </div>
         </div>
      </div>
    </div>
    </RAGProvider>
  );
}

export default App;
