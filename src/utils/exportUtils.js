/**
 * PRINT PORTAL — Orientación dinámica con zoom proporcional.
 *
 * Flujo:
 * 1. Clonar el elemento destino en un iframe oculto
 * 2. Inyectar @page con tamaño y orientación correctos
 * 3. Medir scrollWidth del contenido renderizado
 * 4. zoom = anchoDisponible / scrollWidth  (solo el ancho controla la escala)
 * 5. Aplicar CSS zoom (afecta layout real, no solo visual)
 * 6. El alto escala proporcionalmente → multi-página automático
 *
 * Dimensiones carta a 96 DPI:
 *   Portrait  215.9 mm → 816 px
 *   Landscape 279.4 mm → 1056 px
 */
export const handleExportPDFGeneral = (elementId, filename, orientation) => {
  var elementId_ = elementId || 'trd-final-report-area';
  var filename_  = filename  || 'Reporte_TRD';
  var orient_    = orientation || 'landscape'; // landscape por defecto (formato horizontal)

  var rep = document.getElementById(elementId_);
  if (!rep) {
    console.error('[PDF] Elemento "' + elementId_ + '" no encontrado. Asegúrate de que el elemento existe en el DOM.');
    return;
  }

  var safeTitle = filename_.replace(/[^a-z0-9_\-]/gi, '_');

  // ── Recolectar estilos del documento principal ───────────────────────────
  var styleLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map(function (l) { return '<link rel="stylesheet" href="' + l.href + '">'; })
    .join('\n');
  var styleBlocks = Array.from(document.querySelectorAll('style'))
    .map(function (s) { return '<style>' + s.textContent + '</style>'; })
    .join('\n');

  // ── Clonar contenido (eliminar elementos marcados como no-export) ─────────
  var clone = rep.cloneNode(true);
  clone.querySelectorAll('.no-export').forEach(function (el) { el.remove(); });
  var contentHTML = clone.outerHTML;

  // ── Dimensiones de la hoja (mm → px @ 96 DPI) ───────────────────────────
  // Carta Portrait:  215.9 × 279.4 mm
  // Carta Landscape: 279.4 × 215.9 mm
  var MARGIN_MM  = 8;   // margen de hoja en mm
  var PAGE_W_MM  = orient_ === 'landscape' ? 279.4 : 215.9;
  var AVAIL_W_MM = PAGE_W_MM - MARGIN_MM * 2;
  var AVAIL_W_PX = Math.round(AVAIL_W_MM * 96 / 25.4);
  var SHEET_W_PX = Math.round(PAGE_W_MM  * 96 / 25.4);

  var AW = String(AVAIL_W_PX);

  // ── HTML del portal de impresión ─────────────────────────────────────────
  var printHTML = ''
    + '<!DOCTYPE html><html lang="es"><head>'
    + '<meta charset="UTF-8"><title>' + safeTitle + '</title>'
    + styleLinks + '\n' + styleBlocks

    + '<style>'

    /* Hoja carta con orientación dinámica y márgenes controlados */
    + '@page{size:letter ' + orient_ + ';margin:' + MARGIN_MM + 'mm;}'

    /* Reset base */
    + '*,*::before,*::after{box-sizing:border-box;}'
    + 'html{margin:0!important;padding:0!important;}'
    + 'body{'
    + '  margin:0!important;padding:0!important;'
    + '  background:#fff!important;'
    + '  display:flex;flex-direction:column;align-items:flex-start;'
    + '}'

    /* Contenedor raíz */
    + '#ose-root{'
    + '  width:100%;'
    + '}'
    + '#ose-root [class*="shadow"]{box-shadow:none!important;}'
    + '#ose-root .sticky{position:static!important;}'
    + '#ose-root .no-export{display:none!important;}'

    /* Asegurar que la tabla no se corte */
    + 'table{page-break-inside:auto;}'
    + 'tr{page-break-inside:avoid;page-break-after:auto;}'
    + 'thead{display:table-header-group;}'

    + '</style></head><body>'
    + '<div id="ose-root">' + contentHTML + '</div>'

    + '<script>'
    + 'window.addEventListener("load",function(){'
    + '  var root=document.getElementById("ose-root");'
    + '  if(!root)return;'
    + '  var availW=' + AW + ';'
    + '  var contentW=root.scrollWidth;'
    + '  var zoom=(contentW>0)?Math.min(availW/contentW,1):1;'
    + '  root.style.zoom=String(zoom);'
    + '  root.style.transformOrigin="top left";'
    + '  root.getBoundingClientRect();'   /* forzar reflow antes de imprimir */
    + '  setTimeout(function(){window.print();},600);'
    + '});'
    + '<\/script>'
    + '</body></html>';

  // ── Crear iframe fuera de pantalla ────────────────────────────────────────
  var iframe = document.createElement('iframe');
  iframe.setAttribute('title', 'Print Portal TRD — ' + orient_);
  iframe.style.cssText = ''
    + 'position:fixed;'
    + 'top:0;'
    + 'left:-' + (SHEET_W_PX + 200) + 'px;'
    + 'width:'  + SHEET_W_PX + 'px;'
    + 'height:4000px;'
    + 'border:none;opacity:0;pointer-events:none;z-index:-1;';

  document.body.appendChild(iframe);

  var iDoc = iframe.contentDocument || iframe.contentWindow.document;
  iDoc.open();
  iDoc.write(printHTML);
  iDoc.close();

  // ── Limpieza automática (timeout de seguridad) ────────────────────────────
  setTimeout(function () {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
      console.log('[PDF] iframe de impresión eliminado. Orientación: ' + orient_);
    }
  }, 120000); // 2 min de timeout de seguridad
};
