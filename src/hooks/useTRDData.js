import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import API_BASE_URL from '../config/api';

export function useTRDData(userId = null) {
  const [dependencias, setDependencias] = useState([]);
  const [series, setSeries] = useState([]);
  const [subseries, setSubseries] = useState([]);
  const [trdRecords, setTrdRecords] = useState([]);
  const [imports, setImports] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSynced, setIsSynced] = useState(false);

  const loadData = async () => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }
    
    setIsLoading(true);
    try {
      const [d, s, ss, trd, impData] = await Promise.all([
        supabase.from('dependencias').select('*').order('codigo'),
        supabase.from('series').select('*').order('codigo'),
        supabase.from('subseries').select('*').order('codigo'),
        supabase.from('trd_records').select('*'),
        fetch(`${API_BASE_URL}/imports`).then(r => r.json())
      ]);

      if (d.data) setDependencias(d.data.map(mapDependenciaFromDB));
      if (s.data) setSeries(s.data.map(mapSerieFromDB));
      if (ss.data) setSubseries(ss.data.map(mapSubserieFromDB));
      if (trd.data) setTrdRecords(trd.data.map(mapTRDFromDB));
      if (Array.isArray(impData)) setImports(impData);
      
      setIsSynced(true);
    } catch (err) {
      console.error('Error loading TRD data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Load all data from Supabase when userId changes (especially on login)
  useEffect(() => {
    loadData();
  }, [userId]);

  const refreshData = () => loadData();

  // ─── CRUD Dependencias ──────────────────────────────────────────────────────
  const addDependencia = async (data) => {
    const newRecord = { ...data, id: data.id || Date.now().toString() };
    
    // Optimistic Update
    setDependencias(prev => {
      const exists = prev.find(x => x.id === newRecord.id);
      return exists ? prev.map(x => x.id === newRecord.id ? newRecord : x) : [...prev, newRecord];
    });

    if (supabase) {
      const { error } = await supabase.from('dependencias').upsert(mapDependenciaToDB(newRecord));
      if (error) {
        console.error('❌ Supabase error (dependencia):', error);
        throw error;
      }
    }
    return newRecord;
  };

  const updateDependencia = async (id, data) => {
     setDependencias(prev => prev.map(x => x.id === id ? { ...x, ...data } : x));
     if (supabase) {
       const { error } = await supabase.from('dependencias').update(mapDependenciaToDB(data)).eq('id', id);
       if (error) throw error;
     }
  };

  const deleteDependencia = async (id) => {
    setDependencias(prev => prev.filter(x => x.id !== id));
    if (supabase) {
      const { error } = await supabase.from('dependencias').delete().eq('id', id);
      if (error) throw error;
    }
  };

  // ─── CRUD Series ────────────────────────────────────────────────────────────
  const addSerie = async (data) => {
    const newRecord = { ...data, id: data.id || Date.now().toString() };
    setSeries(prev => {
      const exists = prev.find(x => x.id === newRecord.id);
      return exists ? prev.map(x => x.id === newRecord.id ? newRecord : x) : [...prev, newRecord];
    });

    if (supabase) {
      const { error } = await supabase.from('series').upsert(mapSerieToDB(newRecord));
      if (error) throw error;
    }
    return newRecord;
  };

  const deleteSerie = async (id) => {
    setSeries(prev => prev.filter(x => x.id !== id));
    if (supabase) {
      const { error } = await supabase.from('series').delete().eq('id', id);
      if (error) throw error;
    }
  };

  // ─── CRUD Subseries ─────────────────────────────────────────────────────────
  const addSubserie = async (data) => {
    const newRecord = { ...data, id: data.id || Date.now().toString() };
    setSubseries(prev => {
      const exists = prev.find(x => x.id === newRecord.id);
      return exists ? prev.map(x => x.id === newRecord.id ? newRecord : x) : [...prev, newRecord];
    });

    if (supabase) {
      const { error } = await supabase.from('subseries').upsert(mapSubserieToDB(newRecord));
      if (error) throw error;
    }
    return newRecord;
  };

  const deleteSubserie = async (id) => {
    setSubseries(prev => prev.filter(x => x.id !== id));
    if (supabase) {
      const { error } = await supabase.from('subseries').delete().eq('id', id);
      if (error) throw error;
    }
  };

  // ─── CRUD TRD Records ───────────────────────────────────────────────────────
  const addTrdRecord = async (data) => {
    const newRecord = { ...data, id: data.id || Date.now().toString() };
    setTrdRecords(prev => {
      const exists = prev.find(x => x.id === newRecord.id);
      return exists ? prev.map(x => x.id === newRecord.id ? newRecord : x) : [...prev, newRecord];
    });

    if (supabase) {
      const { error } = await supabase.from('trd_records').upsert(mapTRDToDB(newRecord));
      if (error) throw error;
    }
    return newRecord;
  };

  return {
    dependencias, series, subseries, trdRecords,
    isLoading, isSynced,
    setDependencias, setSeries, setSubseries, setTrdRecords,
    addDependencia, updateDependencia, deleteDependencia,
    addSerie, deleteSerie,
    addSubserie, deleteSubserie,
    addTrdRecord, refreshData,
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
    entidadId: d.entidad_id // Match backend
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
    entidad_id: d.entidadId || d.entityId || null // Match backend
  };
}

function mapSerieFromDB(s) {
  return {
    id: s.id,
    nombre: s.nombre,
    codigo: s.codigo,
    dependenciaId: s.dependencia_id,
    entidadId: s.entidad_id,
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
    entidadId: s.entidad_id,
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
