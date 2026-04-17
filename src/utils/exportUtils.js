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
export const handleExportPDFGeneral = (elementId, filename, orientation) => {
  var elementId_ = elementId || 'trd-final-report-area';
  var filename_  = filename  || 'Reporte_TRD';
  var orient_    = orientation || 'portrait'; // portrait | landscape

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
  // Carta Portrait:  215.9 x 279.4 mm
  // Carta Landscape: 279.4 x 215.9 mm
  var MARGIN_MM   = 10;
  var PAGE_W_MM   = orient_ === 'landscape' ? 279.4 : 215.9;
  var AVAIL_W_MM  = PAGE_W_MM - MARGIN_MM * 2;
  var AVAIL_W_PX  = Math.round(AVAIL_W_MM * 96 / 25.4);
  var SHEET_W_PX  = Math.round(PAGE_W_MM  * 96 / 25.4);

  // Estos valores se inyectan en el script del iframe
  var AW = String(AVAIL_W_PX);

  // ── HTML del portal de impresión ──────────────────────────────────────
  var printHTML = ''
    + '<!DOCTYPE html><html lang="es"><head>'
    + '<meta charset="UTF-8"><title>' + safeTitle + '</title>'
    + styleLinks + '\n' + styleBlocks

    + '<style>'

    /* Página carta con orientación dinámica */
    + '@page{size:letter ' + orient_ + ';margin:' + MARGIN_MM + 'mm;}'

    /* Reset mínimo */
    + '*,*::before,*::after{box-sizing:border-box;}'
    + 'html{margin:0!important;padding:0!important;}'
    + 'body{'
    + '  margin:0!important;padding:0!important;'
    + '  background:#fff!important;'
    + '  display:flex;flex-direction:column;align-items:center;'
    + '}'

    + '#ose-root{}'
    + '#ose-root [class*="shadow"]{box-shadow:none!important;}'
    + '#ose-root .sticky{position:static!important;}'
    + '#ose-root .no-export{display:none!important;}'

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
    + '  root.getBoundingClientRect();'
    + '  setTimeout(function(){window.print();},500);'
    + '});'
    + '<\/script>'
    + '</body></html>';

  // ── Crear iframe fuera de pantalla ────────────────────────────────────
  var iframe = document.createElement('iframe');
  iframe.setAttribute('title', 'Print Portal TRD');
  iframe.style.cssText = ''
    + 'position:fixed;'
    + 'top:0;'
    + 'left:-' + (SHEET_W_PX + 100) + 'px;'
    + 'width:'  + SHEET_W_PX + 'px;'
    + 'height:3000px;'
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
