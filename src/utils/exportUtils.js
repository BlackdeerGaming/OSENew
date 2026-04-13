/**
 * PRINT PORTAL — Multi-página, centrado via CSS, sin zoom forzado.
 *
 * La TRD se muestra al tamaño natural (o casi) y puede ocupar
 * las páginas que necesite. El centrado es responsabilidad del CSS.
 * Sin html2canvas → sin errores OKLCH.
 */
export const handleExportPDFGeneral = (elementId, filename = 'Reporte_TRD') => {
  var rep = document.getElementById(elementId);
  if (!rep) {
    console.error('[PDF Export] Elemento "' + elementId + '" no encontrado.');
    return;
  }

  var safeTitle = (filename || 'Reporte_TRD').replace(/[^a-z0-9_\-]/gi, '_');

  // ── Recolectar estilos del documento principal ─────────────────────────
  var css = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map(function (l) { return '<link rel="stylesheet" href="' + l.href + '">'; })
    .concat(
      Array.from(document.querySelectorAll('style'))
        .map(function (s) { return '<style>' + s.textContent + '</style>'; })
    ).join('\n');

  // ── Clonar contenido ───────────────────────────────────────────────────
  var clone = rep.cloneNode(true);
  clone.querySelectorAll('.no-export').forEach(function (el) { el.remove(); });

  // ── HTML de impresión ─────────────────────────────────────────────────
  var printHTML = '<!DOCTYPE html>\n'
    + '<html lang="es"><head>\n'
    + '  <meta charset="UTF-8">\n'
    + '  <title>' + safeTitle + '</title>\n'
    + css + '\n'
    + '  <style>\n'

    /* Página carta con márgenes iguales en los 4 bordes */
    + '    @page { size: letter portrait; margin: 12mm; }\n'

    + '    *, *::before, *::after { box-sizing: border-box; }\n'

    + '    html, body {\n'
    + '      margin: 0 !important;\n'
    + '      padding: 0 !important;\n'
    + '      background: #fff !important;\n'
    + '    }\n'

    /* CENTRADO HORIZONTAL OBLIGATORIO */
    + '    body {\n'
    + '      display: flex;\n'
    + '      flex-direction: column;\n'
    + '      align-items: center;\n'
    + '    }\n'

    /* El reporte ocupa el ancho disponible dentro de los márgenes */
    + '    #ose-root {\n'
    + '      width: 191.9mm;\n'   /* 215.9mm - 2×12mm */
    + '      max-width: 100%;\n'
    + '    }\n'

    /* Limpiar decoraciones de UI */
    + '    #ose-root [class*="shadow"] { box-shadow: none !important; }\n'
    + '    #ose-root .sticky          { position: static !important; }\n'
    + '    #ose-root .no-export       { display: none !important; }\n'
    + '  </style>\n'
    + '</head><body>\n'
    + '  <div id="ose-root">' + clone.outerHTML + '</div>\n'
    + '  <script>\n'
    + '    window.addEventListener("load", function() {\n'
    + '      setTimeout(function() { window.print(); }, 500);\n'
    + '    });\n'
    + '  <\/script>\n'
    + '</body></html>';

  // ── Iframe fuera de pantalla con ancho de carta real ──────────────────
  var LETTER_PX = Math.round(215.9 * 96 / 25.4); // ~816px
  var iframe = document.createElement('iframe');
  iframe.setAttribute('title', 'Print Portal TRD');
  iframe.style.cssText = 'position:fixed;top:0;left:-' + (LETTER_PX + 40)
    + 'px;width:' + LETTER_PX + 'px;height:2000px;border:none;opacity:0;pointer-events:none;z-index:-1;';
  document.body.appendChild(iframe);

  var iDoc = iframe.contentDocument || iframe.contentWindow.document;
  iDoc.open();
  iDoc.write(printHTML);
  iDoc.close();

  setTimeout(function () {
    if (document.body.contains(iframe)) document.body.removeChild(iframe);
  }, 60000);
};
