import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

/**
 * Genera un PDF tamaño Carta con márgenes de 10mm en los 4 lados.
 * La imagen capturada se coloca en el área interna sin deformaciones.
 * @param {string} elementId - ID del elemento a capturar.
 * @param {string} filename  - Nombre del archivo PDF resultante.
 */
export const handleExportPDFGeneral = async (elementId, filename = 'Reporte_TRD') => {
  const reportElement = document.getElementById(elementId);

  if (!reportElement) {
    console.error(`[PDF Export] Elemento "${elementId}" no encontrado.`);
    return;
  }

  try {
    const safeFilename = (typeof filename === 'string' && filename.length > 0)
      ? filename.replace(/[^a-z0-9]/gi, '_')
      : 'Reporte_TRD';

    // ── 1. CAPTURA LIMPIA ──────────────────────────────────────────────────
    // Capturamos el elemento tal como está, sin trucos de padding.
    const canvas = await html2canvas(reportElement, {
      scale: 3,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      height: reportElement.scrollHeight,
      windowHeight: reportElement.scrollHeight,
    });

    const imgData = canvas.toDataURL('image/png');

    // ── 2. CONFIGURACIÓN DEL PDF (Carta) ───────────────────────────────────
    const pdf = new jsPDF('p', 'mm', 'letter');
    const pageW = pdf.internal.pageSize.getWidth();   // 215.9 mm
    const pageH = pdf.internal.pageSize.getHeight();  // 279.4 mm

    // ── 3. ZONA SEGURA CON MARGEN DE 10mm ─────────────────────────────────
    const MARGIN = 10; // mm en los 4 lados
    const areaW = pageW - MARGIN * 2; // área disponible horizontal
    const areaH = pageH - MARGIN * 2; // área disponible vertical

    // ── 4. ESCALAR SIN DEFORMAR ────────────────────────────────────────────
    // Calculamos cuántos mm ocupa 1 píxel de imagen para caber en el área.
    const imgW = canvas.width;
    const imgH = canvas.height;

    const scaleX = areaW / imgW;
    const scaleY = areaH / imgH;
    const scale  = Math.min(scaleX, scaleY); // el más restrictivo garantiza que cabe

    const renderW = imgW * scale;
    const renderH = imgH * scale;

    // ── 5. CENTRAR DENTRO DEL ÁREA SEGURA ─────────────────────────────────
    // El margen de 10mm es el punto de origen; centramos dentro del área restante.
    const x = MARGIN + (areaW - renderW) / 2;
    const y = MARGIN + (areaH - renderH) / 2;

    // ── 6. INSERTAR IMAGEN Y GUARDAR ───────────────────────────────────────
    pdf.addImage(imgData, 'PNG', x, y, renderW, renderH);
    pdf.save(`${safeFilename}.pdf`);

    console.log(`[PDF Export] ✓ ${safeFilename}.pdf — imagen: ${renderW.toFixed(1)}x${renderH.toFixed(1)} mm, margen: ${MARGIN}mm`);

  } catch (err) {
    console.error('[PDF Export] Error técnico:', err);
    window.print();
  }
};
