/**
 * PRINT PORTAL — sin zoom, ajuste exacto al área imprimible.
 *
 * Estrategia:
 *   1. Clonar el elemento destino
 *   2. Ajustar el ancho de cada sección TRD al área imprimible exacta
 *      (elimina el corte derecho que producía CSS zoom en iframe)
 *   3. Convertir imágenes externas a base64 (evita errores CORS)
 *   4. Escribir en iframe oculto y disparar window.print()
 *
 * Tamaños soportados (todos a 96 DPI):
 *   letter  215.9 × 279.4 mm
 *   legal   215.9 × 355.6 mm
 *   a4      210.0 × 297.0 mm
 */

const PAPER = {
  letter: { w: 215.9, h: 279.4, css: 'letter' },
  legal:  { w: 215.9, h: 355.6, css: 'legal'  },
  a4:     { w: 210.0, h: 297.0, css: 'A4'     },
};

const MARGIN_MM = 5; // margen @page en mm (el padding interno de las secciones añade ~8mm más)

// ── helpers ──────────────────────────────────────────────────────────────────

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload  = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

async function inlineImages(rootEl) {
  const imgs = Array.from(rootEl.querySelectorAll('img[src]'));
  await Promise.all(imgs.map(async (img) => {
    const src = img.getAttribute('src');
    if (!src || src.startsWith('data:')) return;
    try {
      const resp = await fetch(src);
      if (!resp.ok) return;
      img.src = await blobToDataUrl(await resp.blob());
      img.removeAttribute('crossorigin');
      img.removeAttribute('crossOrigin');
    } catch (e) {
      console.warn('[PDF] No se pudo incrustar imagen:', src);
    }
  }));
}

// ── export principal ─────────────────────────────────────────────────────────

export const handleExportPDFGeneral = async (elementId, filename, orientation, paperSize) => {
  const elementId_ = elementId   || 'trd-final-report-area';
  const filename_  = filename    || 'Reporte_TRD';
  const orient_    = orientation || 'landscape';
  const paper      = PAPER[paperSize] || PAPER.letter;

  const rep = document.getElementById(elementId_);
  if (!rep) {
    console.error('[PDF] Elemento "' + elementId_ + '" no encontrado.');
    return;
  }

  // ── Dimensiones exactas ────────────────────────────────────────────────────
  // Ancho de página en la orientación elegida
  const PAGE_W_MM  = orient_ === 'landscape' ? paper.h : paper.w;
  // Área imprimible = página – márgenes izq+der
  const AVAIL_W_MM = PAGE_W_MM - MARGIN_MM * 2;
  const SHEET_W_PX = Math.round(PAGE_W_MM  * 96 / 25.4);

  // ── Clonar contenido ──────────────────────────────────────────────────────
  const clone = rep.cloneNode(true);
  clone.querySelectorAll('.no-export').forEach(el => el.remove());

  // Eliminar el zoom interactivo del capture frame (no debe afectar el PDF)
  const captureFrame = clone.querySelector('#trd-capture-frame');
  if (captureFrame) {
    captureFrame.style.transform    = 'none';
    captureFrame.style.transition   = 'none';
    captureFrame.style.marginBottom = '0';
    captureFrame.style.padding      = '0';
    captureFrame.style.gap          = '0';
    captureFrame.style.overflow     = 'visible';
  }
  // El padre del captureFrame puede tener overflow:auto — eliminarlo
  if (captureFrame && captureFrame.parentElement) {
    captureFrame.parentElement.style.overflow = 'visible';
  }

  // ── Ajustar secciones al área imprimible ──────────────────────────────────
  // Cada sección TRD tiene width:"277mm" (landscape) o "210mm" (portrait)
  // como estilo inline. Lo reemplazamos con el área imprimible exacta para
  // que la tabla llene la hoja sin cortes ni escalado.
  const availWmmStr = AVAIL_W_MM.toFixed(2) + 'mm';
  clone.querySelectorAll('[id^="trd-report-section-"]').forEach(el => {
    el.style.width  = availWmmStr;
    el.style.margin = '0';
    // En portrait, el padding horizontal de la sección (8 mm por lado) consume
    // demasiado del ancho ya reducido. Se elimina para que la tabla ocupe todo
    // el área imprimible; el margen @page (5 mm) ya aleja el contenido del borde.
    if (orient_ === 'portrait') {
      el.style.paddingLeft  = '0';
      el.style.paddingRight = '0';
    }
  });

  // ── Convertir imágenes externas a base64 ─────────────────────────────────
  await inlineImages(clone);

  const contentHTML = clone.outerHTML;

  // ── Recolectar estilos del documento principal ────────────────────────────
  const styleLinks = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map(l => '<link rel="stylesheet" href="' + l.href + '">')
    .join('\n');
  const styleBlocks = Array.from(document.querySelectorAll('style'))
    .map(s => '<style>' + s.textContent + '</style>')
    .join('\n');

  const safeTitle = filename_.replace(/[^a-z0-9_\-]/gi, '_');

  // ── HTML del portal de impresión ──────────────────────────────────────────
  const printHTML = ''
    + '<!DOCTYPE html><html lang="es"><head>'
    + '<meta charset="UTF-8"><title>' + safeTitle + '</title>'
    + styleLinks + '\n' + styleBlocks

    + '<style>'

    // Hoja con orientación y tamaño seleccionados
    + '@page{'
    + '  size:' + paper.css + ' ' + orient_ + ';'
    + '  margin:' + MARGIN_MM + 'mm;'
    + '}'

    // Reset
    + '*,*::before,*::after{box-sizing:border-box;}'
    + 'html,body{margin:0!important;padding:0!important;background:#fff!important;}'
    + 'body{display:block;}'

    // Contenedor raíz
    + '#ose-root{width:100%;background:#fff!important;}'
    + '#ose-root .no-export{display:none!important;}'
    + '#ose-root .sticky{position:static!important;}'

    // Fondos grises → blanco en impresión
    + '.bg-slate-100,.bg-slate-50,.bg-gray-100{'
    + '  background-color:#fff!important;'
    + '}'

    // Sombras fuera en impresión
    + '[class*="shadow"]{box-shadow:none!important;}'

    // Imágenes nítidas y colores exactos
    + 'img{'
    + '  image-rendering:-webkit-optimize-contrast;'
    + '  image-rendering:crisp-edges;'
    + '  print-color-adjust:exact;'
    + '  -webkit-print-color-adjust:exact;'
    + '  max-width:100%;'
    + '}'

    // Saltos de página en tablas
    + 'table{page-break-inside:auto;}'
    + 'tr{page-break-inside:avoid;page-break-after:auto;}'
    + 'thead{display:table-header-group;}'

    + '</style></head><body>'
    + '<div id="ose-root">' + contentHTML + '</div>'

    + '<script>'
    + 'window.addEventListener("load",function(){'
    + '  document.getElementById("ose-root").getBoundingClientRect();'
    + '  setTimeout(function(){window.print();},600);'
    + '});'
    + '<\/script>'
    + '</body></html>';

  // ── Iframe oculto fuera de pantalla ───────────────────────────────────────
  const iframe = document.createElement('iframe');
  iframe.setAttribute('title', 'Print Portal TRD — ' + orient_);
  iframe.style.cssText = ''
    + 'position:fixed;'
    + 'top:0;'
    + 'left:-' + (SHEET_W_PX + 400) + 'px;'
    + 'width:'  + SHEET_W_PX + 'px;'
    + 'height:5000px;'
    + 'border:none;'
    + 'opacity:0;'
    + 'pointer-events:none;'
    + 'z-index:-1;';

  document.body.appendChild(iframe);

  const iDoc = iframe.contentDocument || iframe.contentWindow.document;
  iDoc.open();
  iDoc.write(printHTML);
  iDoc.close();

  // Limpieza automática
  setTimeout(function () {
    if (document.body.contains(iframe)) document.body.removeChild(iframe);
  }, 120000);
};
