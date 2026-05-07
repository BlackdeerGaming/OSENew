import { normalizeText } from './stringUtils';

/**
 * Compara dos dependencias para detectar si son duplicados exactos.
 * Criterios: entidad_id, código, nombre, sigla (opcional), padre (opcional).
 */
/**
 * Compara dos dependencias para detectar si hay colisión de código.
 * Regla: El código debe ser único dentro de la misma entidad.
 */
export const isDuplicateDependencia = (newDep, existingDep) => {
  if (String(newDep.entidadId) !== String(existingDep.entidadId)) return false;
  return normalizeText(newDep.codigo) === normalizeText(existingDep.codigo);
};

/**
 * Compara dos series para detectar colisión.
 * Regla: El código de serie es único DENTRO de la misma dependencia.
 */
export const isDuplicateSerie = (newSerie, existingSerie) => {
  if (String(newSerie.entidadId) !== String(existingSerie.entidadId)) return false;
  if (String(newSerie.dependenciaId) !== String(existingSerie.dependenciaId)) return false;
  return normalizeText(newSerie.codigo) === normalizeText(existingSerie.codigo);
};

/**
 * Compara dos subseries para detectar colisión.
 * Regla: El código de subserie es único DENTRO de la misma serie y dependencia.
 */
export const isDuplicateSubserie = (newSub, existingSub) => {
  if (String(newSub.entidadId) !== String(existingSub.entidadId)) return false;
  if (String(newSub.dependenciaId) !== String(existingSub.dependenciaId)) return false;
  if (String(newSub.serieId) !== String(existingSub.serieId)) return false;
  return normalizeText(newSub.codigo) === normalizeText(existingSub.codigo);
};

/**
 * Compara dos registros TRD para detectar duplicados exactos de valoración.
 */
export const isDuplicateTRD = (newTrd, existingTrd) => {
  if (String(newTrd.entidadId) !== String(existingTrd.entidadId)) return false;
  if (String(newTrd.dependenciaId) !== String(existingTrd.dependenciaId)) return false;
  if (String(newTrd.serieId) !== String(existingTrd.serieId)) return false;
  
  // Manejo de subserie opcional
  const subMatch = String(newTrd.subserieId || "") === String(existingTrd.subserieId || "");
  
  // Si coinciden en jerarquía (Dep/Ser/Sub), verificamos si los datos de valoración son iguales
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
