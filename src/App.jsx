import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import AgentChat from './components/chat/AgentChat';
import DependenciaForm from './components/forms/DependenciaForm';
import SerieForm from './components/forms/SerieForm';
import SubserieForm from './components/forms/SubserieForm';
import TRDForm from './components/forms/TRDForm';
import StructuredDataView from './components/data/StructuredDataView';
import TRDGenerator from './components/trd/TRDGenerator';
import { Save, Bot, ArrowLeft, Printer, Download, BrainCircuit, Activity } from 'lucide-react';
import Login from './components/auth/Login';
import SignUp from './components/auth/SignUp';
import ActivateAccount from './components/auth/ActivateAccount';
import ForgotPassword from './components/auth/ForgotPassword';
import ResetPassword from './components/auth/ResetPassword';
import MainSidebar from './components/layout/MainSidebar';
import MainHeader from './components/layout/MainHeader';
import DashboardView from './components/views/DashboardView';
import UsersView from './components/views/UsersView';
import SettingsView from './components/views/SettingsView';
import OrgChartView from './components/views/OrgChartView';
import EntitiesView from './components/views/EntitiesView';

import TRDImportView from './components/views/TRDImportView';
import DocumentcioRAGView from './components/views/DocumentcioRAGView';
import API_BASE_URL from './config/api';
import { RAGProvider } from './contexts/RAGContext';
import { useTRDData } from './hooks/useTRDData';
import StatusModal from './components/ui/StatusModal';
import { handleExportPDFGeneral } from './utils/exportUtils';

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
  const [modalStatus, setModalStatus] = useState({ isOpen: false, type: 'loading', message: '' });
  const [entidadLogoBase64, setEntidadLogoBase64] = useState(null);

  // SaaS Context State
  const [mainView, setMainView] = useState('dashboard');
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [isPrinting, setIsPrinting] = useState(false); // 🔥 Portal de Impresión 🔥

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
    refreshData,
    imports, setImports
  } = useTRDData(currentUser?.id);

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
  
  // Chat State (Moved up to avoid ReferenceError in effects)
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = React.useState(false); // Using React.useState just in case or ensure import
  const [currentOptions, setCurrentOptions] = useState([]);
  
  // Dashboard Stats Logic
  const [ragCount, setRagCount] = useState(0);
  const [tokensUsed, setTokensUsed] = useState(() => parseInt(localStorage.getItem('ose_tokens_used')) || 0);

  // Registro de Actividad (Feed)
  const [activityLogs, setActivityLogs] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('ose_activity_logs')) || [];
    } catch (e) { return []; }
  });

  const addActivityLog = useCallback((action) => {
    setActivityLogs(prev => {
      const userName = currentUser?.nombre || currentUser?.username || 'Sistema';
      const newLog = {
        id: "act_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
        user: userName,
        message: `${userName} ${action.toLowerCase()}`,
        timestamp: new Date().toISOString()
      };
      const updated = [newLog, ...prev].slice(0, 50); // Máximo 50 registros
      localStorage.setItem('ose_activity_logs', JSON.stringify(updated));
      return updated;
    });
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('ose_tokens_used', tokensUsed);
  }, [tokensUsed]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const ragRes = await fetch(`${API_BASE_URL}/rag-documents`);
        if (ragRes.ok) {
          const data = await ragRes.json();
          setRagCount(data.length);
        }
      } catch (e) { console.error("Error fetching stats:", e); }
    };
    if (currentUser) fetchData();
  }, [currentUser]);

  // Track tokens on chat messages
  useEffect(() => {
    if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.sender === 'agent') {
         setTokensUsed(prev => prev + (lastMsg.text?.length || 0) / 4);
      }
    }
  }, [messages]);

  // Selective Export TRD Filter
  const [selectedDependencia, setSelectedDependencia] = useState("TODAS");
  

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

  const executeAgentActions = async (actions) => {
    console.log('🤖 Orianna procesando acciones:', actions);
    setModalStatus({ isOpen: true, type: 'loading', message: 'Sincronizando cambios automáticos con la nube...' });
    const idMap = {};
    let actionsProcessed = 0;

    for (const action of actions) {
      let entity = action.entity?.toLowerCase();
      if (entity === 'dependency') entity = 'dependencias';
      if (entity === 'serie') entity = 'series';
      if (entity === 'subserie') entity = 'subseries';
      if (entity === 'trd_records') entity = 'TRD';

      try {
        const entityLabel = entity.charAt(0).toUpperCase() + entity.slice(1);
        const name = action.payload?.nombre || action.payload?.name || "Registro";

        if (action.type === 'CREATE') {
          // ... (keep previous logic)
          // Add logging here if needed, but we can log at the end of loop or per action
          addActivityLog(`Creación ${entityLabel} - ${name}`);
          
          const newId = Date.now().toString() + "_" + Math.floor(Math.random()*10000);
          if (action.id) idMap[action.id] = newId;

          const rawPayload = { ...action.payload };
          
          // Auto-create missing dependencies if they don't exist by name
          let depId = rawPayload.dependenciaId || rawPayload.dependencyId || rawPayload.dependenciaNombre;
          const foundDep = dependencias.find(x => x.id === depId || x.nombre?.toLowerCase() === depId?.toLowerCase());
          if (!foundDep && depId && !idMap[depId] && entity === 'TRD') {
              const strId = Date.now().toString() + "_dep";
              idMap[depId] = strId;
              await addDependencia({ id: strId, entityId: userEntities[0]?.id, nombre: depId, sigla: "GEN", codigo: (Math.floor(Math.random() * 900) + 100).toString() });
              addActivityLog(`Creación Dependencia - ${depId} (Auto)`);
          }

          let serId = rawPayload.serieId || rawPayload.seriesId || rawPayload.serieNombre;
          const foundSer = series.find(x => x.id === serId || x.nombre?.toLowerCase() === serId?.toLowerCase());
          if (!foundSer && serId && !idMap[serId] && entity === 'TRD') {
              const strId = Date.now().toString() + "_ser";
              idMap[serId] = strId;
              let actualDepId = idMap[depId] || foundDep?.id;
              await addSerie({ id: strId, entityId: userEntities[0]?.id, dependenciaId: actualDepId, nombre: serId, codigo: (Math.floor(Math.random() * 90) + 10).toString(), tipoDocumental: rawPayload.tipoDocumental || "Documentos" });
              addActivityLog(`Creación Serie - ${serId} (Auto)`);
          }

          const resolveId = (providedId, collection) => {
              if (!providedId) return null;
              if (idMap[providedId]) return idMap[providedId];
              const found = collection.find(x => x.id === providedId || x.nombre?.toLowerCase() === providedId.toLowerCase());
              return found ? found.id : providedId;
          };

          const payload = {
              entityId: rawPayload.entidadId || rawPayload.entityId || userEntities[0]?.id || null,
              nombre: rawPayload.nombre || rawPayload.name || "Sin nombre",
              codigo: rawPayload.codigo || rawPayload.code || (Math.floor(Math.random() * 900) + 100).toString(),
              sigla: rawPayload.sigla || "GEN",
              pais: rawPayload.pais || "Colombia",
              departamento: rawPayload.departamento || "Cundinamarca",
              ciudad: rawPayload.ciudad || "Bogotá",
              direccion: rawPayload.direccion || "Carrera 7 # 12-34",
              telefono: rawPayload.telefono || "6012345678",
              dependeDe: resolveId(rawPayload.dependeDe, dependencias) || "ninguna",
              dependenciaId: resolveId(rawPayload.dependenciaId || rawPayload.dependencyId || rawPayload.dependenciaNombre, dependencias),
              serieId: resolveId(rawPayload.serieId || rawPayload.seriesId || rawPayload.serieNombre, series),
              subserieId: resolveId(rawPayload.subserieId || rawPayload.subseriesId || rawPayload.subserieNombre, subseries),
              tipoDocumental: rawPayload.tipoDocumental || "Documentos generales",
              retencionGestion: rawPayload.retencionGestion || 2,
              retencionCentral: rawPayload.retencionCentral || 10,
              disposicion: rawPayload.disposicion || "CT",
              procedimiento: rawPayload.procedimiento || "Conservación total según norma.",
              ddhh: rawPayload.ddhh || "No",
              actoAdmo: rawPayload.actoAdmo || "Resolución 001",
          };

          const newRecord = { ...payload, id: newId };
          if (entity === 'dependencias') await addDependencia(newRecord);
          else if (entity === 'series') await addSerie(newRecord);
          else if (entity === 'subseries') await addSubserie(newRecord);
          else if (entity === 'TRD' || entity === 'valoracion') await addTrdRecord(newRecord);
          actionsProcessed++;
        } 
        else if (action.type === 'UPDATE') {
          addActivityLog(`Edición ${entityLabel} - ${name}`);
          const entityId = idMap[action.id] || action.id;
          const pool = entity === 'dependencias' ? dependencias : (entity === 'series' ? series : (entity === 'subseries' ? subseries : trdRecords));
          const existing = pool.find(x => x.id === entityId);
          if (existing) {
             const updated = { ...existing, ...action.payload };
             if (entity === 'dependencias') await addDependencia(updated);
             else if (entity === 'series') await addSerie(updated);
             else if (entity === 'subseries') await addSubserie(updated);
             else if (entity === 'TRD') await addTrdRecord(updated);
             actionsProcessed++;
          }
        }
        else if (action.type === 'DELETE') {
          addActivityLog(`Borrado ${entityLabel} - ${name}`);
          if (entity === 'dependencias') await deleteDependencia(action.id);
          else if (entity === 'series') await deleteSerie(action.id);
          else if (entity === 'subseries') await deleteSubserie(action.id);
          actionsProcessed++;
        }
      } catch (err) {
        console.error(`Error en acción ${action.type} sobre ${entity}:`, err);
      }
    }
    
    if (actionsProcessed > 0) {
      setModalStatus({ isOpen: true, type: 'success', message: `Se procesaron y sincronizaron ${actionsProcessed} cambios correctamente.` });
    } else {
      setModalStatus({ isOpen: false, type: 'loading', message: '' });
    }
    return actionsProcessed;
  };

  const handleUserMessage = (text) => {
    setMessages(prev => [...prev, { sender: 'user', text }]);
    setCurrentOptions([]);
    
    if (['dependencias', 'series', 'subseries', 'datos', 'trd', 'orgchart', 'trdform'].includes(activeModule)) {
       simulateAgentResponse("Analizando solicitud y preparando sincronización...");
       
       const context = { dependencias, series, subseries, trdRecords, entidades: userEntities };
       const history = messages.map(m => ({ role: m.sender === 'user' ? 'user' : 'agent', content: m.text }));
       
       fetch(`${API_BASE_URL}/agent-action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: text, context, history })
       })
       .then(res => res.json())
       .then(async data => {
          if (data.actions?.length > 0) {
             try {
               await executeAgentActions(data.actions);
               simulateAgentResponse(data.message || "Cambios guardados y sincronizados correctamente en la nube. ☁️");
             } catch (e) {
               setModalStatus({ isOpen: true, type: 'error', message: "Error al aplicar cambios automáticos en la nube." });
               simulateAgentResponse("Se realizaron cambios locales, pero hubo un error al sincronizar con la nube.");
             }
          } else {
             simulateAgentResponse(data.message || "No se identificaron acciones específicas.");
          }
          setFlowStep(0);
          setActiveFormData({});
       })
       .catch(() => simulateAgentResponse("Error de conexión con el motor de IA."));
       
       return; 
    }

    let cleaned = text.trim();
    cleaned = cleaned.replace(/^(creo que\s*)?(el nombre de la dependencia es|la (nueva )?dependencia se llama|la dependencia es|el nombre es|es|mi|se llama|quiero que se llame|llamada)\s+/gi, '').trim();
    if (cleaned.length > 0) cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

    if (activeField) {
      // (Lógica de validación omitida para brevedad pero mantenemos la estructura)
      if (cleaned.toLowerCase() === 'no aplica' || cleaned.toLowerCase() === 'ninguna') cleaned = "";
      setActiveFormData(prev => ({ ...prev, [activeField]: cleaned }));
      
      const nextStep = flowStep + 1;
      setFlowStep(nextStep);
      if (nextStep < currentFlow.length) {
        simulateAgentResponse(`¡Anotado! ${currentFlow[nextStep].query}`);
      } else {
        simulateAgentResponse('¡Formulario completo! Revisa los datos y presiona "Guardar Registro" para subirlo a la nube.');
      }
    }
  };

  const handleSave = async () => {
    setModalStatus({ isOpen: true, type: 'loading', message: 'Guardando y sincronizando con Supabase Cloud...' });
    const isUpdate = !!activeFormData.id;
    const record = isUpdate ? activeFormData : { ...activeFormData, id: Date.now().toString() };

    try {
      if (activeModule === 'dependencias') await addDependencia(record);
      else if (activeModule === 'series') await addSerie(record);
      else if (activeModule === 'subseries') await addSubserie(record);
      else if (activeModule === 'trdform') await addTrdRecord(record);

      const entityMap = {
        'dependencias': 'Dependencia',
        'series': 'Serie',
        'subseries': 'Subserie',
        'trdform': 'TRD'
      };
      const entityLabel = entityMap[activeModule] || 'Registro';
      const actionLabel = isUpdate ? 'Edición' : 'Creación';
      
      addActivityLog(`${actionLabel} ${entityLabel} - ${record.nombre || record.id}`);
      
      setActiveFormData({});
      setFlowStep(0);
      setModalStatus({ isOpen: true, type: 'success', message: 'El registro se ha guardado y sincronizado exitosamente en la nube.' });
    } catch (err) {
      console.error(err);
      setModalStatus({ isOpen: true, type: 'error', message: `Error en la sincronización: ${err.message}` });
    }
  };

  const handleEdit = (moduleType, record) => {
    setActiveModule(moduleType);
    setActiveFormData(record);
    setFlowStep(0);
  };

  // Cascade delete when a TRD record linked to deleted ID
  const handleDelete = async (moduleType, recordId) => {
    setModalStatus({ isOpen: true, type: 'loading', message: 'Eliminando registro de la nube...' });
    try {
      // Logic for TRD/RAG synchronization
      let syncRagDocName = null;
      if (moduleType === 'trdform') {
        const trdToDel = trdRecords.find(t => t.id === recordId);
        await deleteTrdRecord(recordId);
        addActivityLog(`Borrado TRD - ${trdToDel?.nombre || recordId}`);
      } else if (moduleType === 'dependencias') {
        const dep = dependencias.find(d => d.id === recordId);
        await deleteDependencia(recordId);
        addActivityLog(`Borrado Dependencia - ${dep?.nombre || recordId}`);
      } else if (moduleType === 'series') {
        const ser = series.find(s => s.id === recordId);
        await deleteSerie(recordId);
        addActivityLog(`Borrado Serie - ${ser?.nombre || recordId}`);
      } else if (moduleType === 'subseries') {
        const sub = subseries.find(s => s.id === recordId);
        await deleteSubserie(recordId);
        addActivityLog(`Borrado Subserie - ${sub?.nombre || recordId}`);
      }

      // Sync with RAG if applicable
      if (syncRagDocName) {
        try {
          const ragRes = await fetch(`${API_BASE_URL}/rag-documents`);
          if (ragRes.ok) {
            const ragDocs = await ragRes.json();
            const matchingDoc = ragDocs.find(d => 
              d.filename?.toLowerCase().includes(syncRagDocName.toLowerCase()) || 
              d.metadata?.label?.toLowerCase() === syncRagDocName.toLowerCase()
            );
            if (matchingDoc) {
              console.log("🗑️ Sincronizando: Borrando documento RAG asociado:", matchingDoc.metadata?.label || matchingDoc.filename);
              await fetch(`${API_BASE_URL}/rag-documents/${matchingDoc.id}`, { method: 'DELETE' });
              // Refresh RAG count
              setRagCount(prev => Math.max(0, prev - 1));
            }
          }
        } catch (e) {
          console.warn("⚠️ Error en sincronización RAG:", e);
        }
      }

      if (activeFormData.id === recordId) {
        setActiveFormData({});
      }
      setModalStatus({ isOpen: true, type: 'success', message: 'Registro eliminado correctamente de la nube.' });
    } catch (err) {
      setModalStatus({ isOpen: true, type: 'error', message: `Error al eliminar: ${err.message}` });
    }
  };

  // Calculate TRD Rows globally
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
      retencionGestion: record.retencionGestion || "0",
      retencionCentral: record.retencionCentral || "0",
      disposicion: disposicionStr.join(", ") || record.disposicion || "N/A",
      procedimiento: record.procedimiento || "",
      soporte: record.rep_digitalizacion || record.rep_microfilmacion ? 'ambos' : 'fisico',
      reproduccion: record.rep_digitalizacion ? 'Digitalización' : (record.rep_microfilmacion ? 'Microfilmación' : 'Ninguna')
    };
  });

  // Filtered rows for UI and PDF
  const filteredTrdRows = React.useMemo(() => {
    if (selectedDependencia === "TODAS") return trdRows;
    return trdRows.filter(r => r.dependencia === selectedDependencia);
  }, [trdRows, selectedDependencia]);

  const uniqueDependencias = React.useMemo(() => {
    const deps = new Set(trdRows.map(r => r.dependencia || "Sin Oficina"));
    return Array.from(deps);
  }, [trdRows]);

  const toggleTrdRow = (id) => {
    setSelectedTrdIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllTrdRows = (checked) => {
    if (checked) setSelectedTrdIds(new Set(filteredTrdRows.map(r => r.id)));
    else setSelectedTrdIds(new Set());
  };

  const handleLogin = (user, rememberMe) => {
    setCurrentUser(user);
    if (rememberMe) {
      localStorage.setItem('ose_user', JSON.stringify(user));
    }
    setAuthView('dashboard');
  };

  // Restore session from localStorage if present
  useEffect(() => {
    const savedUser = localStorage.getItem('ose_user');
    if (savedUser) {
      try {
        const user = JSON.parse(savedUser);
        setCurrentUser(user);
        setAuthView('dashboard');
        console.log("♻️ Sesión recuperada de localStorage");
      } catch (e) {
        localStorage.removeItem('ose_user');
      }
    }
  }, []);

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

  const currentEntity = userEntities.find(e => e.id === currentUser?.entidadId) || userEntities[0];

  // Pre-cargar logo en Base64 para evitar errores de CORS en exportaciones PDF
  useEffect(() => {
    if (!currentEntity?.logoUrl) {
      setEntidadLogoBase64(null);
      return;
    }

    const convertToBase64 = async () => {
      try {
        const response = await fetch(currentEntity.logoUrl, { mode: 'cors' });
        const blob = await response.blob();
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
      } catch (err) {
        console.warn("⚠️ No se pudo pre-cargar el logo en Base64 (CORS):", err);
        return null;
      }
    };

    convertToBase64().then(base64 => setEntidadLogoBase64(base64));
  }, [currentEntity]);

  const handleExportTRD = () => {
    setIsPrinting(true);
  };

  // Auto pre-select entity when navigating to a form module if user has at least one entity
  const handleNavigation = (moduleId) => {
    setActiveModule(moduleId);
    const autoData = {};
    if (userEntities.length > 0) {
      console.log("📍 Auto-seleccionando entidad:", userEntities[0].nombre || userEntities[0].razonSocial);
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

  // Real Metrics Calculation
  const trdList = trdRecords || [];
  const totalCreatedDocs = trdList.length + (ragCount || 0);
  
  const expiredDocsCount = trdList.filter(r => {
    if (!r.createdAt) return false;
    const yearGestion = parseInt(r.retencionGestion || 0);
    const yearCentral = parseInt(r.retencionCentral || 0);
    const totalRetention = yearGestion + yearCentral;
    const expiryDate = new Date(r.createdAt);
    expiryDate.setFullYear(expiryDate.getFullYear() + totalRetention);
    return expiryDate < new Date();
  }).length;

  // Contamos como "no aprobadas" cualquier sesión de importación que no haya llegado a 'success'
  // esto incluye: 'analyzing', 'reviewing', 'extracted', 'error'
  const pendingSessions = (imports || []).filter(i => i.status !== 'success');
  const pendingTRDsCount = pendingSessions.length;

  const realStats = {
    totalDocs: totalCreatedDocs,
    expiredDocs: expiredDocsCount,
    unapprovedTRDs: pendingTRDsCount,
    tokensUsed: Math.floor(tokensUsed),
    trend: "+5% vs mes anterior" // Hardcoded trend for now
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
        hasTrdData={trdRecords.length > 0}
      />

      {/* Dynamic Left Panel: Chat (only for forms, and when agent is open) */}
      {['dependencias', 'series', 'subseries', 'trdform', 'trd', 'datos', 'orgchart'].includes(activeModule) && isAgentOpen && (
        <section className="w-[350px] shrink-0 border-r border-border h-full shadow-lg z-10 bg-card transition-all duration-300 relative">
          <AgentChat 
            messages={messages} 
            onSendMessage={handleUserMessage} 
            isTyping={isTyping}
            quickOptions={isTyping ? [] : quickOptions} 
            currentUser={currentUser}
            onClearChat={() => setMessages([])}
          />
          {/* Bloqueo IA Orianna */}
          {!(currentUser?.iaDisponible ?? true) && (
            <div className="absolute inset-0 z-50 flex items-center justify-center p-6 text-center">
              <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
              <div className="relative bg-white p-6 rounded-2xl shadow-xl max-w-[280px] flex flex-col items-center gap-3 animate-in zoom-in-95 duration-200">
                <BrainCircuit className="w-10 h-10 text-primary" />
                <h3 className="text-lg font-black text-slate-900 leading-tight">Orianna IA Restringida</h3>
                <p className="text-slate-500 text-xs font-medium">Si quieres este servicio, mejora tu plan o habla con tu administrador.</p>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Right Panel: Content Area */}
      <main className="flex-1 bg-secondary/10 relative overflow-y-auto w-full rounded-br-2xl">
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-primary/[0.02] to-transparent" />
        <div className="relative p-6 h-full flex flex-col">
          
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
              <div id="trd-final-report-area" className="print-content h-full">
                <TRDGenerator 
                  rows={filteredTrdRows} 
                  selectedIds={selectedTrdIds}
                  onToggleRow={toggleTrdRow}
                  onToggleAll={toggleAllTrdRows}
                  currentUser={currentUser}
                  currentEntity={currentEntity}
                  logoBase64={entidadLogoBase64}
                />
              </div>
            )}
            <div style={{ display: activeModule === 'import' ? 'block' : 'none', height: '100%' }}>
              <TRDImportView 
                onImportComplete={executeAgentActions} 
                currentUser={currentUser} 
                currentEntity={currentEntity} 
                logoBase64={entidadLogoBase64} 
                imports={imports}
                setImports={setImports}
              />
            </div>
          </div>

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

  // 🔥 EL PORTAL: Si estamos imprimiendo, matamos el resto del DOM 🔥
  if (isPrinting) {
    return (
      <div className="bg-slate-100 min-h-screen w-full flex flex-col items-center overflow-auto print:block print:overflow-visible">
        {/* Barra de Herramientas de Previsualización */}
        <div className="w-full flex justify-between items-center px-6 py-3 bg-slate-900 text-white sticky top-0 z-[100] shadow-lg print:hidden">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsPrinting(false)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-bold transition-all border border-slate-700 active:scale-95"
            >
              <ArrowLeft className="h-4 w-4" />
              VOLVER A LA GESTIÓN
            </button>
            <div className="h-6 w-px bg-slate-800" />
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Previsualización de Reporte Oficial</span>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                const depName = selectedDependencia === "TODAS" ? "EmpresaGlobal" : selectedDependencia.replace(/\s+/g, '');
                const randomId = Math.floor(10000000 + Math.random() * 90000000); // 8 cifras
                const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '_');
                const customFilename = `${depName}_${randomId}_${dateStr}`;
                
                handleExportPDFGeneral('trd-final-report-area', customFilename);
              }}
              className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-bold transition-all shadow-lg active:scale-95"
            >
              <Download className="h-4 w-4" />
              DESCARGAR PDF
            </button>
          </div>
        </div>

        <div className="w-full flex-1 flex justify-center p-0 m-0 print:block">
          <TRDGenerator 
            rows={filteredTrdRows} 
            selectedIds={selectedTrdIds}
            onToggleRow={() => {}} 
            onToggleAll={() => {}}
            currentUser={currentUser}
            currentEntity={currentEntity}
            logoBase64={entidadLogoBase64}
          />
        </div>
      </div>
    );
  }

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
            currentEntity={userEntities.length > 0 && currentUser?.role !== 'superadmin' ? userEntities[0] : null}
            hasTrdData={(trdRecords || []).length > 0 || (dependencias || []).length > 0 || (series || []).length > 0}
          />
         
         <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
            <MainHeader 
               onLogout={() => { 
                 setAuthView('login'); 
                 setCurrentUser(null); 
                 setSelectedDependencia("TODAS");
                 setSelectedTrdIds(new Set());
                 localStorage.removeItem('ose_user');
               }}
               mainView={mainView}
               onExportPDF={handleExportTRD}
               trdProps={{ 
                 status: "En Progreso", 
                 rows: filteredTrdRows,
                 availableDependencias: uniqueDependencias,
                 selectedDependencia,
                 onSelectDependencia: setSelectedDependencia
               }}
               currentUser={currentUser}
               onNavigate={(v) => { setMainView(v); setActiveModule(v); }}
            />

            <div className="flex-1 overflow-y-auto relative flex">
              {mainView === 'dashboard' && <DashboardView stats={realStats} searchQuery={globalSearchQuery} currentUser={currentUser} seriesCount={(series || []).length} activityLogs={activityLogs} />}
              {mainView === 'entities' && <EntitiesView entities={entities} setEntities={setEntities} />}
              {mainView === 'import' && (
                <TRDImportView 
                  onImportComplete={executeAgentActions} 
                  currentUser={currentUser} 
                  currentEntity={currentEntity} 
                  logoBase64={entidadLogoBase64} 
                  imports={imports}
                  setImports={setImports}
                  addActivityLog={addActivityLog}
                />
              )}
              {mainView === 'rag' && <DocumentcioRAGView currentUser={currentUser} />}
              {mainView === 'users' && <UsersView searchQuery={globalSearchQuery} currentUser={currentUser} users={users} setUsers={setUsers} entities={entities} />}
              {mainView === 'settings' && <SettingsView currentUser={currentUser} onUpdate={handleUpdateUserProfile} />}
              
              {/* TRD Módulo (Layout Anterior embebido) */}
              {mainView === 'trd' && renderLegacyTRDLayout()}
            </div>
         </div>
      </div>
      
      <StatusModal 
        isOpen={modalStatus.isOpen} 
        type={modalStatus.type} 
        message={modalStatus.message} 
        onResolve={() => setModalStatus(prev => ({ ...prev, isOpen: false }))} 
      />
    </div>
    </RAGProvider>
  );
}

export default App;


