import * as XLSX from 'xlsx';

/**
 * Exporta registros TRD a un archivo Excel (.xlsx)
 * @param {Array} rows - Listado de registros TRD procesados
 * @param {string} filename - Nombre del archivo de salida
 */
export const exportTRDToExcel = (rows, filename = 'Reporte_TRD') => {
  try {
    // 1. Preparar los datos para Excel
    const excelData = rows.map(row => ({
      'DEPENDENCIA': row.dependencia || row.dependenciaNombre || '',
      'CÓDIGO': row.codigo || '',
      'SERIE': row.serie || row.serieNombre || '',
      'SUBSERIE': row.subserie || row.subserieNombre || '',
      'TIPO DOCUMENTAL': row.tipoDocumental || '',
      'RETENCIÓN GESTIÓN (Años)': row.retencionGestion || 0,
      'RETENCIÓN CENTRAL (Años)': row.retencionCentral || 0,
      'DISPOSICIÓN FINAL': row.disposicion || '',
      'REPRODUCCIÓN': row.reproduccion || '',
      'SOPORTE': row.soporte || '',
      'PROCEDIMIENTO': row.procedimiento || ''
    }));

    // 2. Crear el libro y la hoja
    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "TRD_Oficial");

    // 3. Estilo básico (Ajustar anchos de columna)
    const wscols = [
      { wch: 30 }, // Dependencia
      { wch: 15 }, // Código
      { wch: 25 }, // Serie
      { wch: 25 }, // Subserie
      { wch: 30 }, // Tipo Documental
      { wch: 10 }, // AG
      { wch: 10 }, // AC
      { wch: 15 }, // Disposición
      { wch: 20 }, // Reproducción
      { wch: 15 }, // Soporte
      { wch: 50 }  // Procedimiento
    ];
    worksheet['!cols'] = wscols;

    // 4. Generar el archivo y descargarlo
    XLSX.writeFile(workbook, `${filename}.xlsx`);
    
    return true;
  } catch (error) {
    console.error("❌ Error al generar Excel:", error);
    alert("No se pudo generar el archivo Excel. Por favor intenta de nuevo.");
    return false;
  }
};
