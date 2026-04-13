/**
 * PRINT PORTAL — Zoom 100% basado en ancho real, multi-página sin recorte.
 *
 * Flujo:
 * 1. Clonar TRD en iframe oculto (ancho = carta real = 816px)
 * 2. Medir scrollWidth del contenido renderizado
 * 3. zoom = anchoDisponible / scrollWidth  (solo ancho controla la escala)
 * 4. Aplicar CSS zoom (afecta layout, no solo visual)
 * 5. Centrar con flexbox DESPUÉS del zoom
 * 6. El alto escala proporcionalmente → multi-página automático
 */
export const handleExportPDFGeneral = (elementId, filename) => {
  var elementId_ = elementId || 'trd-final-report-area';
  var filename_  = filename  || 'Reporte_TRD';

  var rep = document.getElementById(elementId_);
  if (!rep) {
    console.error('[PDF] Elemento "' + elementId_ + '" no encontrado.');
    return;
  }

  var safeTitle = filename_.replace(/[^a-z0-9_\-]/gi, '_');

  // ── Recolectar CSS del documento principal ─────────────────────────────
  var styleLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map(function (l) { return '<link rel="stylesheet" href="' + l.href + '">'; })
    .join('\n');
  var styleBlocks = Array.from(document.querySelectorAll('style'))
    .map(function (s) { return '<style>' + s.textContent + '</style>'; })
    .join('\n');

  // ── Clonar contenido ───────────────────────────────────────────────────
  var clone = rep.cloneNode(true);
  clone.querySelectorAll('.no-export').forEach(function (el) { el.remove(); });
  var contentHTML = clone.outerHTML;

  // ── Dimensiones de la hoja (mm y px a 96 DPI) ─────────────────────────
  // Carta con @page margin 10mm → área útil = 195.9 × 259.4 mm
  var MARGIN_MM   = 10;
  var PAGE_W_MM   = 215.9;
  var AVAIL_W_MM  = PAGE_W_MM - MARGIN_MM * 2;          // 195.9 mm
  var AVAIL_W_PX  = Math.round(AVAIL_W_MM * 96 / 25.4); // ~741 px
  var LETTER_W_PX = Math.round(PAGE_W_MM  * 96 / 25.4); // ~816 px

  // Estos valores se inyectan en el script del iframe
  var AW = String(AVAIL_W_PX);

  // ── HTML del portal de impresión ──────────────────────────────────────
  var printHTML = ''
    + '<!DOCTYPE html><html lang="es"><head>'
    + '<meta charset="UTF-8"><title>' + safeTitle + '</title>'
    + styleLinks + '\n' + styleBlocks

    + '<style>'

    /* Página carta con margen uniforme */
    + '@page{size:letter portrait;margin:' + MARGIN_MM + 'mm;}'

    /* Reset mínimo */
    + '*,*::before,*::after{box-sizing:border-box;}'
    + 'html{margin:0!important;padding:0!important;}'
    + 'body{'
    + '  margin:0!important;padding:0!important;'
    + '  background:#fff!important;'
    /* Centrado horizontal: el root queda centrado dentro del área útil */
    + '  display:flex;flex-direction:column;align-items:center;'
    + '}'

    /* El root se renderiza a su ancho natural primero (max-w-[215mm] del interior) */
    + '#ose-root{}'

    /* Limpiar decoraciones de UI */
    + '#ose-root [class*="shadow"]{box-shadow:none!important;}'
    + '#ose-root .sticky{position:static!important;}'
    + '#ose-root .no-export{display:none!important;}'

    + '</style></head><body>'
    + '<div id="ose-root">' + contentHTML + '</div>'

    + '<script>'
    /* Escalar SOLO por ancho → sin recorte derecha, altura fluye a páginas */
    + 'window.addEventListener("load",function(){'
    + '  var root=document.getElementById("ose-root");'
    + '  if(!root)return;'
    + '  var availW=' + AW + ';'
    + '  var contentW=root.scrollWidth;'
    /* Si el contenido cabe, zoom=1 (sin reducción); si se pasa, reducir */
    + '  var zoom=(contentW>0)?Math.min(availW/contentW,1):1;'
    /* CSS zoom afecta el layout → el browser pagina correctamente */
    + '  root.style.zoom=String(zoom);'
    /* Forzar reflow antes de imprimir */
    + '  root.getBoundingClientRect();'
    + '  setTimeout(function(){window.print();},500);'
    + '});'
    + '<\/script>'
    + '</body></html>';

  // ── Crear iframe fuera de pantalla con ancho real de carta ────────────
  var iframe = document.createElement('iframe');
  iframe.setAttribute('title', 'Print Portal TRD');
  iframe.style.cssText = ''
    + 'position:fixed;'
    + 'top:0;'
    + 'left:-' + (LETTER_W_PX + 50) + 'px;' /* Fuera de la pantalla hacia la izquierda */
    + 'width:'  + LETTER_W_PX + 'px;'        /* Ancho real de carta → scrollWidth preciso */
    + 'height:3000px;'                         /* Alto generoso para contenido largo */
    + 'border:none;opacity:0;pointer-events:none;z-index:-1;';

  document.body.appendChild(iframe);

  var iDoc = iframe.contentDocument || iframe.contentWindow.document;
  iDoc.open();
  iDoc.write(printHTML);
  iDoc.close();

  // ── Limpieza automática ────────────────────────────────────────────────
  setTimeout(function () {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
      console.log('[PDF] iframe de impresión eliminado.');
    }
  }, 90000); // 90s timeout de seguridad
};
