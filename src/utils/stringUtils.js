/**
 * Normaliza textos para comparaciones robustas.
 * - Elimina acentos
 * - Convierte a mayúsculas
 * - Elimina espacios en blanco innecesarios
 */
export const normalizeText = (text) => {
  if (!text) return "";
  return text.toString()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
};
