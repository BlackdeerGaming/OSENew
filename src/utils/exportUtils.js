/**
 * PRINT PORTAL con ZOOM DINÁMICO
 *
 * Estrategia:
 * 1. Clonar el contenido en un iframe con ancho real de carta (816px)
 * 2. Medir la altura total del contenido renderizado
 * 3. Calcular zoom = alturaDisponible / alturaContenido
 * 4. Aplicar CSS zoom (afecta layout, a diferencia de transform:scale)
 * 5. Imprimir → todo cabe en una sola página centrada
 *
 * Sin html2canvas → sin errores OKLCH.
 * El centrado y escalado ocurren vía CSS, no vía JavaScript math.
 */
export const handleExportPDFGeneral = (elementId, filename = 'Reporte_TRD') => {
  const reportElement = document.getElementById(elementId);
  if (!reportElement) {
    console.error('[PDF Export] Elemento "' + elementId + '" no encontrado.');
    return;
  }

  const safeTitle = (filename || 'Reporte_TRD').replace(/[^a-z0-9_\-]/gi, '_');

  // ── 1. Recolectar CSS del documento actual ─────────────────────────────
  const styleSheets = [
    ...Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .map(function (l) { return '<link rel="stylesheet" href="' + l.href + '">'; }),
    ...Array.from(document.querySelectorAll('style'))
      .map(function (s) { return '<style>' + s.textContent + '</style>'; })
  ].join('\n');

  // ── 2. Clonar contenido del reporte ───────────────────────────────────
  var clone = reportElement.cloneNode(true);
  clone.querySelectorAll('.no-export').forEach(function (el) { el.remove(); });

  // ── 3. Dimensiones de la hoja carta (mm y px a 96 DPI) ────────────────
  var MARGIN_MM    = 10;
  var PAGE_W_MM    = 215.9;
  var PAGE_H_MM    = 279.4;
  var AVAIL_W_MM   = PAGE_W_MM - MARGIN_MM * 2;  // 195.9 mm
  var AVAIL_H_MM   = PAGE_H_MM - MARGIN_MM * 2;  // 259.4 mm
  var MM2PX        = 96 / 25.4;
  var AVAIL_W_PX   = Math.round(AVAIL_W_MM * MM2PX); // ~741 px
  var AVAIL_H_PX   = Math.round(AVAIL_H_MM * MM2PX); // ~981 px
  var LETTER_W_PX  = Math.round(PAGE_W_MM  * MM2PX); // ~816 px

  // Datos embebidos en el script interno del iframe
  var AVAIL_W_MM_STR = AVAIL_W_MM.toFixed(1);
  var AVAIL_H_MM_STR = AVAIL_H_MM.toFixed(1);
  var AVAIL_W_PX_STR = String(AVAIL_W_PX);
  var AVAIL_H_PX_STR = String(AVAIL_H_PX);

  // ── 4. Construir HTML de impresión ────────────────────────────────────
  var contentHTML = clone.outerHTML;

  var printStyles = [
    '@page {',
    '  size: letter portrait;',
    '  margin: ' + MARGIN_MM + 'mm;',
    '}',
    '*, *::before, *::after { box-sizing: border-box; }',
    'html, body {',
    '  margin: 0 !important;',
    '  padding: 0 !important;',
    '  background: #ffffff !important;',
    '  width: ' + AVAIL_W_MM_STR + 'mm;',
    '}',
    'body {',
    '  display: flex;',
    '  justify-content: center;',
    '  align-items: flex-start;',
    '}',
    '#ose-root {',
    '  width: ' + AVAIL_W_MM_STR + 'mm;',
    '  transform-origin: top center;', // fallback si zoom no está soportado
    '}',
    '#ose-root [class*="shadow"] { box-shadow: none !important; }',
    '#ose-root .sticky          { position: static !important; }',
    '#ose-root .no-export       { display: none !important; }',
  ].join('\n');

  var inlineScript = [
    'window.addEventListener("load", function() {',
    '  var root = document.getElementById("ose-root");',
    '  if (!root) return;',
    '',
    '  var contentH = root.scrollHeight;',
    '  var contentW = root.scrollWidth;',
    '  var availH   = ' + AVAIL_H_PX_STR + ';',
    '  var availW   = ' + AVAIL_W_PX_STR + ';',
    '',
    '  // Calcular zoom para que el contenido completo entre en una página',
    '  var zoomH = availH / contentH;',
    '  var zoomW = availW / contentW;',
    '  var zoom  = Math.min(zoomH, zoomW, 1); // nunca agrandar',
    '',
    '  if (zoom < 1) {',
    '    // CSS zoom afecta el layout (a diferencia de transform:scale)',
    '    // Por lo tanto el contenedor encoge y no hay overflow de página',
    '    root.style.zoom = String(zoom);',
    '  }',
    '',
    '  setTimeout(function() { window.print(); }, 400);',
    '});',
  ].join('\n');

  var printHTML = '<!DOCTYPE html>\n'
    + '<html lang="es">\n'
    + '<head>\n'
    + '  <meta charset="UTF-8">\n'
    + '  <title>' + safeTitle + '</title>\n'
    + styleSheets + '\n'
    + '  <style>\n' + printStyles + '\n  </style>\n'
    + '</head>\n'
    + '<body>\n'
    + '  <div id="ose-root">' + contentHTML + '</div>\n'
    + '  <script>\n' + inlineScript + '\n  <\/script>\n'
    + '</body>\n'
    + '</html>';

  // ── 5. Iframe con ancho real de carta para medición correcta ──────────
  var iframe = document.createElement('iframe');
  iframe.setAttribute('title', 'Print Portal TRD');
  // Debe tener el ancho real de la hoja para que scrollHeight sea preciso
  iframe.style.position   = 'fixed';
  iframe.style.top        = '0';
  iframe.style.left       = '-' + (LETTER_W_PX + 30) + 'px'; // Fuera de pantalla
  iframe.style.width      = LETTER_W_PX + 'px';
  iframe.style.height     = '2400px';  // Alto generoso para contenido largo
  iframe.style.border     = 'none';
  iframe.style.opacity    = '0';
  iframe.style.pointerEvents = 'none';
  iframe.style.zIndex     = '-999';
  document.body.appendChild(iframe);

  // ── 6. Escribir documento en iframe ───────────────────────────────────
  var iDoc = iframe.contentDocument || iframe.contentWindow.document;
  iDoc.open();
  iDoc.write(printHTML);
  iDoc.close();

  // ── 7. Limpieza automática ─────────────────────────────────────────────
  setTimeout(function () {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }
  }, 60000); // 60s de seguridad
};
