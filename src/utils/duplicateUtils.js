import { normalizeText } from './stringUtils';

/**
 * Compara dos dependencias para detectar si son duplicados exactos.
 * Criterios: entidad_id, código, nombre, sigla (opcional), padre (opcional).
 */
export const isDuplicateDependencia = (newDep, existingDep) => {
  // Siempre comparar dentro de la misma entidad
  if (String(newDep.entidadId) !== String(existingDep.entidadId)) return false;

  const codeMatch = normalizeText(newDep.codigo) === normalizeText(existingDep.codigo);
  const nameMatch = normalizeText(newDep.nombre) === normalizeText(existingDep.nombre);
  
  // Sigla y padre son opcionales pero si están deben coincidir para ser "exacto"
  const siglaMatch = normalizeText(newDep.sigla) === normalizeText(existingDep.sigla);
  const parentMatch = String(newDep.dependeDe || "") === String(existingDep.dependeDe || "");

  return codeMatch && nameMatch && siglaMatch && parentMatch;
};

/**
 * Compara dos series.
 * Criterios: entidad_id, dependenciaId, código, nombre.
 */
export const isDuplicateSerie = (newSerie, existingSerie) => {
  if (String(newSerie.entidadId) !== String(existingSerie.entidadId)) return false;
  if (String(newSerie.dependenciaId) !== String(existingSerie.dependenciaId)) return false;

  const codeMatch = normalizeText(newSerie.codigo) === normalizeText(existingSerie.codigo);
  const nameMatch = normalizeText(newSerie.nombre) === normalizeText(existingSerie.nombre);

  return codeMatch && nameMatch;
};

/**
 * Compara dos subseries.
 * Criterios: entidad_id, dependenciaId, serieId, código, nombre.
 */
export const isDuplicateSubserie = (newSub, existingSub) => {
  if (String(newSub.entidadId) !== String(existingSub.entidadId)) return false;
  if (String(newSub.dependenciaId) !== String(existingSub.dependenciaId)) return false;
  if (String(newSub.serieId) !== String(existingSub.serieId)) return false;

  const codeMatch = normalizeText(newSub.codigo) === normalizeText(existingSub.codigo);
  const nameMatch = normalizeText(newSub.nombre) === normalizeText(existingSub.nombre);

  return codeMatch && nameMatch;
};

/**
 * Compara dos registros TRD.
 */
export const isDuplicateTRD = (newTrd, existingTrd) => {
  if (String(newTrd.entidadId) !== String(existingTrd.entidadId)) return false;
  if (String(newTrd.dependenciaId) !== String(existingTrd.dependenciaId)) return false;
  if (String(newTrd.serieId) !== String(existingTrd.serieId)) return false;
  
  // Manejo de subserie opcional
  const subMatch = String(newTrd.subserieId || "") === String(existingTrd.subserieId || "");
  
  // Comparación de campos clave de valoración
  const retencionMatch = 
    parseInt(newTrd.retencionGestion) === parseInt(existingTrd.retencionGestion) &&
    parseInt(newTrd.retencionCentral) === parseInt(existingTrd.retencionCentral);
    
  const procMatch = normalizeText(newTrd.procedimiento) === normalizeText(existingTrd.procedimiento);
  
  // Disposición final
  const dispMatch = 
    !!newTrd['disp_Conservación total'] === !!existingTrd['disp_Conservación total'] &&
    !!newTrd['disp_Eliminación'] === !!existingTrd['disp_Eliminación'] &&
    !!newTrd['disp_Selección'] === !!existingTrd['disp_Selección'];

  return subMatch && retencionMatch && procMatch && dispMatch;
};

/**
 * Busca si un registro ya existe en un listado (pool).
 */
export const findDuplicate = (record, pool, type) => {
  if (!pool || !Array.isArray(pool)) return null;
  
  return pool.find(existing => {
    // Si estamos editando, ignorar el propio registro
    if (record.id && String(existing.id) === String(record.id)) return false;
    
    if (type === 'dependencias') return isDuplicateDependencia(record, existing);
    if (type === 'series') return isDuplicateSerie(record, existing);
    if (type === 'subseries') return isDuplicateSubserie(record, existing);
    if (type === 'TRD' || type === 'trdform') return isDuplicateTRD(record, existing);
    return false;
  });
};
