import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Header from './components/layout/Header';
import Sidebar from './components/layout/Sidebar';
import AgentChat from './components/chat/AgentChat';
import DependenciaForm from './components/forms/DependenciaForm';
import SerieForm from './components/forms/SerieForm';
import SubserieForm from './components/forms/SubserieForm';
import TRDForm from './components/forms/TRDForm';
import StructuredDataView from './components/data/StructuredDataView';
import TRDGenerator from './components/trd/TRDGenerator';
import { Save, Bot, ArrowLeft, Printer, Download, BrainCircuit, Activity, AlertTriangle, RefreshCw } from 'lucide-react';
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
import InvitationsView from './components/views/InvitationsView';
import HelpCenterView from './components/views/HelpCenterView';
import DocumentcioRAGView from './components/views/DocumentcioRAGView';
import FuncionesView from './components/views/FuncionesView';
import EntrevistasView from './components/views/EntrevistasView';
import GeneradorDocumentalView from './components/views/GeneradorDocumentalView';
import { cn } from './lib/utils';
import API_BASE_URL from './config/api';
import { supabase } from './lib/supabase';
import { RAGProvider } from './contexts/RAGContext';
import { useTRDData } from './hooks/useTRDData';
import ErrorBoundary from './components/ui/ErrorBoundary';
import StatusModal from './components/ui/StatusModal';
import ConflictModal from './components/ui/ConflictModal';
import { LoadingOverlay } from './components/ui/LoadingOverlay';
import { handleExportPDFGeneral } from './utils/exportUtils';
import { exportTRDToExcel } from './utils/excelUtils';
import { normalizeText } from './utils/stringUtils';
import { findDuplicate } from './utils/duplicateUtils';


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
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('ose_user');
    try {
      if (!saved) return null;
      const user = JSON.parse(saved);
      // 🔥 Solo restauramos si tiene un TOKEN válido. Si no, es una sesión fantasma.
      if (user && user.token) {
        return user;
      }
      return null;
    } catch (e) {
      return null;
    }
  }); 
  const [activationToken, setActivationToken] = useState(null);
  const [resetToken, setResetToken] = useState(null);
  const [modalStatus, setModalStatus] = useState({ isOpen: false, type: 'loading', message: '' });
  const [entidadLogoBase64, setEntidadLogoBase64] = useState(null);
  const [selectedEntityId, setSelectedEntityId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('entity');
  });
  const [invitationContext, setInvitationContext] = useState(() => {
    const saved = localStorage.getItem('invitation_context');
    return saved ? JSON.parse(saved) : null;
  });
  const [isSaving, setIsSaving] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // SaaS Context State
  const [mainView, setMainView] = useState(() => {
    const hash = window.location.hash.replace('#/', '');
    if (hash) return hash.split('/')[0];
    return 'dashboard';
  });
  const [activeModule, setActiveModule] = useState(() => {
    const hash = window.location.hash.replace('#/', '');
    if (hash) return hash.split('/')[1] || 'dashboard';
    return 'dashboard';
  });
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [isPrinting, setIsPrinting] = useState(false); // 🔥 Portal de Impresión 🔥
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('ose_sidebar_collapsed') === 'true';
  });
  
  useEffect(() => {
    localStorage.setItem('ose_sidebar_collapsed', isSidebarCollapsed);
  }, [isSidebarCollapsed]);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [pendingInvitationsCount, setPendingInvitationsCount] = useState(0);

  // --- Sistema de Navegación con Historial ---
  useEffect(() => {
    const handlePopState = (e) => {
      // Intentar leer del estado del evento o directamente del hash/search
      const hash = window.location.hash.replace('#/', '');
      const params = new URLSearchParams(window.location.search);
      const entityId = params.get('entity');

      if (entityId) setSelectedEntityId(entityId);

      if (!hash) {
        setMainView('dashboard');
        setActiveModule('dashboard');
        return;
      }

      const [view, module] = hash.split('/');
      if (view) setMainView(view);
      if (module) setActiveModule(module);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Sincronizar URL al cambiar estados
  useEffect(() => {
    if (!currentUser) return;

    const currentHash = `#/${mainView}/${activeModule}`;
    const params = new URLSearchParams(window.location.search);
    
    if (selectedEntityId) params.set('entity', selectedEntityId);
    else params.delete('entity');

    const searchStr = params.toString() ? `?${params.toString()}` : '';
    const newUrl = `${window.location.pathname}${searchStr}${currentHash}`;

    if (window.location.hash !== currentHash || window.location.search !== searchStr) {
      window.history.pushState({ mainView, activeModule, selectedEntityId }, '', newUrl);
    }
  }, [mainView, activeModule, selectedEntityId, currentUser]);



  // Manejar sesión de Google (Supabase OAuth)
  useEffect(() => {
    if (!supabase) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      // Solo actuar si es un evento de login y no tenemos usuario interno
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session && !currentUser) {
        if (session.user.app_metadata.provider === 'google') {
          try {
            setModalStatus({ isOpen: true, type: 'loading', message: 'Sincronizando con Google...' });
            
            const response = await fetch(`${API_BASE_URL}/auth/google`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: session.user.email,
                nombre: session.user.user_metadata.full_name || session.user.user_metadata.name || "Usuario",
                apellido: "",
                uid: session.user.id
              })
            });
            
            if (response.ok) {
              const data = await response.json();
              handleLogin(data, true);
            } else {
              const err = await response.json();
              setModalStatus({ isOpen: true, type: 'error', message: err.detail || 'Error en autenticación Google' });
              await supabase.auth.signOut();
            }
          } catch (e) {
            console.error("Google Auth Error:", e);
            setModalStatus({ isOpen: true, type: 'error', message: 'Error de conexión con el servidor' });
            await supabase.auth.signOut();
          } finally {
            setModalStatus(prev => ({ ...prev, isOpen: false }));
          }
        }
      }
    });

    return () => subscription?.unsubscribe();
  }, [currentUser, supabase]);

  // Global App Data State
  const [entities, setEntities] = useState([]);
  const [users, setUsers] = useState([]);

  const [isInitializing, setIsInitializing] = useState(() => {
    const saved = localStorage.getItem('ose_user');
    if (saved) {
      try {
        const user = JSON.parse(saved);
        return !!(user && user.token);
      } catch (e) {
        return false;
      }
    }
    return false;
  });
  const [hasInitialized, setHasInitialized] = useState(false);
  const [initializationError, setInitializationError] = useState(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [takingLonger, setTakingLonger] = useState(false);

  const [funciones, setFunciones] = useState([]);
  
  // Memoize common headers with context
  const authHeaders = useMemo(() => {
    if (!currentUser?.token) return {};
    const h = { 'Authorization': `Bearer ${currentUser.token}` };
    if (selectedEntityId) h['x-entity-context'] = selectedEntityId;
    return h;
  }, [currentUser?.token, selectedEntityId]);
  useEffect(() => {
    if (!currentUser?.token || !selectedEntityId || !hasInitialized) return;
    const loadFunciones = async () => {
      try {
        const resp = await fetch(
          `${API_BASE_URL}/trd/entity/${selectedEntityId}/funciones`,
          { headers: { 'Authorization': `Bearer ${currentUser.token}` } }
        );
        if (resp.ok) setFunciones(await resp.json());
      } catch (err) {
        console.error("[App] Error cargando funciones:", err);
      }
    };
    loadFunciones();
  }, [currentUser?.token, selectedEntityId, hasInitialized]);



  // 1. Detectar tokens en la URL y manejar redirecciones de invitación
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    
    const actToken = params.get('token');
    if (actToken) {
      setActivationToken(actToken);
      setAuthView('activate');
      setCurrentUser(null);
      localStorage.removeItem('ose_user');
      if (supabase) supabase.auth.signOut().catch(() => {});
    }

    const rstToken = params.get('reset_token');
    if (rstToken) {
      setResetToken(rstToken);
      setAuthView('reset-password');
      setCurrentUser(null);
      localStorage.removeItem('ose_user');
      if (supabase) supabase.auth.signOut().catch(() => {});
    }

    const invId = params.get('invitation_id');
    const invEmail = params.get('email');
    
    if (invId && invEmail) {
      const context = { id: invId, email: invEmail };
      localStorage.setItem('invitation_context', JSON.stringify(context));
      setInvitationContext(context);
      
      const savedUserStr = localStorage.getItem('ose_user');
      let savedUser = null;
      try { if (savedUserStr) savedUser = JSON.parse(savedUserStr); } catch(e){}
      
      if (savedUser && savedUser.token) {
        // Ya logueado, intentar procesar
        if (savedUser.email && savedUser.email.toLowerCase() !== invEmail.toLowerCase()) {
          alert(`La invitación es para ${invEmail}, pero estás conectado como ${savedUser.email}. Por favor cierra sesión y conéctate con la cuenta correcta.`);
        } else {
          // Aceptar automáticamente o navegar a la vista de invitaciones
          setMainView('invitations');
          setAuthView('dashboard');
        }
      } else {
        // No logueado, verificar existencia antes de redirigir
        const checkInvite = async () => {
          try {
            const resp = await fetch(`${API_BASE_URL}/invitations/${invId}/public`);
            if (resp.ok) {
              const details = await resp.json();
              if (details.user_exists) {
                console.log("👋 Usuario existente detectado via invitación. Redirigiendo a Login.");
                setAuthView('login');
                setModalStatus({ 
                  isOpen: true, 
                  type: 'info', 
                  message: 'Ya tienes una cuenta registrada. Por favor inicia sesión para aceptar tu invitación.' 
                });
                setTimeout(() => setModalStatus(prev => ({ ...prev, isOpen: false })), 4000);
              } else {
                console.log("✨ Nuevo usuario detectado via invitación. Redirigiendo a Registro.");
                setAuthView('signup');
              }
            } else {
               setAuthView('signup'); // Fallback
            }
          } catch (e) {
            setAuthView('signup');
          }
        };
        checkInvite();
      }
    }

    // Limpiar URL
    if (actToken || rstToken || (invId && invEmail)) {
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, document.title, cleanUrl);
    }
  }, []);

  // 2. Cargar datos iniciales (Usuarios, Entidades, Invitaciones) de manera secuencial y robusta
  const performInitialLoad = useCallback(async (isRetryCall = false) => {
    if (!currentUser?.token) {
      setIsInitializing(false);
      return;
    }

    if (isRetryCall) {
      setIsRetrying(true);
    } else {
      setIsInitializing(true);
    }
    setInitializationError(null);

    try {
      const headers = { 
        'Authorization': `Bearer ${currentUser.token}`,
        'Content-Type': 'application/json'
      };

      console.log("🚀 [App] [FETCH] Iniciando carga de datos globales...");

      const [usersRes, entitiesRes, invRes] = await Promise.all([
        fetch(`${API_BASE_URL}/users`, { headers }),
        fetch(`${API_BASE_URL}/entities`, { headers }),
        fetch(`${API_BASE_URL}/invitations/my`, { headers })
      ]);

      if (!usersRes.ok || !entitiesRes.ok || !invRes.ok) {
        throw new Error(`Servicios de backend retornaron estado de error: ${usersRes.status}/${entitiesRes.status}/${invRes.status}`);
      }

      const uData = await usersRes.json();
      const eData = await entitiesRes.json();
      const iData = await invRes.json();

      // A. Cargar usuarios
      setUsers(uData);

      // B. Cargar entidades mapeadas
      const mappedEntities = eData.map(e => ({
        ...e,
        id: e.id || e.PK || e.entity_id || "",
        razonSocial: e.razonSocial || e.razon_social || e.nombre || "",
        nombre: e.nombre || e.razonSocial || e.razon_social || "",
        numeroDocumento: e.numeroDocumento || e.nit || e.NIT || "",
        nit: e.nit || e.numeroDocumento || e.NIT || ""
      }));
      setEntities(mappedEntities);

      // C. Cargar contador de invitaciones
      setPendingInvitationsCount(iData.length || 0);

      // D. Determinar Contexto Activo (Entidad Seleccionada)
      const userAvailableEntities = [...mappedEntities].sort((a, b) => {
        if (a.id === 'e0') return -1;
        if (b.id === 'e0') return 1;
        return (a.razonSocial || "").localeCompare(b.razonSocial || "");
      });

      let finalUserEntities = userAvailableEntities;
      if (currentUser.role !== 'superadmin') {
        const rawIds = currentUser.entidadIds?.length > 0
          ? currentUser.entidadIds
          : currentUser.entidadId ? [currentUser.entidadId] : [];
        
        const ids = rawIds.map(id => typeof id === 'string' && id.startsWith("ENTITY#") ? id.replace("ENTITY#", "") : id);
        finalUserEntities = ids.length > 0 ? userAvailableEntities.filter(e => ids.includes(e.id)) : userAvailableEntities;
      }

      console.log("📍 [Context] Entidades disponibles calculadas:", finalUserEntities.length);

      let activeEntityId = null;

      if (finalUserEntities.length > 0) {
        // A. Intentar recuperar del parámetro de la URL
        const params = new URLSearchParams(window.location.search);
        let urlEntity = params.get('entity');
        if (urlEntity && typeof urlEntity === 'string') {
          urlEntity = urlEntity.replace("ENTITY#", "");
        }

        if (urlEntity && finalUserEntities.some(e => e.id === urlEntity)) {
          activeEntityId = urlEntity;
          console.log("📍 [Context] Contexto desde URL válido:", activeEntityId);
        } else {
          // B. Intentar recuperar la última seleccionada de localStorage
          let lastSelected = localStorage.getItem(`ose_last_entity_${currentUser.id}`);
          if (lastSelected && typeof lastSelected === 'string') {
            lastSelected = lastSelected.replace("ENTITY#", "");
          }
          if (lastSelected && finalUserEntities.some(e => e.id === lastSelected)) {
            activeEntityId = lastSelected;
            console.log("📍 [Context] Recuperando última entidad activa:", activeEntityId);
          } else {
            // C. Seleccionar la primera disponible
            activeEntityId = finalUserEntities[0].id;
            console.log("📍 [Context] Auto-seleccionando primera entidad disponible:", activeEntityId);
          }
        }
      }

      if (activeEntityId) {
        setSelectedEntityId(activeEntityId);
      } else {
        console.warn("⚠️ [Context] Usuario sin entidades asociadas!");
      }

      setHasInitialized(true);
      setInitializationError(null);
    } catch (err) {
      console.error("❌ Error en carga inicial:", err);
      setInitializationError(
        err.message?.includes("Failed to fetch") || err.message?.includes("connection")
          ? "No se pudo conectar con el servidor. Verifica que el backend esté activo y responda en la dirección correcta."
          : `Error cargando configuración inicial del sistema: ${err.message || err}`
      );
    } finally {
      setIsInitializing(false);
      setIsRetrying(false);
    }
  }, [currentUser]);

  // Disparar carga inicial
  useEffect(() => {
    if (currentUser?.token) {
      performInitialLoad();
    } else {
      setHasInitialized(false);
      setIsInitializing(false);
      setInitializationError(null);
      setEntities([]);
      setUsers([]);
    }
  }, [currentUser, performInitialLoad]);

  // Timer para avisar si el servidor tarda demasiado (más de 4 segundos)
  useEffect(() => {
    let timer;
    if (isInitializing) {
      setTakingLonger(false);
      timer = setTimeout(() => {
        setTakingLonger(true);
      }, 4000);
    } else {
      setTakingLonger(false);
    }
    return () => clearTimeout(timer);
  }, [isInitializing]);

  // Intervalo de actualización en segundo plano
  useEffect(() => {
    if (!currentUser?.token || !hasInitialized) return;

    const interval = setInterval(() => {
      if (document.visibilityState === 'visible' && !isInitializing) {
        performInitialLoad();
      }
    }, 300000); // Cada 5 minutos

    return () => clearInterval(interval);
  }, [currentUser, hasInitialized, isInitializing, performInitialLoad]);

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
    // El backend ya actualizó la contraseña. Aquí solo confirmamos éxito.
    return { success: true };
  };

  const {
    dependencias, series, subseries, trdRecords,
    setDependencias, setSeries, setSubseries, setTrdRecords,
    addDependencia, deleteDependencia,
    addSerie, deleteSerie,
    addSubserie, deleteSubserie,
    addTrdRecord, deleteTrdRecord,
    isLoading: trdLoading, isSynced,
    refreshData,
    imports, setImports
  } = useTRDData(currentUser, selectedEntityId);

  // UI State
  const handleUpdateUserProfile = async (updatedData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/users/${currentUser.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${currentUser.token}`
        },
        body: JSON.stringify(updatedData)
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'Error al actualizar el perfil');
      }

      // Actualizar en el array global
      const updatedUsers = users.map(u => 
        u.id === currentUser.id ? { ...u, ...updatedData } : u
      );
      setUsers(updatedUsers);
      
      // Actualizar el usuario actual en sesión (manteniendo el token)
      setCurrentUser(prev => ({ ...prev, ...updatedData }));
      
      return { success: true };
    } catch (err) {
      console.error("Error updating profile:", err);
      return { success: false, message: err.message };
    }
  };

  const refreshUserProfile = async () => {
    if (!currentUser?.token) return;
    try {
      const response = await fetch(`${API_BASE_URL}/users/profile`, {
        headers: { 'Authorization': `Bearer ${currentUser.token}` }
      });
      if (response.ok) {
        const freshUser = await response.json();
        const updatedUser = { ...currentUser, ...freshUser };
        setCurrentUser(updatedUser);
        localStorage.setItem('ose_user', JSON.stringify(updatedUser));
        console.log(" [App] Perfil actualizado exitosamente.");
      }
    } catch (err) {
      console.error("Error refreshing profile:", err);
    }
  };

  const [activeFormData, setActiveFormData] = useState({});
  const [formsPersistence, setFormsPersistence] = useState({
    dependencias: {},
    series: {},
    subseries: {},
    trdform: {}
  });

  const [printOrientation, setPrintOrientation] = useState('landscape'); // portrait | landscape — default horizontal
  const [aiQueryResult, setAiQueryResult] = useState(null); // Para mostrar resultados de consultas de Orianna
  const [conflictModal, setConflictModal] = useState({ isOpen: false, info: null });
  const [conflictResolver, setConflictResolver] = useState(null);

  // Auto-persist form data
  useEffect(() => {
    if (['dependencias', 'series', 'subseries', 'trdform'].includes(activeModule)) {
       setFormsPersistence(prev => ({
         ...prev,
         [activeModule]: activeFormData
       }));
    }
  }, [activeFormData, activeModule]);

  // --- CRÍTICO: AISLAMIENTO DE DATOS POR ENTIDAD (FRONTEND) ---
  useEffect(() => {
    if (selectedEntityId) {
      console.log(" [Context] Sincronizando contexto global de entidad:", selectedEntityId);
      
      // 1. RESETEAR el formulario activo si la entidad cambia para evitar entrecruce
      setActiveFormData(prev => {
        if (prev.entidadId && prev.entidadId !== selectedEntityId) {
          console.warn(" [Aislamiento] Cambio de entidad detectado. Limpiando formulario activo.");
          return { entidadId: selectedEntityId }; 
        }
        return { ...prev, entidadId: selectedEntityId };
      });

      // 2. Limpiar la persistencia de formularios que pertenezcan a OTRA entidad
      setFormsPersistence(prev => {
        const next = { ...prev };
        let changed = false;
        ['dependencias', 'series', 'subseries', 'trdform'].forEach(mod => {
          if (next[mod] && next[mod].entidadId && next[mod].entidadId !== selectedEntityId) {
            console.log(` [Aislamiento] Purgando cache persistente de ${mod} (entidad anterior)`);
            delete next[mod];
            changed = true;
          }
        });
        return changed ? next : prev;
      });

      // 3. Resetear el flujo si cambiamos de entidad para evitar estados inconsistentes
      setFlowStep(0);
    }
  }, [selectedEntityId]);

  const [flowStep, setFlowStep] = useState(0);
  const [isAgentOpen, setIsAgentOpen] = useState(window.innerWidth >= 1024);
  const [selectedTrdIds, setSelectedTrdIds] = useState(new Set());
  
  // Chat State (Moved up to avoid ReferenceError in effects)
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [currentOptions, setCurrentOptions] = useState([]);
  
  // Dashboard Stats Logic
  const [ragCount, setRagCount] = useState(0);
  const [tokensUsed, setTokensUsed] = useState(() => parseInt(localStorage.getItem('ose_tokens_used')) || 0);

  const [activityLogs, setActivityLogs] = useState([]);
  const [isRefreshingDashboard, setIsRefreshingDashboard] = useState(false);

  const addActivityLog = useCallback(async (message) => {
    if (!currentUser?.token) return;
    try {
      const response = await fetch(`${API_BASE_URL}/activity-logs`, {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${currentUser.token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ 
          message, 
          user_name: currentUser?.nombre || "Usuario",
          entidad_id: currentUser?.entity_id 
        })
      });
      if (response.ok) {
        // Refrescar lista local
        refreshActivityLogs();
      }
    } catch (e) {
      console.error("Error saving log:", e);
    }
  }, [currentUser]);

  const refreshActivityLogs = useCallback(async () => {
    if (!currentUser?.token) return;
    try {
      const headers = { "Authorization": `Bearer ${currentUser.token}` };
      if (selectedEntityId) {
        headers["x-entity-context"] = selectedEntityId;
      }
      const response = await fetch(`${API_BASE_URL}/activity-logs`, { headers });
      if (response.ok) {
        const data = await response.json();
        const mappedLogs = (data || []).map(log => {
          // Normalización agresiva de fechas para compatibilidad universal
          let ts = log.created_at || log.timestamp || null;
          if (typeof ts === 'string' && ts.includes('+00:00')) {
            ts = ts.replace('+00:00', 'Z');
          }
          
          return {
            ...log,
            id: log.id || `act_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            user: log.user_name || log.user || 'Sistema',
            message: log.message || 'Sin descripción',
            timestamp: ts
          };
        });
        setActivityLogs(mappedLogs);
      }
    } catch (e) {
      console.error("Error fetching logs:", e);
    }
  }, [currentUser, selectedEntityId]);

  // 🔥 PURGA ÚNICA DE CACHÉ / DATOS ANTIGUOS 🔥
  useEffect(() => {
    const hasPurged = localStorage.getItem('ose_data_purged_v3');
    if (!hasPurged) {
      console.warn("🚀 Ejecutando purga de datos antiguos...");
      localStorage.removeItem('entities');
      localStorage.removeItem('users');
      localStorage.removeItem('trd_data');
      localStorage.setItem('ose_data_purged_v3', 'true');
    }
  }, []);

  useEffect(() => {
    if (currentUser && selectedEntityId && hasInitialized) {
      refreshActivityLogs();
    }
  }, [currentUser, selectedEntityId, hasInitialized, refreshActivityLogs]);

  useEffect(() => {
    localStorage.setItem('ose_tokens_used', tokensUsed);
  }, [tokensUsed]);

  const fetchLibraryStats = useCallback(async () => {
    if (!currentUser?.token || !selectedEntityId) return;
    try {
      const ragRes = await fetch(`${API_BASE_URL}/rag-documents?entidad_id=${selectedEntityId}`, {
        headers: { "Authorization": `Bearer ${currentUser.token}` }
      });
      if (ragRes.ok) {
        const data = await ragRes.json();
        setRagCount(data.length);
      }
    } catch (e) { console.error("Error fetching library stats:", e); }
  }, [currentUser, selectedEntityId]);

  const refreshDashboardData = async () => {
    if (isRefreshingDashboard) return;
    setIsRefreshingDashboard(true);
    try {
      // Execute all refreshes in parallel if possible
      await Promise.all([
        refreshData(),           // From useTRDData hook
        refreshActivityLogs(),   // Local activity logs
        fetchLibraryStats()      // Library count
      ]);
    } catch (e) {
      console.error("Error refreshing dashboard:", e);
    } finally {
      // Let the animation play a bit for UX
      setTimeout(() => setIsRefreshingDashboard(false), 500);
    }
  };

  useEffect(() => {
    if (currentUser && selectedEntityId && hasInitialized) {
      fetchLibraryStats();
    }
  }, [currentUser, selectedEntityId, hasInitialized, fetchLibraryStats]);

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
  const [selectedPrintDependencias, setSelectedPrintDependencias] = useState(["TODAS"]);
  

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

  // Recuperar historial de Orianna al cargar (solo si está inicializado)
  useEffect(() => {
    const fetchHistory = async () => {
      if (!currentUser?.token || !selectedEntityId || !hasInitialized) return;
      try {
        const res = await fetch(`${API_BASE_URL}/chat-history/orianna`, {
          headers: { "Authorization": `Bearer ${currentUser.token}` }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.messages && data.messages.length > 0) {
            setMessages(data.messages);
          }
        }
      } catch (e) {
        console.error("Error cargando historial de Orianna:", e);
      }
    };
    fetchHistory();
  }, [currentUser, selectedEntityId, hasInitialized]);

  // Persistir historial de Orianna automáticamente
  useEffect(() => {
    const saveHistory = async () => {
      if (!currentUser?.token || messages.length <= 1) return;
      try {
        await fetch(`${API_BASE_URL}/chat-history/orianna`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${currentUser.token}`
          },
          body: JSON.stringify({ messages })
        });
      } catch (e) {
        console.error("Error guardando historial de Orianna:", e);
      }
    };

    const timer = setTimeout(saveHistory, 1500); // 1.5s debounce
    return () => clearTimeout(timer);
  }, [messages, currentUser]);


  // Unified simulateAgent
  const simulateAgentResponse = (text, options = null) => {
    setIsTyping(true);
    setTimeout(() => {
      const agentId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      setMessages(prev => [...prev, { id: agentId, sender: 'agent', text }]);
      setIsTyping(false);
      if (options) {
        setCurrentOptions(options);
      }
    }, 800 + Math.random() * 500); // slightly faster interactions
  };

  const handleConflictResolution = (decision) => {
    if (conflictResolver) {
      conflictResolver(decision);
      setConflictResolver(null);
    }
    setConflictModal({ isOpen: false, info: null });
  };

  const executeAgentActions = async (actions) => {
    console.log('🤖 Orianna procesando acciones:', actions);
    setModalStatus({ isOpen: true, type: 'loading', message: 'Sincronizando cambios automáticos con la nube...' });
    const idMap = {};
    let actionsProcessed = 0;
    let skippedCount = 0;
    let duplicateAcceptedCount = 0;

    const checkDuplicateAndAsk = async (record, type) => {
      const pool = type === 'dependencias' ? dependencias : 
                   (type === 'series' ? series : 
                   (type === 'subseries' ? subseries : trdRecords));
      
      const existing = findDuplicate(record, pool, type);
      if (existing) {
        console.warn(`⚠️ Posible duplicado detectado para ${type}:`, record);
        setModalStatus(prev => ({ ...prev, isOpen: false }));
        
        return new Promise((resolve) => {
          setConflictModal({ 
            isOpen: true, 
            info: { type, data: record, existing } 
          });
          setConflictResolver(() => (decision) => {
            setModalStatus({ isOpen: true, type: 'loading', message: 'Procesando decisión y continuando...' });
            resolve(decision);
          });
        });
      }
      return 'create';
    };

    const importSessionId = `import_${Date.now()}`;
    setModalStatus({ isOpen: true, type: 'loading', message: 'Iniciando integración de datos...' });

    // 0. Validar Entidad
    if (!selectedEntityId) {
      setModalStatus({ 
        isOpen: true, 
        type: 'error', 
        message: 'No se detectó una entidad activa. Por favor selecciona una entidad antes de importar.' 
      });
      return;
    }

    try {
      for (let i = 0; i < actions.length; i++) {
        const action = actions[i];
        let entity = action.entity?.toLowerCase();
        if (entity === 'dependency') entity = 'dependencias';
        if (entity === 'serie') entity = 'series';
        if (entity === 'subserie') entity = 'subseries';
        if (entity === 'trd_records') entity = 'TRD';

        const entityLabel = entity.charAt(0).toUpperCase() + entity.slice(1);
        const name = action.payload?.nombre || action.payload?.name || "Registro";

        // Feedback de progreso
        setModalStatus(prev => ({ 
          ...prev, 
          message: `Procesando ${i + 1} de ${actions.length}: ${entityLabel} - ${name}...` 
        }));

        if (action.type === 'CREATE') {
          const rawPayload = { ...action.payload };
          
          // --- LOGICA DE AUTO-CREACIÓN DE DEPENDENCIAS/SERIES ---
          if (entity === 'TRD' || entity === 'trd_records' || entity === 'valoracion' || entity === 'series' || entity === 'subseries') {
            
            // 1. Resolver o Crear Dependencia
            let depIdInput = rawPayload.dependenciaId || rawPayload.dependencyId || rawPayload.dependenciaNombre;
            let finalDepId = null;

            if (depIdInput) {
               const targetName = normalizeText(depIdInput);
               // Nota: usamos el pool de dependencias actual. 
               // Si se acaba de crear una, dependencias (del closure) no la tendrá, 
               // pero idMap sí tendrá el ID mapeado.
               const foundDep = dependencias.find(x => x.id === depIdInput || normalizeText(x.nombre) === targetName);
               if (foundDep) {
                 finalDepId = foundDep.id;
               } else if (idMap[depIdInput]) {
                 finalDepId = idMap[depIdInput];
               } else {
                 const newDep = { 
                   entidadId: selectedEntityId, 
                   nombre: depIdInput, 
                   sigla: "GEN", 
                   codigo: rawPayload.dependenciaCodigo || (Math.floor(Math.random() * 900) + 100).toString() 
                 };

                 const decision = await checkDuplicateAndAsk(newDep, 'dependencias');
                 if (decision === 'cancel') throw new Error("IMPORT_CANCELLED");
                 if (decision === 'skip') {
                   const existing = findDuplicate(newDep, dependencias, 'dependencias');
                   finalDepId = existing?.id;
                   skippedCount++;
                 } else {
                   setModalStatus(prev => ({ ...prev, message: `Guardando dependencia en la nube: ${depIdInput}...` }));
                   const strId = Date.now().toString() + "_dep_" + Math.floor(Math.random()*100);
                   idMap[depIdInput] = strId;
                   await addDependencia({ ...newDep, id: strId });
                   addActivityLog(`[${importSessionId}] Auto-creación Dependencia: ${depIdInput}`);
                   finalDepId = strId;
                   if (decision === 'continue') duplicateAcceptedCount++;
                 }
               }
            }

            // 2. Resolver o Crear Serie (si aplica)
            if (entity === 'TRD' || entity === 'trd_records' || entity === 'valoracion' || entity === 'subseries') {
              let serIdInput = rawPayload.serieId || rawPayload.seriesId || rawPayload.serieNombre;
              let finalSerId = null;

               if (serIdInput) {
                 const targetName = normalizeText(serIdInput);
                 const foundSer = series.find(x => x.id === serIdInput || normalizeText(x.nombre) === targetName);
                 if (foundSer) {
                   finalSerId = foundSer.id;
                 } else if (idMap[serIdInput]) {
                   finalSerId = idMap[serIdInput];
                 } else {
                   const newSerie = { 
                     entidadId: selectedEntityId, 
                     dependenciaId: finalDepId, 
                     nombre: serIdInput, 
                     codigo: rawPayload.serieCodigo || (Math.floor(Math.random() * 90) + 10).toString(), 
                     tipoDocumental: rawPayload.tipoDocumental || "Documentos" 
                   };

                   const decision = await checkDuplicateAndAsk(newSerie, 'series');
                   if (decision === 'cancel') throw new Error("IMPORT_CANCELLED");
                   if (decision === 'skip') {
                     const existing = findDuplicate(newSerie, series, 'series');
                     finalSerId = existing?.id;
                     skippedCount++;
                   } else {
                     setModalStatus(prev => ({ ...prev, message: `Guardando serie en la nube: ${serIdInput}...` }));
                     const strId = Date.now().toString() + "_ser_" + Math.floor(Math.random()*100);
                     idMap[serIdInput] = strId;
                     await addSerie({ ...newSerie, id: strId });
                     addActivityLog(`[${importSessionId}] Auto-creación Serie: ${serIdInput}`);
                     finalSerId = strId;
                     if (decision === 'continue') duplicateAcceptedCount++;
                   }
                 }
              }
              rawPayload.dependenciaId = finalDepId;
              rawPayload.serieId = finalSerId;

              // 3. Resolver o Crear Subserie (si aplica para TRD/Valoración)
              if (entity === 'TRD' || entity === 'trd_records' || entity === 'valoracion') {
                let subIdInput = rawPayload.subserieId || rawPayload.subserieNombre;
                if (subIdInput) {
                  const targetName = normalizeText(subIdInput);
                  const foundSub = subseries.find(x => x.id === subIdInput || normalizeText(x.nombre) === targetName);
                  if (foundSub) {
                    rawPayload.subserieId = foundSub.id;
                  } else if (idMap[subIdInput]) {
                    rawPayload.subserieId = idMap[subIdInput];
                  } else {
                    const newSub = {
                      entidadId: selectedEntityId,
                      dependenciaId: finalDepId,
                      serieId: finalSerId,
                      nombre: subIdInput,
                      codigo: rawPayload.subserieCodigo || (Math.floor(Math.random() * 90) + 10).toString(),
                      tipoDocumental: rawPayload.tipoDocumental || "Documentos"
                    };

                    const decision = await checkDuplicateAndAsk(newSub, 'subseries');
                    if (decision === 'cancel') throw new Error("IMPORT_CANCELLED");
                    if (decision === 'skip') {
                      const existing = findDuplicate(newSub, subseries, 'subseries');
                      rawPayload.subserieId = existing?.id;
                      skippedCount++;
                    } else {
                      setModalStatus(prev => ({ ...prev, message: `Guardando subserie en la nube: ${subIdInput}...` }));
                      const strId = Date.now().toString() + "_sub_" + Math.floor(Math.random()*100);
                      idMap[subIdInput] = strId;
                      await addSubserie({ ...newSub, id: strId });
                      addActivityLog(`[${importSessionId}] Auto-creación Subserie: ${subIdInput}`);
                      rawPayload.subserieId = strId;
                      if (decision === 'continue') duplicateAcceptedCount++;
                    }
                  }
                }
              }
            } else {
              rawPayload.dependenciaId = finalDepId;
            }
          }

          // --- PERSISTENCIA FINAL DEL REGISTRO ---
          const finalId = action.id && !action.id.startsWith('temp_') ? action.id : (Date.now().toString() + "_" + Math.floor(Math.random()*1000));
          if (action.id) idMap[action.id] = finalId;

          const payload = {
              entidadId: selectedEntityId,
              nombre: name,
              codigo: rawPayload.codigo || (Math.floor(Math.random() * 900) + 100).toString(),
              sigla: rawPayload.sigla || "GEN",
              dependenciaId: rawPayload.dependenciaId,
              serieId: rawPayload.serieId,
              subserieId: rawPayload.subserieId,
              tipoDocumental: rawPayload.tipoDocumental || "Documentos generales",
              retencionGestion: parseInt(rawPayload.retencionGestion) || 2,
              retencionCentral: parseInt(rawPayload.retencionCentral) || 10,
              disposicion: rawPayload.disposicion || "CT",
              procedimiento: rawPayload.procedimiento || "Conservación total según norma.",
              "disp_Conservación total": rawPayload.disposicion === 'CT' || rawPayload.disposicion?.includes('CT'),
              "disp_Eliminación": rawPayload.disposicion === 'E' || rawPayload.disposicion?.includes('E'),
              "disp_Selección": rawPayload.disposicion === 'S' || rawPayload.disposicion?.includes('S'),
              "disp_Medio Técnico": rawPayload.disposicion === 'MT' || rawPayload.disposicion?.includes('MT'),
          };

          if (entity === 'TRD' || entity === 'trd_records' || entity === 'valoracion') {
             const decision = await checkDuplicateAndAsk(payload, 'TRD');
             if (decision === 'cancel') throw new Error("IMPORT_CANCELLED");
             if (decision === 'skip') {
               skippedCount++;
               continue;
             }
             setModalStatus(prev => ({ ...prev, message: `Guardando valoración TRD: ${name}...` }));
             await addTrdRecord({ ...payload, id: finalId });
             if (decision === 'continue') duplicateAcceptedCount++;
          } else if (entity === 'dependencias') {
             await addDependencia({ ...payload, id: finalId });
          } else if (entity === 'series') {
             await addSerie({ ...payload, id: finalId });
          } else if (entity === 'subseries') {
             await addSubserie({ ...payload, id: finalId });
          }
          
          addActivityLog(`[${importSessionId}] Integrado ${entityLabel}: ${name}`);
          actionsProcessed++;
        } 
        else if (action.type === 'UPDATE') {
          addActivityLog(`[${importSessionId}] Edición ${entityLabel} - ${name}`);
          const entityId = idMap[action.id] || action.id;
          const pool = entity === 'dependencias' ? dependencias : (entity === 'series' ? series : (entity === 'subseries' ? subseries : trdRecords));
          const existing = pool.find(x => x.id === entityId);
          if (existing) {
             const updated = { ...existing, ...action.payload };
             if (entity === 'dependencias') await addDependencia(updated);
             else if (entity === 'series') await addSerie(updated);
             else if (entity === 'subseries') await addSubserie(updated);
             else if (entity === 'TRD' || entity === 'trd_records') await addTrdRecord(updated);
             actionsProcessed++;
          }
        }
        else if (action.type === 'DELETE') {
          addActivityLog(`[${importSessionId}] Eliminación ${entityLabel} - ID ${action.id}`);
          if (entity === 'dependencias') await deleteDependencia(action.id);
          else if (entity === 'series') await deleteSerie(action.id);
          else if (entity === 'subseries') await deleteSubserie(action.id);
          else if (entity === 'TRD' || entity === 'trd_records') await deleteTrdRecord(action.id);
          actionsProcessed++;
        }
      }

      // --- VALIDACIÓN FINAL Y REFRESCAMIENTO ---
      if (actionsProcessed > 0) {
        setModalStatus({ isOpen: true, type: 'loading', message: 'Validando Datos Estructurados y reconstruyendo Tabla Final...' });
        
        // Esperamos un momento para que la DB se estabilice y refrescamos
        await new Promise(r => setTimeout(r, 1000));
        await refreshData();
        
        setModalStatus({ 
          isOpen: true, 
          type: 'success', 
          message: `¡Importación completada correctamente!\n\n- Registros procesados: ${actionsProcessed}\n- Duplicados omitidos: ${skippedCount}\n- Cambios aceptados: ${duplicateAcceptedCount}\n\nLos datos ya están disponibles en Datos Estructurados y Tabla Final.` 
        });
      } else if (skippedCount > 0) {
        setModalStatus({ 
          isOpen: true, 
          type: 'success', 
          message: `Sincronización finalizada.\nNo se crearon nuevos registros porque ya existían en la entidad (Omitidos: ${skippedCount}).` 
        });
      } else {
        setModalStatus({ isOpen: false, type: 'loading', message: '' });
      }
    } catch (error) {
      addActivityLog(`[${importSessionId}] Error: ${error.message}`);
      if (error.message === "IMPORT_CANCELLED") {
        setModalStatus({ isOpen: true, type: 'error', message: 'Importación cancelada por el usuario debido a duplicados detectados.' });
      } else {
        console.error('Error procesando acciones:', error);
        let failStep = "la integración de datos";
        if (error.message.includes("dependencia")) failStep = "el guardado de la dependencia";
        if (error.message.includes("serie")) failStep = "el guardado de las series";
        if (error.message.includes("TRD")) failStep = "el guardado de la valoración TRD";
        
        setModalStatus({ 
          isOpen: true, 
          type: 'error', 
          message: `La importación falló: no se pudo completar ${failStep}.\nDetalle: ${error.message}` 
        });
      }
    }
  };

  const handleUserMessage = (text) => {
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const userMsg = { id: requestId, sender: 'user', text: text };
    setMessages(prev => [...prev, userMsg]);
    setCurrentOptions([]);
    
    if (['dependencias', 'series', 'subseries', 'datos', 'trd', 'orgchart', 'trdform'].includes(activeModule)) {
       simulateAgentResponse("Analizando solicitud y preparando sincronización...");
       
       const context = { dependencias, series, subseries, trdRecords, entidades: userEntities };
       const history = messages.map(m => ({ role: m.sender === 'user' ? 'user' : 'agent', content: m.text }));
       
       fetch(`${API_BASE_URL}/agent-action`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${currentUser?.token}` 
          },
          body: JSON.stringify({ prompt: text, context, history })
       })
       .then(res => res.json())
       .then(async data => {
          // Si es una consulta (QUERY), mostramos el panel de resultados
          if (data.intent === 'QUERY') {
            setAiQueryResult({
              title: "Resultado de Consulta Orianna",
              content: data.message,
              data: data.data || []
            });
            setActiveModule('ai-result');
            simulateAgentResponse(data.message || "He preparado la información que solicitaste en el panel central.");
            return;
          }

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
       .catch((err) => {
          console.error("Error en Orianna:", err);
          simulateAgentResponse("Error de conexión con el motor de IA.");
       });
       
       return; 
    }

    let cleaned = text.trim();
    cleaned = cleaned.replace(/^(creo que\s*)?(el nombre de la dependencia es|la (nueva )?dependencia se llama|la dependencia es|el nombre es|es|mi|se llama|quiero que se llame|llamada)\s+/gi, '').trim();
    if (cleaned.length > 0) cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);

    if (activeField) {
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
    if (isSaving) return;
    
    // --- VALIDATION LOGIC ---
    const errors = {};
    const data = activeFormData;
    
    if (activeModule === 'dependencias') {
      if (!data.entidadId) errors.entidadId = "La entidad es obligatoria.";
      if (!data.nombre?.trim()) errors.nombre = "El nombre es obligatorio.";
      if (!data.codigo?.trim()) errors.codigo = "El código es obligatorio.";
      if (!data.pais?.trim()) errors.pais = "El país es obligatorio.";
      if (!data.direccion?.trim()) errors.direccion = "La dirección es obligatoria.";
      
      if (data.pais === "Colombia") {
        if (!data.departamento?.trim()) errors.departamento = "Selecciona un departamento.";
        if (!data.ciudad?.trim()) errors.ciudad = "Escribe la ciudad.";
      }
    } else if (activeModule === 'series') {
      if (!data.entidadId) errors.entidadId = "La entidad es obligatoria.";
      if (!data.nombre?.trim()) errors.nombre = "El nombre de la serie es obligatorio.";
      if (!data.codigo?.trim()) errors.codigo = "El código es obligatorio.";
    } else if (activeModule === 'subseries') {
      if (!data.entidadId) errors.entidadId = "La entidad es obligatoria.";
      if (!data.nombre?.trim()) errors.nombre = "El nombre de la subserie es obligatorio.";
      if (!data.codigo?.trim()) errors.codigo = "El código es obligatorio.";
    } else if (activeModule === 'trdform') {
      if (!data.entidadId) errors.entidadId = "La entidad es obligatoria.";
      if (!data.dependenciaId) errors.dependenciaId = "La dependencia es obligatoria.";
      if (!data.serieId) errors.serieId = "La serie es obligatoria.";
      if (!data.estadoConservacion) errors.estadoConservacion = "El estado de conservación es obligatorio.";
      if (!data.retencionGestion) errors.retencionGestion = "La retención en gestión es obligatoria.";
      if (!data.retencionCentral) errors.retencionCentral = "La retención central es obligatoria.";
      if (!data.ddhh) errors.ddhh = "Este campo es obligatorio.";
      if (!data.procedimiento?.trim()) errors.procedimiento = "El procedimiento es obligatorio.";
      if (!data.actoAdmo?.trim()) errors.actoAdmo = "El acto administrativo es obligatorio.";
      
      // Validar Tipos Documentales
      if (data.tiposDocumentales?.some(t => !t.titulo_documento?.trim())) {
        errors.tiposDocumentales = "Todos los tipos documentales deben tener un título.";
      }
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      const fieldList = Object.values(errors).join(" ");
      setModalStatus({ 
        isOpen: true, 
        type: 'error', 
        message: `Faltan campos obligatorios: ${fieldList}` 
      });
      return;
    }

    setFormErrors({});
    setIsSaving(true);
    setModalStatus({ isOpen: true, type: 'loading', message: 'Verificando datos y guardando en base de datos...' });
    
    const isUpdate = !!activeFormData.id;
    const record = activeFormData;

    // --- CHECK FOR DUPLICATES (Manual Entry & Edit) ---
    const poolMap = {
      'dependencias': dependencias,
      'series': series,
      'subseries': subseries,
      'trdform': trdRecords
    };
    const pool = poolMap[activeModule];
    const existing = findDuplicate(record, pool, activeModule);
    
    if (existing) {
      setIsSaving(false);
      let errorMsg = 'Este registro ya existe en la entidad actual. Por favor verifica los datos.';
      if (activeModule === 'dependencias') {
        errorMsg = 'Ya existe una dependencia con este código en la entidad actual.';
      } else if (activeModule === 'series') {
        errorMsg = 'Ya existe una serie con este código en esta dependencia.';
      } else if (activeModule === 'subseries') {
        errorMsg = 'Ya existe una subserie con este código en esta serie y dependencia.';
      }
      
      setModalStatus({ 
        isOpen: true, 
        type: 'error', 
        message: errorMsg
      });
      return;
    }

    try {
      let savedRecord;
      if (activeModule === 'dependencias') savedRecord = await addDependencia(record);
      else if (activeModule === 'series') savedRecord = await addSerie(record);
      else if (activeModule === 'subseries') savedRecord = await addSubserie(record);
      else if (activeModule === 'trdform') savedRecord = await addTrdRecord(record);

      const entityMap = {
        'dependencias': 'Dependencia',
        'series': 'Serie',
        'subseries': 'Subserie',
        'trdform': 'TRD'
      };
      const entityLabel = entityMap[activeModule] || 'Registro';
      const actionLabel = isUpdate ? 'Edición' : 'Creación';
      
      addActivityLog(`${actionLabel} ${entityLabel} - ${record.nombre || record.id || 'Nuevo'}`);
      
      // Limpiar persistencia de este módulo al guardar con éxito
      setFormsPersistence(prev => ({ ...prev, [activeModule]: {} }));
      
      setActiveFormData({});
      setFlowStep(0);
      
      // La verificación ya ocurre dentro del hook (await refreshData)
      setModalStatus({ 
        isOpen: true, 
        type: 'success', 
        message: `¡${entityLabel} guardada correctamente! La base de datos ha sido actualizada.` 
      });
    } catch (err) {
      console.error("Error en handleSave:", err);
      setModalStatus({ 
        isOpen: true, 
        type: 'error', 
        message: `No se pudo guardar: ${err.message || 'Error de conexión'}` 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (moduleType, record) => {
    setActiveModule(moduleType);
    setActiveFormData(record);
    setFlowStep(0);
  };

  const handleDelete = async (moduleType, recordId) => {
    // Confirmación de seguridad para HARD DELETE
    const confirmMsg = moduleType === 'dependencias' 
      ? "¿Estás seguro? Se eliminarán también todas las SERIES, SUBSERIES y VALORACIONES vinculadas a esta dependencia. Esta acción NO se puede deshacer."
      : "¿Estás seguro de eliminar este registro? Esta acción es permanente y afectará los reportes vinculados.";
    
    if (!window.confirm(confirmMsg)) return;

    setModalStatus({ isOpen: true, type: 'loading', message: 'Ejecutando eliminación permanente en la base de datos...' });
    try {
      if (moduleType === 'trdform') {
        const trdToDel = trdRecords.find(t => t.id === recordId);
        await deleteTrdRecord(recordId);
        addActivityLog(`Borrado TRD - ${trdToDel?.nombre || recordId}`);
      } else if (moduleType === 'dependencias') {
        const dep = dependencias.find(d => d.id === recordId);
        await deleteDependencia(recordId);
        addActivityLog(`BORRADO TOTAL Dependencia (Cascada) - ${dep?.nombre || recordId}`);
      } else if (moduleType === 'series') {
        const ser = series.find(s => s.id === recordId);
        await deleteSerie(recordId);
        addActivityLog(`BORRADO TOTAL Serie (Cascada) - ${ser?.nombre || recordId}`);
      } else if (moduleType === 'subseries') {
        const sub = subseries.find(s => s.id === recordId);
        await deleteSubserie(recordId);
        addActivityLog(`BORRADO TOTAL Subserie (Cascada) - ${sub?.nombre || recordId}`);
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
  // Calculate TRD Rows globally with grouping to avoid duplicates
  const trdRows = React.useMemo(() => {
    const rawList = trdRecords || [];
    // Grouping by unique combination of Dependency + Serie + Subserie
    const grouped = rawList.reduce((acc, record) => {
      const key = `${record.dependenciaId}-${record.serieId}-${record.subserieId || 'none'}`;
      // Keep the most recent record if multiple exist for the same key
      if (!acc[key] || new Date(record.createdAt || 0) > new Date(acc[key].createdAt || 0)) {
        acc[key] = record;
      }
      return acc;
    }, {});

    const compareCodes = (a, b) => {
      const codeA = String(a || "").replace(/\s+/g, "");
      const codeB = String(b || "").replace(/\s+/g, "");
      const numA = parseFloat(codeA);
      const numB = parseFloat(codeB);
      const isNumA = !isNaN(numA) && isFinite(numA);
      const isNumB = !isNaN(numB) && isFinite(numB);
      if (isNumA && isNumB) {
        if (numA !== numB) return numA - numB;
        return codeA.localeCompare(codeB, undefined, { numeric: true });
      }
      if (isNumA) return -1;
      if (isNumB) return 1;
      return codeA.localeCompare(codeB, undefined, { numeric: true });
    };

    const mapped = Object.values(grouped).map(record => {
      const dep = (dependencias || []).find(d => String(d.id) === String(record.dependenciaId)) || {};
      const serie = (series || []).find(s => String(s.id) === String(record.serieId)) || {};
      const subserie = record.subserieId ? (subseries || []).find(s => String(s.id) === String(record.subserieId)) : null;

      let disposicionStr = [];
      if (record['disp_Conservación total']) disposicionStr.push("CT");
      if (record['disp_Eliminación']) disposicionStr.push("E");
      if (record['disp_Selección']) disposicionStr.push("S");

      const fullCodigo = [dep.codigo, serie.codigo, subserie?.codigo].filter(Boolean).join("-");

      return {
        id: record.id,
        dependenciaId: record.dependenciaId,
        serieId: record.serieId,
        subserieId: record.subserieId,
        dependencia: dep.nombre || "(Desconocida)",
        codigo: fullCodigo,
        serie: serie.nombre || "(Sin Serie)",
        subserie: subserie ? subserie.nombre : "",
        tipoDocumental: subserie ? subserie.tipoDocumental : serie.tipoDocumental || "",
        retencionGestion: record.retencionGestion || "0",
        retencionCentral: record.retencionCentral || "0",
        disposicion: disposicionStr.join(", ") || record.disposicion || "N/A",
        procedimiento: record.procedimiento || "",
        soporte: record.rep_digitalizacion || record.rep_microfilmacion ? 'ambos' : 'fisico',
        reproduccion: record.rep_digitalizacion ? 'Digitalización' : (record.rep_microfilmacion ? 'Microfilmación' : 'Ninguna'),
        tiposDocumentales: record.tiposDocumentales || [],
        funcionesIds: record.funcionesIds || []
      };
    });

    // Sort hierarchically: Dependencia -> Serie -> Subserie
    return [...mapped].sort((a, b) => {
      const depA = (dependencias || []).find(d => String(d.id) === String(a.dependenciaId));
      const depB = (dependencias || []).find(d => String(d.id) === String(b.dependenciaId));
      if (depA && depB && depA.id !== depB.id) {
        return compareCodes(depA.codigo, depB.codigo);
      }

      const serA = (series || []).find(s => String(s.id) === String(a.serieId));
      const serB = (series || []).find(s => String(s.id) === String(b.serieId));
      if (serA && serB && serA.id !== serB.id) {
        return compareCodes(serA.codigo, serB.codigo);
      }

      const subA = a.subserieId ? (subseries || []).find(s => String(s.id) === String(a.subserieId)) : null;
      const subB = b.subserieId ? (subseries || []).find(s => String(s.id) === String(b.subserieId)) : null;

      if (!subA && subB) return -1;
      if (subA && !subB) return 1;
      if (!subA && !subB) return 0;

      return compareCodes(subA.codigo, subB.codigo);
    });
  }, [trdRecords, dependencias, series, subseries]);

  // Filtered rows for UI and PDF
  const filteredTrdRows = React.useMemo(() => {
    if (!trdRows) return [];
    if (selectedPrintDependencias.includes("TODAS") || selectedPrintDependencias.length === 0) {
      return trdRows;
    }
    const normalizedTargets = selectedPrintDependencias.map(d => normalizeText(d));
    return trdRows.filter(r => normalizedTargets.includes(normalizeText(r.dependencia)));
  }, [trdRows, selectedPrintDependencias]);

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

  const handleLogin = (data, rememberMe) => {
    // El backend de AWS devuelve { "user": {...}, "access_token": "..." }
    // Debemos extraer el objeto 'user' real
    const user = data.user || data; 
    
    // Normalizar entidades anidadas si existen para soporte consistente de camelCase
    const normalizedUser = {
      ...user,
      entities: (user.entities || []).map(e => ({
        ...e,
        razonSocial: e.razonSocial || e.razon_social || e.nombre || ""
      }))
    };
    
    normalizedUser.token = data.access_token || data.id_token || data.token;

    setCurrentUser(normalizedUser);
    
    // 🔥 Corregir el ID "None" que viene de DynamoDB
    let entityFromUser = user.entidadId || user.entity_id || user.entidadIds?.[0] || null;
    if (entityFromUser === "None" || entityFromUser === "null") entityFromUser = null;

    if (!selectedEntityId) {
      if (entityFromUser) {
        setSelectedEntityId(entityFromUser);
      } else if (user.role === 'superadmin') {
        // superadmin: forzamos OSE Sistema Global (e0) como principal por defecto
        setSelectedEntityId('e0');
      }
    }
    
    // Siempre guardamos en localStorage para persistencia en refrescos
    localStorage.setItem('ose_user', JSON.stringify(normalizedUser));
    
    // Marcar de forma persistente que este navegador ya tiene un usuario registrado
    // Esto evita que las invitaciones vuelvan a abrir el formulario de "Crear Cuenta" en el futuro
    localStorage.setItem('ose_has_account', 'true');

    if (invitationContext) {
      if (normalizedUser.email && normalizedUser.email.toLowerCase() !== invitationContext.email.toLowerCase()) {
        alert(`La invitación es para ${invitationContext.email}, pero te conectaste como ${normalizedUser.email}. No se puede aceptar la invitación.`);
      } else {
        // Auto-aceptar la invitación pendiente
        fetch(`${API_BASE_URL}/invitations/${invitationContext.id}/respond`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${normalizedUser.token}` },
            body: JSON.stringify({ action: 'accept' })
        }).then(res => {
            if (res.ok) {
              alert("¡Invitación aceptada exitosamente! Tu cuenta ha sido enlazada a la nueva entidad.");
              refreshUserProfile();
            } else {
              res.json().then(data => {
                let msg = data.detail || 'Desconocido';
                if (msg === 'Invalid authentication token') {
                    msg = 'El enlace de invitación no es válido o tu sesión ha expirado. Por favor, solicita uno nuevo o vuelve a iniciar sesión.';
                } else if (msg.includes('ya ha sido aceptada') || msg.includes('ya ha sido') || msg.includes('no es para ti')) {
                    msg = 'El enlace no es válido, ya fue utilizado, o no corresponde a tu cuenta.';
                }
                alert(`Error al aceptar la invitación: ${msg}`);
              });
            }
        }).catch(err => {
            console.error("Error accepting invitation:", err);
            alert("Error de conexión al procesar la invitación.");
        });
      }
      localStorage.removeItem('invitation_context');
      setInvitationContext(null);
    }
    setMainView('dashboard');
    
    // Limpiar otros estados de flujo para asegurar que no vuelvan a aparecer al desloguear
    setActivationToken(null);
    setResetToken(null);
  };
  
  const handleLogout = async () => {
    // Limpiar tokens locales
    setCurrentUser(null);
    setAuthView('login');
    setMainView('dashboard');
    setInvitationContext(null);
    setActivationToken(null);
    setResetToken(null);
    setSelectedDependencia("TODAS");
    setSelectedTrdIds(new Set());
    localStorage.removeItem('ose_user');
    localStorage.removeItem('invitation_context');
    if (supabase) await supabase.auth.signOut();
    
    // Limpiar URL
    window.history.replaceState(null, '', window.location.pathname);
  };

  // Restore session logic removed - now handled by initial state in useState

  // Determine which entities the current user can see/select
  const userEntities = React.useMemo(() => {
    if (!currentUser) return entities;
    let available = entities;
    if (currentUser.role !== 'superadmin') {
      const rawIds = currentUser.entidadIds?.length > 0
        ? currentUser.entidadIds
        : currentUser.entidadId ? [currentUser.entidadId] : [];
      
      const ids = rawIds.map(id => typeof id === 'string' && id.startsWith("ENTITY#") ? id.replace("ENTITY#", "") : id);
      available = ids.length > 0 ? entities.filter(e => ids.includes(e.id)) : entities;
    }
    
    // Sort to ensure "OSE Sistema Global" (e0) is always first, then alphabetical
    return [...available].sort((a, b) => {
      if (a.id === 'e0') return -1;
      if (b.id === 'e0') return 1;
      return (a.razonSocial || "").localeCompare(b.razonSocial || "");
    });
  }, [currentUser, entities]);

  console.log(" [App] userEntities:", userEntities.length, "Selected:", selectedEntityId);

  const currentEntity = entities.find(e => e.id === selectedEntityId) || 
                        (currentUser?.role === 'superadmin' ? entities.find(e => e.id === 'e0' || e.razonSocial === 'OSE Sistema Global') : null) || 
                        userEntities?.[0] ||
                        (currentUser?.entidadId ? { id: currentUser.entidadId.toString().replace("ENTITY#", ""), razonSocial: 'Cargando...' } : null);

  // --- AUTO-SELECCIÓN DE ENTIDAD AL INICIAR SESIÓN / CARGAR ---
  useEffect(() => {
    if (hasInitialized && currentUser && !selectedEntityId && userEntities.length > 0) {
      // 1. Intentar recuperar la última seleccionada de localStorage
      let lastSelected = localStorage.getItem(`ose_last_entity_${currentUser.id}`);
      if (lastSelected && typeof lastSelected === 'string') {
        lastSelected = lastSelected.replace("ENTITY#", "");
      }
      if (lastSelected && userEntities.some(e => e.id === lastSelected)) {
        console.log("📍 [Context] Recuperando última entidad activa:", lastSelected);
        setSelectedEntityId(lastSelected);
      } else {
        // 2. Si no hay última, seleccionar la primera disponible
        console.log("📍 [Context] Auto-seleccionando primera entidad disponible:", userEntities[0].id);
        setSelectedEntityId(userEntities[0].id);
      }
    }
  }, [hasInitialized, currentUser, selectedEntityId, userEntities]);

  // Persistir la selección de entidad
  useEffect(() => {
    if (currentUser && selectedEntityId) {
      localStorage.setItem(`ose_last_entity_${currentUser.id}`, selectedEntityId);
    }
  }, [currentUser, selectedEntityId]);

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

  const handleExportTRD = (dependencyName) => {
    // Si se pasa un nombre específico, lo fijamos. Si no, usamos el actual.
    // Verificamos que sea un string y no un evento de React Synthetic Event
    const isValidName = typeof dependencyName === 'string' && dependencyName !== "TODAS";
    const target = isValidName ? dependencyName : selectedDependencia;
    
    if (typeof target === 'string' && target !== "TODAS") {
       setSelectedDependencia(target);
    }
    
    // 🔥 CRÍTICO: Limpiamos selecciones individuales para que la previsualización 
    // muestre TODA la oficina por defecto, evitando tablas vacías por IDs huérfanos.
    setSelectedTrdIds(new Set());
    
    setIsPrinting(true);
  };

  // Auto pre-select entity when navigating to a form module if user has at least one entity
  const handleNavigation = (moduleId) => {
    setActiveModule(moduleId);
    setFormErrors({});
    
    // Si tenemos data persistida para este módulo (escrita por el usuario antes), la recuperamos
    const persisted = formsPersistence[moduleId];
    if (persisted && Object.keys(persisted).length > 0) {
      console.log(`♻️ Recuperando formulario persistido para ${moduleId}`);
      setActiveFormData(persisted);
    } else {
      const activeEntity = selectedEntityId || userEntities?.[0]?.id;
      if (activeEntity) {
        console.log("📍 Auto-seleccionando entidad para formulario:", activeEntity);
        autoData.entidadId = activeEntity;
      }
      if (moduleId === 'dependencias') {
        autoData.pais = "Colombia";
      }
      setActiveFormData(autoData);
    }
    setFlowStep(0);
    setFormErrors({});
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
            initialEmail={invitationContext?.email}
          />
        )}
        {authView === 'signup' && (
          <SignUp 
            onSignUp={(userData) => handleLogin(userData, true)} 
            onNavigateToLogin={() => setAuthView('login')} 
            initialEmail={invitationContext?.email}
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
            onIssueToken={() => setAuthView('reset-password')}
          />
        )}
        {authView === 'reset-password' && (
          <ResetPassword 
            initialEmail={currentUser?.email || ""}
            onReset={handleResetPassword} 
            onNavigateToLogin={() => setAuthView('login')} 
          />
        )}
      </div>
    );
  }

  // Loading Overlay - Premium Startup Screen
  if (currentUser && isInitializing) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Decorative ambient blobs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[100px] animate-pulse pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#09C8A2]/10 rounded-full blur-[100px] animate-pulse pointer-events-none" />
        
        {/* Premium Glassmorphic container */}
        <div className="relative bg-white/[0.03] border border-white/10 backdrop-blur-xl p-10 rounded-[2.5rem] max-w-md w-full shadow-2xl flex flex-col items-center gap-6 animate-in zoom-in-95 duration-500">
          <div className="relative">
            <div className="absolute inset-0 rounded-full border border-primary/20 animate-ping" />
            <div className="h-16 w-16 bg-primary/10 text-primary rounded-2xl flex items-center justify-center border border-primary/20 shadow-inner">
              <BrainCircuit className="h-8 w-8 animate-pulse text-[#09C8A2]" />
            </div>
          </div>
          
          <div className="text-center space-y-2">
            <h3 className="text-lg font-black text-white uppercase tracking-wider animate-pulse">OSE Inteligencia Artificial</h3>
            <p className="text-[12px] text-slate-400 font-medium tracking-wide">
              {takingLonger ? "Seguimos intentando conectar con el servidor..." : "Cargando datos del sistema..."}
            </p>
          </div>

          {/* Elegant progress indicator */}
          <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden border border-white/5 relative">
            <div className="bg-gradient-to-r from-primary to-[#09C8A2] h-full rounded-full animate-infinite-loading absolute inset-y-0 w-2/3" />
          </div>
          
          <div className="flex items-center gap-2 text-[10px] font-semibold text-slate-500 uppercase tracking-widest mt-2">
            <RefreshCw className="h-3 w-3 animate-spin text-[#09C8A2]" /> Conectando API
          </div>
        </div>
      </div>
    );
  }

  // Robust Error Screen - Premium Connection Failure Modal
  if (currentUser && initializationError) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Decorative ambient blobs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-rose-500/5 rounded-full blur-[100px] animate-pulse pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[100px] animate-pulse pointer-events-none" />
        
        {/* Premium Glassmorphic container */}
        <div className="relative bg-white/[0.03] border border-white/10 backdrop-blur-xl p-10 rounded-[2.5rem] max-w-md w-full shadow-2xl flex flex-col items-center gap-6 animate-in zoom-in-95 duration-500">
          <div className="h-16 w-16 bg-rose-500/10 text-rose-500 rounded-2xl flex items-center justify-center border border-rose-500/20 shadow-inner">
            <AlertTriangle className="h-8 w-8 text-rose-500" />
          </div>
          
          <div className="text-center space-y-2">
            <h3 className="text-lg font-black text-white uppercase tracking-wider">Error de Conexión</h3>
            <p className="text-sm text-slate-300 font-medium leading-relaxed">
              {initializationError}
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 w-full">
            <p className="text-[11px] text-slate-400 font-semibold leading-relaxed">
              💡 Asegúrate de que el servidor backend esté corriendo en la dirección configurada en el archivo de variables de entorno (<code className="text-primary font-mono bg-white/5 px-1.5 py-0.5 rounded">.env</code>).
            </p>
          </div>

          <div className="flex gap-4 w-full mt-2">
            <button
              onClick={handleLogout}
              className="flex-1 py-3.5 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 text-[11px] font-black uppercase tracking-wider rounded-2xl transition-all active:scale-95"
            >
              Cerrar Sesión
            </button>
            <button
              onClick={() => performInitialLoad(true)}
              disabled={isRetrying}
              className="flex-1 py-3.5 bg-gradient-to-r from-[#09C8A2] to-primary hover:opacity-95 text-white text-[11px] font-black uppercase tracking-wider rounded-2xl shadow-xl shadow-[#09C8A2]/10 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isRetrying ? (
                <>
                  <RefreshCw className="h-3 w-3 animate-spin" /> Intentando...
                </>
              ) : (
                "Reintentar"
              )}
            </button>
          </div>
        </div>
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
    <div className="flex flex-col lg:flex-row flex-1 overflow-hidden w-full h-full bg-background lg:rounded-l-2xl border-l border-y shadow-inner">
      {/* Navigation Sidebar */}
      <Sidebar 
        activeModule={activeModule} 
        onNavigate={handleNavigation} 
        isAgentOpen={isAgentOpen}
        onToggleAgent={() => setIsAgentOpen(v => !v)}
        currentUser={currentUser}
        hasTrdData={trdRecords.length > 0}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* Dynamic Left Panel: Chat (only for forms, and when agent is open) */}
      {['dependencias', 'series', 'subseries', 'trdform', 'trd', 'datos', 'orgchart', 'ai-result', 'funciones', 'entrevistas', 'generador_ia', 'generador_manual'].includes(activeModule) && isAgentOpen && currentUser?.role !== 'user' && currentUser?.role !== 'Consulta' && (
        <section className="w-full lg:w-[350px] h-80 lg:h-full shrink-0 border-b lg:border-b-0 lg:border-r border-border shadow-lg z-10 bg-card transition-all duration-300 relative">
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

      {/* Content Area */}
      <main className="flex-1 bg-secondary/10 relative overflow-y-auto w-full lg:rounded-br-2xl">
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-primary/[0.02] to-transparent" />
        <div className="relative p-3 pb-8 md:p-6 h-full flex flex-col gap-4">
          
          <div className="flex-1">
            {activeModule === 'dependencias' && (
              <DependenciaForm 
                data={activeFormData} 
                onChange={setActiveFormData} 
                activeField={activeField} 
                dependencias={dependencias} 
                entities={userEntities} 
                currentUser={currentUser} 
                selectedEntityId={selectedEntityId} 
                errors={formErrors}
                onDeleteDependencia={async (id) => {
                  try {
                    await deleteDependencia(id);
                    addActivityLog(`Borrado dependencia - ID ${id}`);
                  } catch (err) {
                    await refreshData();
                    throw err;
                  }
                }}
              />
            )}
            {activeModule === 'orgchart' && (
              <OrgChartView dependencias={dependencias} currentUser={currentUser} entities={entities} onEdit={handleEdit} />
            )}
            {activeModule === 'series' && (
              <SerieForm 
                data={activeFormData} 
                onChange={setActiveFormData} 
                activeField={activeField} 
                dependencias={dependencias} 
                series={series}
                entities={userEntities} 
                currentUser={currentUser}
                selectedEntityId={selectedEntityId}
                errors={formErrors}
                onDeleteSerie={async (id) => {
                  try {
                    await deleteSerie(id);
                    addActivityLog(`Borrado serie - ID ${id}`);
                  } catch (err) {
                    await refreshData();
                    throw err;
                  }
                }}
              />
            )}
            {activeModule === 'subseries' && (
              <SubserieForm 
                data={activeFormData} 
                onChange={setActiveFormData} 
                activeField={activeField} 
                dependencias={dependencias} 
                series={series} 
                subseries={subseries}
                entities={userEntities} 
                currentUser={currentUser}
                selectedEntityId={selectedEntityId}
                errors={formErrors}
                onDeleteSubserie={async (id) => {
                  try {
                    await deleteSubserie(id);
                    addActivityLog(`Borrado subserie - ID ${id}`);
                  } catch (err) {
                    await refreshData();
                    throw err;
                  }
                }}
              />
            )}
            {activeModule === 'trdform' && (
              <TRDForm 
                data={activeFormData} 
                onChange={setActiveFormData} 
                activeField={activeField} 
                dependencias={dependencias} 
                series={series} 
                subseries={subseries} 
                trdRecords={trdRecords}
                entities={userEntities} 
                funciones={funciones} 
                currentUser={currentUser} 
                errors={formErrors}
                onDeleteTrd={async (id) => {
                  try {
                    await deleteTrdRecord(id);
                    addActivityLog(`Borrado TRD - ID ${id}`);
                  } catch (err) {
                    await refreshData();
                    throw err;
                  }
                }}
              />
            )}
            {activeModule === 'datos' && (
              <StructuredDataView dependencias={dependencias} series={series} subseries={subseries} trdRecords={trdRecords} onEdit={handleEdit} onDelete={handleDelete} currentUser={currentUser} />
            )}
            {activeModule === 'funciones' && (
              <FuncionesView 
                dependencias={dependencias} 
                entities={userEntities} 
                currentUser={currentUser} 
                selectedEntityId={selectedEntityId}
              />
            )}
            {activeModule === 'entrevistas' && (
              <EntrevistasView dependencias={dependencias} entities={userEntities} currentUser={currentUser} />
            )}
            {activeModule === 'generador_ia' && (
              <GeneradorDocumentalView 
                dependencias={dependencias} 
                entities={userEntities} 
                currentUser={currentUser} 
                selectedEntityId={selectedEntityId}
                forceMode="ai" 
              />
            )}
            {activeModule === 'generador_manual' && (
              <GeneradorDocumentalView 
                dependencias={dependencias} 
                entities={userEntities} 
                currentUser={currentUser} 
                selectedEntityId={selectedEntityId}
                forceMode="manual" 
              />
            )}

            {activeModule === 'trd' && (
              <div id="trd-report-wrapper" className="print-content h-full">
                <TRDGenerator 
                  rows={filteredTrdRows} 
                  selectedIds={selectedTrdIds}
                  onToggleRow={toggleTrdRow}
                  onToggleAll={toggleAllTrdRows}
                  currentUser={currentUser}
                  currentEntity={currentEntity}
                  logoBase64={entidadLogoBase64}
                  onExportPDF={() => {
                    if (filteredTrdRows.length === 0) {
                      setModalStatus({
                        isOpen: true,
                        type: 'error',
                        message: 'No hay datos de TRD disponibles para los criterios seleccionados. Por favor, asegúrate de que existan valoraciones aprobadas.'
                      });
                      return;
                    }
                    setIsPrinting(true);
                  }}
                  availableDependencias={uniqueDependencias}
                  selectedPrintDependencias={selectedPrintDependencias}
                  onSelectDependencia={setSelectedPrintDependencias}
                />
              </div>
            )}
            {activeModule === 'ai-result' && (
               <div className="h-full flex flex-col gap-6 animate-in slide-in-from-right-4 duration-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                        <BrainCircuit className="w-8 h-8 text-primary" />
                        {aiQueryResult?.title || "Resultado del Asistente"}
                      </h2>
                      <p className="text-slate-500 font-medium">Información procesada por Orianna para tu gestión.</p>
                    </div>
                    <button 
                      onClick={() => setActiveModule('dashboard')}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-bold transition-all"
                    >
                      CERRAR VISTA
                    </button>
                  </div>
                  
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 flex-1 overflow-y-auto">
                    <div className="max-w-3xl mx-auto">
                      <div className="prose prose-slate prose-lg max-w-none">
                        <p className="whitespace-pre-wrap text-slate-700 leading-relaxed font-medium">
                          {aiQueryResult?.content}
                        </p>
                      </div>
                      
                      {aiQueryResult?.data && aiQueryResult.data.length > 0 && (
                        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
                          {aiQueryResult.data.map((item, idx) => (
                            <div key={idx} className="p-4 bg-slate-50 border border-slate-100 rounded-xl">
                              <span className="text-[10px] font-black uppercase tracking-widest text-primary/60 block mb-1"
                                onClick={() => {
                                  if (currentUser.role === 'superadmin' || currentUser.role === 'administrador') {
                                    setActiveModule('import');
                                  } else {
                                    alert("Solo un Administrador puede realizar importaciones masivas.");
                                  }
                                }}>
                                {item.type || 'Item'}
                              </span>
                              <h4 className="text-sm font-bold text-slate-900">{item.name}</h4>
                              {item.description && <p className="text-xs text-slate-500 mt-1">{item.description}</p>}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
               </div>
            )}
            <div className="h-4" /> {/* Spacer */}
          </div>

          {['dependencias', 'series', 'subseries', 'trdform'].includes(activeModule) && 
           !['Consulta', 'consulta', 'viewer'].includes(currentUser?.role || currentUser?.perfil || '') && (
           <div className="mt-6 flex justify-end max-w-7xl w-full mx-auto pb-12 px-6">
             <button 
               onClick={handleSave}
               disabled={isSaving}
               className={cn(
                 "flex items-center gap-3 px-10 py-4 rounded-2xl shadow-xl text-base font-black uppercase tracking-widest transition-all transform active:scale-95",
                 isSaving ? "bg-slate-300 cursor-not-allowed text-slate-500" : "bg-primary text-white hover:bg-primary/90 shadow-primary/20"
               )}
             >
               {isSaving ? <Activity className="h-6 w-6 animate-spin" /> : <Save className="h-6 w-6" />}
               {isSaving ? "Guardando..." : (activeFormData.id ? "Actualizar Registro" : "Guardar Registro")}
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
             <div className="flex bg-slate-800 p-1 rounded-xl border border-slate-700 mr-2">
               <button 
                 onClick={() => setPrintOrientation('portrait')}
                 className={cn(
                   "px-3 py-1.5 rounded-lg text-xs font-black transition-all",
                   printOrientation === 'portrait' ? "bg-slate-100 text-slate-900 shadow-lg" : "text-slate-400 hover:text-white"
                 )}
               >
                 VERTICAL
               </button>
               <button 
                 onClick={() => setPrintOrientation('landscape')}
                 className={cn(
                   "px-3 py-1.5 rounded-lg text-xs font-black transition-all",
                   printOrientation === 'landscape' ? "bg-slate-100 text-slate-900 shadow-lg" : "text-slate-400 hover:text-white"
                 )}
               >
                 HORIZONTAL
               </button>
             </div>

            <button 
              onClick={() => {
                const isGlobal = selectedPrintDependencias.includes("TODAS");
                const safeDepName = isGlobal 
                  ? "ReporteGeneral" 
                  : selectedPrintDependencias[0].toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, '_');
                
                const now = new Date();
                const dateStr = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}_${String(now.getDate()).padStart(2, '0')}`;
                
                const customFilename = `${safeDepName}_${dateStr}`;
                
                addActivityLog(`Descarga Excel TRD - ${isGlobal ? "Global" : selectedPrintDependencias.join(", ")}`);
                exportTRDToExcel(filteredTrdRows, customFilename);
              }}
              className="flex items-center gap-2 px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-lg text-sm font-bold transition-all shadow-lg active:scale-95 border border-slate-300"
            >
              <Download className="h-4 w-4" />
              DESCARGAR EXCEL
            </button>

            <button 
              onClick={() => {
                const isGlobal = selectedPrintDependencias.includes("TODAS");
                const safeDepName = isGlobal
                  ? "ReporteGeneral" 
                  : selectedPrintDependencias[0].toString().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, '_');
                
                const now = new Date();
                const dateStr = `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}_${String(now.getDate()).padStart(2, '0')}`;
                const randomId = Math.floor(Math.random() * 99999999).toString().padStart(8, '0');
                
                const customFilename = `${safeDepName}_${dateStr}_${randomId}`;
                
                addActivityLog(`Descarga TRD (${printOrientation}) - ${isGlobal ? "Global" : selectedPrintDependencias.join(", ")}`);
                handleExportPDFGeneral('trd-final-report-area', customFilename, printOrientation);
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
            currentEntity={currentEntity}
            logoBase64={entidadLogoBase64}
            orientation={printOrientation}
            onToggleRow={() => {}} 
            onToggleAll={() => {}}
          />
        </div>
      </div>
    );
  }


  return (
    <RAGProvider>
      <div className="relative flex h-screen overflow-hidden bg-background font-sans">
          <MainSidebar 
            activeView={mainView} 
            onNavigate={(id) => {
              setMainView(id);
              if (id === 'trd') setActiveModule('trd');
            }}
            searchQuery={globalSearchQuery}
            onSearchQueryChange={setGlobalSearchQuery}
            currentUser={currentUser}
            currentEntity={currentEntity}
            hasTrdData={(trdRecords || []).length > 0 || (dependencias || []).length > 0 || (series || []).length > 0}
            isOpen={isMobileMenuOpen}
            onClose={() => setIsMobileMenuOpen(false)}
            pendingInvitationsCount={pendingInvitationsCount}
            isCollapsed={isSidebarCollapsed}
            onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          />
         
         <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50">
            <MainHeader 
               onLogout={handleLogout}
               mainView={mainView}
               onExportPDF={handleExportTRD}
               trdProps={{ 
                 status: "En Progreso", 
                 rows: filteredTrdRows,
                 availableDependencias: uniqueDependencias,
                 selectedPrintDependencias,
                 onSelectDependencia: setSelectedPrintDependencias
               }}
               currentUser={currentUser}
               onNavigate={(v) => { setMainView(v); setActiveModule(v); }}
               userEntities={userEntities}
               selectedEntityId={selectedEntityId}
               onSelectEntity={setSelectedEntityId}
               onMenuToggle={() => setIsMobileMenuOpen(prev => !prev)}
            />

            <div className="flex-1 overflow-y-auto relative flex flex-col w-full">
              <LoadingOverlay isVisible={trdLoading} message="Sincronizando Archivos..." />
              <ErrorBoundary key={mainView}>
                {mainView === 'dashboard' && (
                  <DashboardView 
                    stats={realStats} 
                    searchQuery={globalSearchQuery} 
                    currentUser={currentUser} 
                    seriesCount={(series || []).length} 
                    activityLogs={activityLogs} 
                    trdRecords={trdRecords}
                    onDownloadPDF={handleExportTRD}
                    onRefresh={refreshDashboardData}
                    isRefreshing={isRefreshingDashboard}
                  />
                )}
                {mainView === 'entities' && <EntitiesView entities={entities} setEntities={setEntities} currentUser={currentUser} />}
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
                {mainView === 'rag' && <DocumentcioRAGView currentUser={currentUser} currentEntity={currentEntity} />}
                {mainView === 'users' && <UsersView searchQuery={globalSearchQuery} onSearchQueryChange={setGlobalSearchQuery} currentUser={currentUser} users={users} setUsers={setUsers} entities={entities} selectedEntityId={selectedEntityId} />}
                {mainView === 'settings' && <SettingsView currentUser={currentUser} onUpdate={handleUpdateUserProfile} onLogout={handleLogout} />}
                {mainView === 'help' && <HelpCenterView currentUser={currentUser} />}
                
                {mainView === 'invitations' && (
                  <InvitationsView 
                    currentUser={currentUser}
                    API_BASE_URL={API_BASE_URL}
                    onNavigate={setMainView}
                    entities={entities}
                    selectedEntityId={selectedEntityId}
                    onInviteResponded={(id, action) => {
                      if (action === 'accept') refreshUserProfile();
                    }}
                  />
                )}
                
                {/* TRD Módulo (Layout Anterior embebido) */}
                {mainView === 'trd' && renderLegacyTRDLayout()}
              </ErrorBoundary>
            </div>
         </div>
      
      <ConflictModal 
        isOpen={conflictModal.isOpen}
        conflictInfo={conflictModal.info}
        onResolve={handleConflictResolution}
      />

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


