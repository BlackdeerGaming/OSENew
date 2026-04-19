import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import API_BASE_URL from '../config/api';

export function useTRDData(currentUser = null, entityId = null) {
  const [dependencias, setDependencias] = useState([]);
  const [series, setSeries] = useState([]);
  const [subseries, setSubseries] = useState([]);
  const [trdRecords, setTrdRecords] = useState([]);
  const [imports, setImports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSynced, setIsSynced] = useState(false);

  // ── Internal helpers ────────────────────────────────────────────────────────
  const authHeaders = () => ({
    'Authorization': `Bearer ${currentUser?.token || ''}`,
    'Content-Type': 'application/json'
  });

  const loadData = async () => {
    const token  = currentUser?.token;
    const entity = entityId;

    if (!token || !entity) {
      // No token or no entity → nothing to load
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Use backend API (service-key access, RLS-bypassed, entity-scoped)
      const base = `${API_BASE_URL}/trd/entity/${entity}`;
      const headers = { 'Authorization': `Bearer ${token}` };

      const [dRes, sRes, ssRes, trdRes] = await Promise.all([
        fetch(`${base}/dependencias`, { headers }),
        fetch(`${base}/series`,       { headers }),
        fetch(`${base}/subseries`,    { headers }),
        fetch(`${base}/trd_records`,  { headers }),
      ]);

      if (dRes.ok)   setDependencias((await dRes.json()).map(mapDependenciaFromDB));
      if (sRes.ok)   setSeries((await sRes.json()).map(mapSerieFromDB));
      if (ssRes.ok)  setSubseries((await ssRes.json()).map(mapSubserieFromDB));
      if (trdRes.ok) setTrdRecords((await trdRes.json()).map(mapTRDFromDB));

      setIsSynced(true);
    } catch (err) {
      console.error('Error loading TRD data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Stable primitive deps: only re-load when user id, token, or entityId change
  const userId    = currentUser?.id    || null;
  const userToken = currentUser?.token || null;

  useEffect(() => {
    loadData();
  }, [userId, userToken, entityId]);

  const refreshData = () => loadData();

  const safeApiCall = async (method, endpoint, payload = null) => {
    const res = await fetch(`${API_BASE_URL}/trd/entity/${entityId}/${endpoint}`, {
      method,
      headers: authHeaders(),
      body: payload ? JSON.stringify(payload) : undefined
    });
    if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        console.error(`API Error [${method} ${endpoint}]:`, errData);
        throw new Error(errData.detail || `Error en servidor: ${res.statusText}`);
    }
    return res.json();
  };

  // ─── CRUD Dependencias ──────────────────────────────────────────────────────
  const addDependencia = async (data) => {
    const newRecord = { ...data, id: data.id || Date.now().toString(), entidadId: entityId };
    try {
      // 1. Guardar en Backend
      const saved = await safeApiCall('POST', 'dependencias', mapDependenciaToDB(newRecord));
      // 2. Actualizar estado SI la petición fue exitosa (Non-Optimistic safety)
      setDependencias(prev => {
        const exists = prev.find(x => x.id === newRecord.id);
        return exists ? prev.map(x => x.id === newRecord.id ? newRecord : x) : [...prev, newRecord];
      });
      return newRecord;
    } catch (error) {
      console.error('❌ Error guardando dependencia:', error);
      throw error;
    }
  };

  const updateDependencia = async (id, data) => {
     try {
       await safeApiCall('PUT', `dependencias/${id}`, mapDependenciaToDB({ ...data, entidadId: entityId }));
       setDependencias(prev => prev.map(x => x.id === id ? { ...x, ...data, entidadId: entityId } : x));
     } catch (error) {
       console.error('❌ Error actualizando dependencia:', error);
       throw error;
     }
  };

  const deleteDependencia = async (id) => {
    try {
      await safeApiCall('DELETE', `dependencias/${id}`);
      setDependencias(prev => prev.filter(x => x.id !== id));
    } catch (error) {
      console.error('❌ Error borrando dependencia:', error);
      throw error;
    }
  };

  // ─── CRUD Series ────────────────────────────────────────────────────────────
  const addSerie = async (data) => {
    const newRecord = { ...data, id: data.id || Date.now().toString(), entidadId: entityId };
    try {
      await safeApiCall('POST', 'series', mapSerieToDB(newRecord));
      setSeries(prev => {
        const exists = prev.find(x => x.id === newRecord.id);
        return exists ? prev.map(x => x.id === newRecord.id ? newRecord : x) : [...prev, newRecord];
      });
      return newRecord;
    } catch (error) {
      console.error('❌ Error guardando serie:', error);
      throw error;
    }
  };

  const deleteSerie = async (id) => {
    try {
      await safeApiCall('DELETE', `series/${id}`);
      setSeries(prev => prev.filter(x => x.id !== id));
    } catch (error) {
       console.error('❌ Error borrando serie:', error);
       throw error;
    }
  };

  // ─── CRUD Subseries ─────────────────────────────────────────────────────────
  const addSubserie = async (data) => {
    const newRecord = { ...data, id: data.id || Date.now().toString(), entidadId: entityId };
    try {
      await safeApiCall('POST', 'subseries', mapSubserieToDB(newRecord));
      setSubseries(prev => {
        const exists = prev.find(x => x.id === newRecord.id);
        return exists ? prev.map(x => x.id === newRecord.id ? newRecord : x) : [...prev, newRecord];
      });
      return newRecord;
    } catch (error) {
      console.error('❌ Error guardando subserie:', error);
      throw error;
    }
  };

  const deleteSubserie = async (id) => {
    try {
      await safeApiCall('DELETE', `subseries/${id}`);
      setSubseries(prev => prev.filter(x => x.id !== id));
    } catch (error) {
       console.error('❌ Error borrando subserie:', error);
       throw error;
    }
  };

  // ─── CRUD TRD Records ───────────────────────────────────────────────────────
  const addTrdRecord = async (data) => {
    const newRecord = { ...data, id: data.id || Date.now().toString(), entidadId: entityId };
    try {
      await safeApiCall('POST', 'trd_records', mapTRDToDB(newRecord));
      setTrdRecords(prev => {
        const exists = prev.find(x => x.id === newRecord.id);
        return exists ? prev.map(x => x.id === newRecord.id ? newRecord : x) : [...prev, newRecord];
      });
      return newRecord;
    } catch (error) {
       console.error('❌ Error guardando registro TRD:', error);
       throw error;
    }
  };

  const deleteTrdRecord = async (id) => {
    try {
      await safeApiCall('DELETE', `trd_records/${id}`);
      setTrdRecords(prev => prev.filter(x => x.id !== id));
    } catch (error) {
       console.error('❌ Error borrando registro TRD:', error);
       throw error;
    }
  };

  return {
    dependencias, series, subseries, trdRecords,
    isLoading, isSynced,
    setDependencias, setSeries, setSubseries, setTrdRecords,
    addDependencia, updateDependencia, deleteDependencia,
    addSerie, deleteSerie,
    addSubserie, deleteSubserie,
    addTrdRecord, deleteTrdRecord, refreshData,
    imports, setImports
  };
}

// ─── Mapping Helpers ────────────────────────────────────────────────────────

function mapDependenciaFromDB(d) {
  return {
    id: d.id,
    nombre: d.nombre,
    sigla: d.sigla,
    codigo: d.codigo,
    pais: d.pais,
    departamento: d.departamento,
    ciudad: d.ciudad,
    direccion: d.direccion,
    telefono: d.telefono,
    dependeDe: d.depende_de,
    entidadId: d.entidad_id || d.entity_id
  };
}

function mapDependenciaToDB(d) {
  return {
    id: d.id,
    nombre: d.nombre,
    sigla: d.sigla,
    codigo: d.codigo,
    pais: d.pais,
    departamento: d.departamento,
    ciudad: d.ciudad,
    direccion: d.direccion,
    telefono: d.telefono,
    depende_de: (d.dependeDe === "ninguna" || !d.dependeDe) ? null : d.dependeDe,
    entidad_id: d.entidadId || d.entityId || null
  };
}

function mapSerieFromDB(s) {
  return {
    id: s.id,
    nombre: s.nombre,
    codigo: s.codigo,
    dependenciaId: s.dependencia_id,
    entidadId: s.entidad_id || s.entity_id,
    tipoDocumental: s.tipo_documental
  };
}

function mapSerieToDB(s) {
  return {
    id: s.id,
    nombre: s.nombre,
    codigo: s.codigo,
    dependencia_id: s.dependenciaId,
    entidad_id: s.entidadId || s.entityId || null,
    tipo_documental: s.tipoDocumental
  };
}

function mapSubserieFromDB(s) {
  return {
    id: s.id,
    nombre: s.nombre,
    codigo: s.codigo,
    serieId: s.serie_id,
    dependenciaId: s.dependencia_id,
    entidadId: s.entidad_id || s.entity_id,
    tipoDocumental: s.tipo_documental
  };
}

function mapSubserieToDB(s) {
  return {
    id: s.id,
    nombre: s.nombre,
    codigo: s.codigo,
    serie_id: s.serieId,
    dependencia_id: s.dependenciaId || null,
    entidad_id: s.entidadId || s.entityId || null,
    tipo_documental: s.tipoDocumental
  };
}

function mapTRDFromDB(r) {
  return {
    id: r.id,
    dependenciaId: r.dependencia_id,
    serieId: r.serie_id,
    subserieId: r.subserie_id,
    entidadId: r.entidad_id || r.entity_id,
    estadoConservacion: r.estado_conservacion,
    retencionGestion: r.retenci_gestion,
    retencionCentral: r.retenci_central,
    ddhh: r.ddhh,
    procedimiento: r.procedimiento,
    actoAdmo: r.acto_admo,
    'disp_Conservación total': r.disp_conservacion_total,
    'disp_Eliminación': r.disp_eliminacion,
    'disp_Selección': r.disp_seleccion,
    ord_Alfabética: r.ord_alfabetica,
    ord_Cronológica: r.ord_cronologica,
    ord_Numérica: r.ord_numerica,
    ord_Otra: r.ord_otra,
    val_Administrativo: r.val_administrativo,
    val_Técnico: r.val_tecnico,
    val_Contable: r.val_contable,
    val_Fiscal: r.val_fiscal,
    val_Legal: r.val_legal,
    val_Histórico: r.val_historico,
    rep_microfilmacion: r.rep_microfilmacion,
    rep_digitalizacion: r.rep_digitalizacion,
    createdAt: r.created_at
  };
}

function mapTRDToDB(r) {
  return {
    id: r.id,
    dependencia_id: r.dependenciaId,
    serie_id: r.serieId,
    subserie_id: (r.subserieId === "ninguna" || r.subserieId === "no aplica" || !r.subserieId) ? null : r.subserieId,
    entidad_id: r.entidadId || r.entityId || null,
    estado_conservacion: r.estadoConservacion,
    retenci_gestion: r.retencionGestion ? parseInt(r.retencionGestion) : null,
    retenci_central: r.retencionCentral ? parseInt(r.retencionCentral) : null,
    ddhh: r.ddhh,
    procedimiento: r.procedimiento,
    acto_admo: r.actoAdmo,
    disp_conservacion_total: r['disp_Conservación total'] || false,
    disp_eliminacion: r['disp_Eliminación'] || false,
    disp_seleccion: r['disp_Selección'] || false,
    ord_alfabetica: r['ord_Alfabética'] || false,
    ord_cronologica: r['ord_Cronológica'] || false,
    ord_numerica: r['ord_Numérica'] || false,
    ord_otra: r['ord_Otra'] || false,
    val_administrativo: r['val_Administrativo'] || false,
    val_tecnico: r['val_Técnico'] || false,
    val_contable: r['val_Contable'] || false,
    val_fiscal: r['val_Fiscal'] || false,
    val_legal: r['val_Legal'] || false,
    val_historico: r['val_Histórico'] || false,
    rep_microfilmacion: r.rep_microfilmacion || false,
    rep_digitalizacion: r.rep_digitalizacion || false,
  };
}
