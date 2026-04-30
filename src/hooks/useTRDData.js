import { useState, useEffect } from 'react';

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
  const authHeaders = () => {
    const h = {
      'Authorization': `Bearer ${currentUser?.token || ''}`,
      'Content-Type': 'application/json'
    };
    if (entityId) h['x-entity-context'] = entityId;
    return h;
  };

  const loadData = async () => {
    const token  = currentUser?.token;
    const entity = entityId;

    if (!token || !entity || entity === 'null' || entity === 'undefined') {
      // No token or no entity → nothing to load
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Use backend API (service-key access, RLS-bypassed, entity-scoped)
      const base = `${API_BASE_URL}/trd/entity/${entity}`;
      const headers = authHeaders();

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

  // ─── CRUD Dependencias ──────────────────────────────────────────────────────
  const addDependencia = async (data) => {
    const newRecord = { 
      ...data, 
      id: data.id || Date.now().toString()
    };

    // Optimistic Update
    setDependencias(prev => {
      const exists = prev.find(x => String(x.id) === String(newRecord.id));
      return exists ? prev.map(x => String(x.id) === String(newRecord.id) ? newRecord : x) : [...prev, newRecord];
    });

    try {
      if (!entityId || entityId === 'null' || entityId === 'undefined') {
          console.error("❌ No se puede guardar dependencia: entityId es inválido", entityId);
          throw new Error("Contexto de entidad no válido. Por favor, refresca la página.");
      }
      const isCreate = !dependencias.find(x => String(x.id) === String(newRecord.id));
      const url = `${API_BASE_URL}/trd/entity/${entityId}/dependencias${isCreate ? '' : '/' + newRecord.id}`;
      const method = isCreate ? 'POST' : 'PUT';
      
      const response = await fetch(url, {
        method: method,
        headers: authHeaders(),
        body: JSON.stringify(mapDependenciaToDB(newRecord))
      });
      
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        console.error(`API Error [${method} dependencias]:`, errData);
        
        // Extraer mensaje de error más legible
        let detail = errData.detail || 'Error al guardar la dependencia';
        if (detail.includes("duplicate key value violates unique constraint")) {
          detail = "El código ingresado ya existe para esta entidad. Por favor usa uno diferente.";
        }
        
        throw new Error(detail);
      }
      return await response.json();
    } catch (err) {
      console.error('❌ Error guardando dependencia:', err);
      // Re-lanzar para que el componente lo maneje (mostrar modal y no limpiar form)
      throw err;
    }
  };

  const deleteDependencia = async (id) => {
    setDependencias(prev => prev.filter(x => x.id !== id));
    try {
      const response = await fetch(`${API_BASE_URL}/trd/entity/${entityId}/dependencias/${id}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      if (!response.ok) throw new Error('Delete failed');
    } catch (err) {
      console.error('❌ Error deleting dependencia:', err);
      throw err;
    }
  };

  // ─── CRUD Series ────────────────────────────────────────────────────────────
  const addSerie = async (data) => {
    const newRecord = { ...data, id: data.id || Date.now().toString() };
    setSeries(prev => {
      const exists = prev.find(x => String(x.id) === String(newRecord.id));
      return exists ? prev.map(x => String(x.id) === String(newRecord.id) ? newRecord : x) : [...prev, newRecord];
    });

    try {
      if (!entityId || entityId === 'null' || entityId === 'undefined') {
          console.error("❌ No se puede guardar serie: entityId es inválido", entityId);
          throw new Error("Contexto de entidad no válido. Por favor, refresca la página.");
      }
      const isCreate = !series.find(x => String(x.id) === String(newRecord.id));
      const url = `${API_BASE_URL}/trd/entity/${entityId}/series${isCreate ? '' : '/' + newRecord.id}`;
      const method = isCreate ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method: method,
        headers: authHeaders(),
        body: JSON.stringify(mapSerieToDB(newRecord))
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        let detail = errData.detail || 'Error al guardar la serie';
        if (detail.includes("duplicate key value violates unique constraint")) {
          detail = "El código de serie ingresado ya existe para esta entidad.";
        }
        throw new Error(detail);
      }
      return await res.json();
    } catch (err) {
      console.error('❌ Error guardando serie:', err);
      throw err;
    }
  };

  const deleteSerie = async (id) => {
    setSeries(prev => prev.filter(x => x.id !== id));
    // Implementation omitted for brevity in route, but we follow the pattern
  };

  // ─── CRUD Subseries ─────────────────────────────────────────────────────────
  const addSubserie = async (data) => {
    const newRecord = { ...data, id: data.id || Date.now().toString() };
    setSubseries(prev => {
      const exists = prev.find(x => String(x.id) === String(newRecord.id));
      return exists ? prev.map(x => String(x.id) === String(newRecord.id) ? newRecord : x) : [...prev, newRecord];
    });

    try {
      if (!entityId || entityId === 'null' || entityId === 'undefined') {
          console.error("❌ No se puede guardar subserie: entityId es inválido", entityId);
          throw new Error("Contexto de entidad no válido. Por favor, refresca la página.");
      }
      const isCreate = !subseries.find(x => String(x.id) === String(newRecord.id));
      const url = `${API_BASE_URL}/trd/entity/${entityId}/subseries${isCreate ? '' : '/' + newRecord.id}`;
      const method = isCreate ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method: method,
        headers: authHeaders(),
        body: JSON.stringify(mapSubserieToDB(newRecord))
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        let detail = errData.detail || 'Error al guardar la subserie';
        if (detail.includes("duplicate key value violates unique constraint")) {
          detail = "Ya existe una subserie con este código dentro de la misma dependencia y serie";
        }
        throw new Error(detail);
      }
      return await res.json();
    } catch (err) {
      console.error('❌ Error guardando subserie:', err);
      throw err;
    }
  };

  const deleteSubserie = async (id) => {
    setSubseries(prev => prev.filter(x => x.id !== id));
  };

  // ─── CRUD TRD Records ───────────────────────────────────────────────────────
  const addTrdRecord = async (data) => {
    const newRecord = { ...data, id: data.id || Date.now().toString() };
    setTrdRecords(prev => {
      const exists = prev.find(x => String(x.id) === String(newRecord.id));
      return exists ? prev.map(x => String(x.id) === String(newRecord.id) ? newRecord : x) : [...prev, newRecord];
    });

    try {
      if (!entityId || entityId === 'null' || entityId === 'undefined') {
          console.error("❌ No se puede guardar TRD record: entityId es inválido", entityId);
          throw new Error("Contexto de entidad no válido. Por favor, refresca la página.");
      }
      const isCreate = !trdRecords.find(x => String(x.id) === String(newRecord.id));
      const url = `${API_BASE_URL}/trd/entity/${entityId}/trd_records${isCreate ? '' : '/' + newRecord.id}`;
      const method = isCreate ? 'POST' : 'PUT';

      const res = await fetch(url, {
        method: method,
        headers: authHeaders(),
        body: JSON.stringify(mapTRDToDB(newRecord))
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        let detail = errData.detail || 'Error al guardar la valoración TRD';
        // TRD might not have a simple "code" but a unique constraint on dep+ser+sub
        if (detail.includes("duplicate key value violates unique constraint")) {
          detail = "Ya existe una valoración para esta combinación de Dependencia/Serie/Subserie.";
        }
        throw new Error(detail);
      }
      return await res.json();
    } catch (err) {
      console.error('❌ Error guardando TRD record:', err);
      throw err;
    }
  };

  const deleteTrdRecord = async (id) => {
    setTrdRecords(prev => prev.filter(x => x.id !== id));
    try {
      const response = await fetch(`${API_BASE_URL}/trd/entity/${entityId}/trd_records/${id}`, {
        method: 'DELETE',
        headers: authHeaders()
      });
      if (!response.ok) throw new Error('Delete failed');
    } catch (err) {
      console.error('❌ Error deleting TRD record:', err);
      throw err;
    }
  };

  return {
    dependencias, series, subseries, trdRecords,
    isLoading, isSynced,
    setDependencias, setSeries, setSubseries, setTrdRecords,
    addDependencia, updateDependencia: addDependencia, deleteDependencia,
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
