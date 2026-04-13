/**
 * ESTRATEGIA: Print Portal via iframe silencioso.
 *
 * En lugar de capturar con html2canvas (que falla con OKLCH de Tailwind v4),
 * clonamos el reporte en un iframe oculto con CSS de impresión controlado.
 * El navegador renderiza todo nativamente → sin errores de color.
 * El centrado se logra con CSS puro: @page + flexbox en body.
 *
 * @param {string} elementId  - ID del elemento a imprimir.
 * @param {string} filename   - Nombre sugerido del archivo (solo referencia para el título).
 */
export const handleExportPDFGeneral = (elementId, filename = 'Reporte_TRD') => {
  const reportElement = document.getElementById(elementId);
  if (!reportElement) {
    console.error(`[PDF Export] Elemento "${elementId}" no encontrado.`);
    return;
  }

  const safeTitle = filename.replace(/[^a-z0-9_\-]/gi, '_');

  // ── 1. Recolectar TODOS los estilos del documento actual ──────────────
  // Incluimos tanto <link> como <style> para garantizar que Tailwind
  // y cualquier CSS inyectado dinámicamente queden en el iframe.
  const collectedStyles = [
    ...Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .map(l => `<link rel="stylesheet" href="${l.href}">`),
    ...Array.from(document.querySelectorAll('style'))
      .map(s => `<style>${s.textContent}</style>`)
  ].join('\n');

  // ── 2. Clonar el contenido del reporte ────────────────────────────────
  const clone = reportElement.cloneNode(true);
  // Remover elementos que no deben aparecer en la impresión
  clone.querySelectorAll('.no-export, [class*="no-print"]').forEach(el => el.remove());

  // ── 3. Construir el documento de impresión ────────────────────────────
  const printHTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${safeTitle}</title>
  ${collectedStyles}
  <style>
    /* ─ Página tamaño carta con margen de 12mm en los 4 bordes ─ */
    @page {
      size: letter portrait;
      margin: 12mm;
    }

    /* ─ Reset base ─ */
    *, *::before, *::after { box-sizing: border-box; }

    html, body {
      margin: 0 !important;
      padding: 0 !important;
      width: 100%;
      background: #ffffff !important;
    }

    /* ─ CENTRADO: El contenido se centra horizontalmente en la página ─ */
    body {
      display: flex;
      justify-content: center;
      align-items: flex-start;
    }

    /* ─ Wrapper del reporte: ocupa el 100% del área de impresión ─ */
    #ose-print-root {
      width: 100%;
      max-width: 191.9mm; /* letter (215.9mm) - 2 * 12mm margen */
    }

    /* ─ Limpiar decoraciones de UI que no son parte del documento ─ */
    #ose-print-root [class*="shadow"] { box-shadow: none !important; }
    #ose-print-root .sticky         { position: static !important; }
    #ose-print-root [class*="no-export"] { display: none !important; }

    /* ─ Forzar bordes negros puros (evitar colores problemáticos) ─ */
    #ose-print-root [style*="border"] { border-color: #000 !important; }
  </style>
</head>
<body>
  <div id="ose-print-root">
    ${clone.outerHTML}
  </div>
  <script>
    // Esperar a que todos los recursos carguen antes de imprimir
    window.addEventListener('load', function () {
      setTimeout(function () {
        window.print();
      }, 500);
    });
  </script>
</body>
</html>`;

  // ── 4. Crear iframe completamente oculto ──────────────────────────────
  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', 'Ventana de impresión TRD');
  iframe.style.cssText = `
    position: fixed;
    top: -9999px;
    left: -9999px;
    width: 1px;
    height: 1px;
    border: none;
    opacity: 0;
    pointer-events: none;
  `;
  document.body.appendChild(iframe);

  // ── 5. Escribir el documento en el iframe ─────────────────────────────
  const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
  iframeDoc.open();
  iframeDoc.write(printHTML);
  iframeDoc.close();

  // ── 6. Limpiar el iframe después de un tiempo prudente ────────────────
  const removeIframe = () => {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
      console.log('[PDF Export] iframe de impresión eliminado.');
    }
  };
  // Timeout de seguridad: eliminarlo a los 30s sin importar qué
  setTimeout(removeIframe, 30_000);
};
