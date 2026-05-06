/**
 * Normaliza textos para comparaciones robustas.
 * - Elimina acentos
 * - Convierte a mayúsculas
 * - Elimina espacios en blanco innecesarios
 */
export const normalizeText = (text) => {
  if (text === null || text === undefined) return "";
  return text.toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // Elimina tildes
    .replace(/\s+/g, ' ')           // Colapsa múltiples espacios internos a uno solo
    .trim()                         // Elimina espacios al inicio y final
    .toUpperCase();
};
