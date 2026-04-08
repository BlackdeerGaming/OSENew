import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

/**
 * Hook para gestionar el estado de la TRD (Dependencias, Series, Subseries, TRD Records)
 * con persistencia en Supabase. Si Supabase no está configurado, opera en modo local (localStorage).
 */
export function useTRDData() {
  const [dependencias, setDependencias] = useState([]);
  const [series, setSeries] = useState([]);
  const [subseries, setSubseries] = useState([]);
  const [trdRecords, setTrdRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSynced, setIsSynced] = useState(false);

  // ─── Cargar datos iniciales ─────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setIsLoading(true);
    if (!supabase) {
      // Modo local: cargar desde localStorage
      const d = localStorage.getItem('trd_dependencias');
      const s = localStorage.getItem('trd_series');
      const ss = localStorage.getItem('trd_subseries');
      const t = localStorage.getItem('trd_records');
      if (d) setDependencias(JSON.parse(d));
      if (s) setSeries(JSON.parse(s));
      if (ss) setSubseries(JSON.parse(ss));
      if (t) setTrdRecords(JSON.parse(t));
      setIsLoading(false);
      return;
    }

    try {
      const [depRes, serRes, subRes, trdRes] = await Promise.all([
        supabase.from('dependencias').select('*').order('created_at'),
        supabase.from('series').select('*').order('created_at'),
        supabase.from('subseries').select('*').order('created_at'),
        supabase.from('trd_records').select('*').order('created_at'),
      ]);

      if (depRes.data) setDependencias(depRes.data.map(mapDepFromDB));
      if (serRes.data) setSeries(serRes.data.map(mapSerieFromDB));
      if (subRes.data) setSubseries(subRes.data.map(mapSubserieFromDB));
      if (trdRes.data) setTrdRecords(trdRes.data.map(mapTRDFromDB));
      setIsSynced(true);
      console.log('✅ TRD cargada desde Supabase');
    } catch (e) {
      console.error('❌ Error cargando desde Supabase:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ─── Persistencia local de respaldo ────────────────────────────────────────
  useEffect(() => {
    if (!supabase) {
      localStorage.setItem('trd_dependencias', JSON.stringify(dependencias));
    }
  }, [dependencias]);

  useEffect(() => {
    if (!supabase) {
      localStorage.setItem('trd_series', JSON.stringify(series));
    }
  }, [series]);

  useEffect(() => {
    if (!supabase) {
      localStorage.setItem('trd_subseries', JSON.stringify(subseries));
    }
  }, [subseries]);

  useEffect(() => {
    if (!supabase) {
      localStorage.setItem('trd_records', JSON.stringify(trdRecords));
    }
  }, [trdRecords]);

  // ─── CRUD Dependencias ──────────────────────────────────────────────────────
  const addDependencia = async (data) => {
    const newRecord = { ...data, id: data.id || Date.now().toString() };
    
    // Optimistic local update
    setDependencias(prev => {
      const exists = prev.find(x => x.id === newRecord.id);
      return exists ? prev.map(x => x.id === newRecord.id ? newRecord : x) : [...prev, newRecord];
    });

    if (supabase) {
      console.log('📡 Guardando dependencia en Supabase...', newRecord);
      const { error } = await supabase.from('dependencias').upsert(mapDepToDB(newRecord));
      if (error) { 
        console.error('❌ Error guardando dependencia en Supabase:', error); 
        // Revert local state if needed? For now just log.
        return null; 
      }
    }
    return newRecord;
  };

  const updateDependencia = async (id, data) => {
    const updated = { ...data, id };
    
    // Optimistic local update
    setDependencias(prev => prev.map(x => x.id === id ? { ...x, ...updated } : x));

    if (supabase) {
      console.log('📡 Actualizando dependencia en Supabase...', id);
      const { error } = await supabase.from('dependencias').update(mapDepToDB(data)).eq('id', id);
      if (error) { console.error('❌ Error actualizando dependencia:', error); return; }
    }
  };

  const deleteDependencia = async (id) => {
    // Optimistic local update
    setDependencias(prev => prev.filter(x => x.id !== id));
    setSeries(prev => prev.filter(x => x.dependenciaId !== id));
    setSubseries(prev => prev.filter(x => x.dependenciaId !== id));
    setTrdRecords(prev => prev.filter(x => x.dependenciaId !== id));

    if (supabase) {
      console.log('📡 Eliminando dependencia en Supabase...', id);
      const { error } = await supabase.from('dependencias').delete().eq('id', id);
      if (error) { console.error('❌ Error eliminando dependencia:', error); }
    }
  };

  // ─── CRUD Series ────────────────────────────────────────────────────────────
  const addSerie = async (data) => {
    const newRecord = { ...data, id: data.id || Date.now().toString() };
    
    // Optimistic local update
    setSeries(prev => {
      const exists = prev.find(x => x.id === newRecord.id);
      return exists ? prev.map(x => x.id === newRecord.id ? newRecord : x) : [...prev, newRecord];
    });

    if (supabase) {
      console.log('📡 Guardando serie en Supabase...', newRecord);
      const { error } = await supabase.from('series').upsert(mapSerieToDB(newRecord));
      if (error) { console.error('❌ Error guardando serie en Supabase:', error); return null; }
    }
    return newRecord;
  };

  const deleteSerie = async (id) => {
    // Optimistic local update
    setSeries(prev => prev.filter(x => x.id !== id));
    setSubseries(prev => prev.filter(x => x.serieId !== id));
    setTrdRecords(prev => prev.filter(x => x.serieId !== id));

    if (supabase) {
      console.log('📡 Eliminando serie en Supabase...', id);
      await supabase.from('series').delete().eq('id', id);
    }
  };

  // ─── CRUD Subseries ─────────────────────────────────────────────────────────
  const addSubserie = async (data) => {
    const newRecord = { ...data, id: data.id || Date.now().toString() };
    
    // Optimistic local update
    setSubseries(prev => {
      const exists = prev.find(x => x.id === newRecord.id);
      return exists ? prev.map(x => x.id === newRecord.id ? newRecord : x) : [...prev, newRecord];
    });

    if (supabase) {
      console.log('📡 Guardando subserie en Supabase...', newRecord);
      const { error } = await supabase.from('subseries').upsert(mapSubserieToDB(newRecord));
      if (error) { console.error('❌ Error guardando subserie en Supabase:', error); return null; }
    }
    return newRecord;
  };

  const deleteSubserie = async (id) => {
    // Optimistic local update
    setSubseries(prev => prev.filter(x => x.id !== id));
    setTrdRecords(prev => prev.filter(x => x.subserieId !== id));

    if (supabase) {
      console.log('📡 Eliminando subserie en Supabase...', id);
      await supabase.from('subseries').delete().eq('id', id);
    }
  };

  // ─── CRUD TRD Records ───────────────────────────────────────────────────────
  const addTrdRecord = async (data) => {
    const newRecord = { ...data, id: data.id || Date.now().toString() };
    if (supabase) {
      const { error } = await supabase.from('trd_records').upsert(mapTRDToDB(newRecord));
      if (error) { console.error('Error guardando TRD:', error); return null; }
    }
    setTrdRecords(prev => {
      const exists = prev.find(x => x.id === newRecord.id);
      return exists ? prev.map(x => x.id === newRecord.id ? newRecord : x) : [...prev, newRecord];
    });
    return newRecord;
  };

  return {
    dependencias, series, subseries, trdRecords,
    isLoading, isSynced,
    setDependencias, setSeries, setSubseries, setTrdRecords,
    addDependencia, updateDependencia, deleteDependencia,
    addSerie, deleteSerie,
    addSubserie, deleteSubserie,
    addTrdRecord,
    reload: loadAll,
  };
}

// ─── Mappers DB ↔ App ────────────────────────────────────────────────────────

function mapDepFromDB(r) {
  return {
    id: r.id,
    nombre: r.nombre,
    sigla: r.sigla,
    codigo: r.codigo,
    pais: r.pais,
    departamento: r.departamento,
    ciudad: r.ciudad,
    direccion: r.direccion,
    telefono: r.telefono,
    dependeDe: r.depende_de,
    entidadId: r.entidad_id,
  };
}

function mapDepToDB(r) {
  return {
    id: r.id,
    nombre: r.nombre,
    sigla: r.sigla,
    codigo: r.codigo,
    pais: r.pais,
    departamento: r.departamento,
    ciudad: r.ciudad,
    direccion: r.direccion,
    telefono: r.telefono,
    depende_de: r.dependeDe || null,
    entidad_id: r.entidadId || null,
  };
}

function mapSerieFromDB(r) {
  return {
    id: r.id,
    nombre: r.nombre,
    codigo: r.codigo,
    tipoDocumental: r.tipo_documental,
    descripcion: r.descripcion,
    dependenciaId: r.dependencia_id,
    entidadId: r.entidad_id,
  };
}

function mapSerieToDB(r) {
  return {
    id: r.id,
    nombre: r.nombre,
    codigo: r.codigo,
    tipo_documental: r.tipoDocumental,
    descripcion: r.descripcion,
    dependencia_id: r.dependenciaId,
    entidad_id: r.entidadId || null,
  };
}

function mapSubserieFromDB(r) {
  return {
    id: r.id,
    nombre: r.nombre,
    codigo: r.codigo,
    tipoDocumental: r.tipo_documental,
    descripcion: r.descripcion,
    serieId: r.serie_id,
    dependenciaId: r.dependencia_id,
    entidadId: r.entidad_id,
  };
}

function mapSubserieToDB(r) {
  return {
    id: r.id,
    nombre: r.nombre,
    codigo: r.codigo,
    tipo_documental: r.tipoDocumental,
    descripcion: r.descripcion,
    serie_id: r.serieId,
    dependencia_id: r.dependenciaId,
    entidad_id: r.entidadId || null,
  };
}

function mapTRDFromDB(r) {
  return {
    id: r.id,
    dependenciaId: r.dependencia_id,
    serieId: r.serie_id,
    subserieId: r.subserie_id,
    entidadId: r.entidad_id,
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
  };
}

function mapTRDToDB(r) {
  return {
    id: r.id,
    dependencia_id: r.dependenciaId,
    serie_id: r.serieId,
    subserie_id: r.subserieId || null,
    entidad_id: r.entidadId || null,
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
