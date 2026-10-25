import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { calcularResumen, calcularResumenPorCuenta } from './resumen.js';
import { calcularResumenPlanillas } from './planillas.js';
import { categoriaPorId } from './categorias.js';
import { aNumero, fechaISOaTexto, formatearCRCPdf, formatearNumero, limpiarNombreArchivo } from '../formato.js';

const MARGEN = 14;
const ANCHO_PAGINA = 210;
const ALTO_PAGINA = 297;
const ANCHO_UTIL = ANCHO_PAGINA - MARGEN * 2;
const LIMITE_INFERIOR = 262;

const TINTA = [15, 23, 42];
const GRIS = [71, 85, 105];
const SUAVE = [100, 116, 139];
const LINEA = [226, 232, 240];

const periodo = (desde, hasta) => {
  if (desde && hasta) return `${fechaISOaTexto(desde)} al ${fechaISOaTexto(hasta)}`;
  if (desde) return `Desde ${fechaISOaTexto(desde)}`;
  if (hasta) return `Hasta ${fechaISOaTexto(hasta)}`;
  return 'Todos los gastos registrados';
};

const nombreCuenta = (cuentas, cuentaId) => {
  if (!cuentaId) return 'Sin cuenta';
  const cuenta = cuentas.find((item) => item.id === cuentaId);
  return cuenta?.nombre ?? 'Cuenta eliminada';
};

/**
 * Crea el PDF del reporte de gastos de un proyecto: resumen, IVA, cuentas,
 * planilla y detalle de facturas.
 * `datos`: { proyecto, facturas, planillas, cuentas, desde, hasta, generadoPor, fecha }
 */
export const crearReporteGastos = (datos, docExistente) => {
  const doc = docExistente ?? new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const {
    proyecto,
    facturas = [],
    planillas = [],
    cuentas = [],
    desde = '',
    hasta = '',
    generadoPor = '',
  } = datos;

  const resumen = calcularResumen(facturas);
  const resumenPlanilla = calcularResumenPlanillas(planillas);
  const totalGastado = resumen.total + resumenPlanilla.total;
  const totalIva = resumen.impuesto;

  let y = 0;

  const nuevaPagina = () => {
    doc.addPage();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...TINTA);
    doc.text('COTIOBRA CR', MARGEN, 16);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...SUAVE);
    doc.text(`Control de gastos · ${proyecto?.nombre ?? 'Proyecto'} (continuación)`, ANCHO_PAGINA - MARGEN, 16, { align: 'right' });
    doc.setDrawColor(...LINEA);
    doc.setLineWidth(0.3);
    doc.line(MARGEN, 19, ANCHO_PAGINA - MARGEN, 19);
    y = 26;
  };

  const asegurarEspacio = (necesario) => {
    if (y + necesario > LIMITE_INFERIOR) nuevaPagina();
  };

  const seccion = (titulo, nota = '') => {
    asegurarEspacio(16);
    y += 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...TINTA);
    doc.text(titulo, MARGEN, y);
    if (nota) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.8);
      doc.setTextColor(...SUAVE);
      doc.text(nota, ANCHO_PAGINA - MARGEN, y, { align: 'right' });
    }
    y += 3;
  };

  const aviso = (texto) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...SUAVE);
    doc.text(texto, MARGEN, y + 5);
    y += 10;
  };

  // ----- Encabezado -----
  doc.setFillColor(...TINTA);
  doc.rect(0, 0, ANCHO_PAGINA, 7, 'F');

  y = 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...TINTA);
  doc.text('COTIOBRA CR', MARGEN, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...SUAVE);
  doc.text('Control de gastos reales de obra', MARGEN, y + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...TINTA);
  doc.text('REPORTE DE GASTOS', ANCHO_PAGINA - MARGEN, y, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...SUAVE);
  doc.text(`Emitido: ${datos.fecha ?? ''}`, ANCHO_PAGINA - MARGEN, y + 5, { align: 'right' });

  doc.setDrawColor(...LINEA);
  doc.setLineWidth(0.4);
  doc.line(MARGEN, y + 10, ANCHO_PAGINA - MARGEN, y + 10);

  // ----- Proyecto -----
  y += 18;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...TINTA);
  doc.text((proyecto?.nombre ?? 'Proyecto sin nombre').toUpperCase(), MARGEN, y);

  y += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.8);
  doc.setTextColor(...GRIS);
  const detallesProyecto = [
    proyecto?.ubicacion ? `Ubicación: ${proyecto.ubicacion}` : null,
    proyecto?.responsable ? `Encargado: ${proyecto.responsable}` : null,
    `Período: ${periodo(desde, hasta)}`,
    generadoPor ? `Generado por: ${generadoPor}` : null,
  ].filter(Boolean);
  detallesProyecto.forEach((linea, indice) => {
    doc.text(linea, MARGEN, y + indice * 4.4);
  });
  y += detallesProyecto.length * 4.4 + 4;

  // ----- Tarjetas de totales -----
  const tarjetas = [
    ['Facturas (sin IVA)', formatearCRCPdf(resumen.subtotal), false],
    ['IVA', formatearCRCPdf(totalIva), false],
    ['Planilla', formatearCRCPdf(resumenPlanilla.total), false],
    ['Total gastado', formatearCRCPdf(totalGastado), true],
  ];

  asegurarEspacio(26);
  const anchoTarjeta = (ANCHO_UTIL - 9) / 4;
  tarjetas.forEach(([etiqueta, valor, esTotal], indice) => {
    const x = MARGEN + indice * (anchoTarjeta + 3);
    doc.setFillColor(...(esTotal ? [236, 253, 245] : [248, 250, 252]));
    doc.setDrawColor(...LINEA);
    doc.setLineWidth(0.3);
    doc.rect(x, y, anchoTarjeta, 20, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(...SUAVE);
    doc.text(etiqueta.toUpperCase(), x + 3, y + 7);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.8);
    doc.setTextColor(...(esTotal ? [5, 122, 85] : TINTA));
    doc.text(valor, x + 3, y + 15);
  });

  y += 22;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...GRIS);
  doc.text(
    `${resumen.cantidad} ${resumen.cantidad === 1 ? 'factura registrada' : 'facturas registradas'}${
      resumen.sinIva > 0 ? ` (${resumen.sinIva} sin IVA)` : ''
    } · ${resumenPlanilla.cantidad} ${
      resumenPlanilla.cantidad === 1 ? 'pago de planilla' : 'pagos de planilla'
    } · ${resumenPlanilla.dias} días de jornal`,
    MARGEN,
    y + 4,
  );
  y += 6;

  // ----- Control de IVA -----
  seccion('CONTROL DE IVA (HACIENDA)');
  if (resumen.porTasa.length === 0) {
    aviso('Sin facturas con IVA en el período seleccionado.');
  } else {
    autoTable(doc, {
      startY: y + 3,
      head: [['Tasa de IVA', 'Facturas', 'Base imponible (CRC)', 'IVA (CRC)', 'Total (CRC)']],
      body: resumen.porTasa.map((fila) => [
        `${formatearNumero(fila.tasa)}%`,
        `${fila.cantidad}`,
        formatearNumero(fila.subtotal),
        formatearNumero(fila.impuesto),
        formatearNumero(fila.total),
      ]),
      foot: [[
        'Total',
        `${resumen.cantidad}`,
        formatearNumero(resumen.subtotal),
        formatearNumero(resumen.impuesto),
        formatearNumero(resumen.total),
      ]],
      theme: 'grid',
      margin: { left: MARGEN, right: MARGEN, bottom: 24 },
      rowPageBreak: 'avoid',
      styles: { fontSize: 8.5, cellPadding: 1.8, textColor: GRIS },
      headStyles: { fillColor: TINTA, textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
      footStyles: { fillColor: [241, 245, 249], textColor: TINTA, fontStyle: 'bold', fontSize: 8.5 },
      columnStyles: {
        0: { halign: 'left', cellWidth: 30 },
        1: { halign: 'center', cellWidth: 24 },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
      },
    });
    y = (doc.lastAutoTable?.finalY ?? y) + 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...SUAVE);
    asegurarEspacio(8);
    doc.text('La planilla no genera IVA: es pago de jornal, no venta de bienes ni servicios.', MARGEN, y + 4);
    y += 7;
  }

  // ----- Gastos por clasificación -----
  seccion('GASTOS POR CLASIFICACIÓN');
  if (resumen.porCategoria.length === 0) {
    aviso('Sin gastos clasificados en el período.');
  } else {
    autoTable(doc, {
      startY: y + 3,
      head: [['Clasificación', 'Facturas', 'Subtotal (CRC)', 'IVA (CRC)', 'Total (CRC)', '% del gasto']],
      body: resumen.porCategoria.map((fila) => [
        fila.nombre,
        `${fila.cantidad}`,
        formatearNumero(fila.subtotal),
        formatearNumero(fila.impuesto),
        formatearNumero(fila.total),
        `${formatearNumero(fila.porcentaje)}%`,
      ]),
      theme: 'grid',
      margin: { left: MARGEN, right: MARGEN, bottom: 24 },
      rowPageBreak: 'avoid',
      styles: { fontSize: 8.3, cellPadding: 1.8, textColor: GRIS },
      headStyles: { fillColor: TINTA, textColor: 255, fontStyle: 'bold', fontSize: 8.3 },
      alternateRowStyles: { fillColor: [250, 250, 252] },
      columnStyles: {
        0: { cellWidth: 56 },
        1: { halign: 'center', cellWidth: 16 },
        2: { halign: 'right', cellWidth: 30 },
        3: { halign: 'right', cellWidth: 28 },
        4: { halign: 'right', cellWidth: 30 },
        5: { halign: 'right', cellWidth: 22 },
      },
    });
    y = (doc.lastAutoTable?.finalY ?? y) + 4;
  }

  // ----- Gastos por cuenta (caja / banco / tarjeta / personal) -----
  const porCuenta = calcularResumenPorCuenta(facturas, cuentas);
  const mapaCuentas = new Map();
  porCuenta.forEach((fila) => {
    mapaCuentas.set(fila.id, { ...fila, planilla: 0 });
  });
  planillas.forEach((planilla) => {
    const clave = planilla.cuentaId || '__sin__';
    const actual = mapaCuentas.get(clave) ?? {
      id: clave,
      nombre: clave === '__sin__' ? 'Sin cuenta asignada' : nombreCuenta(cuentas, clave),
      cantidad: 0,
      total: 0,
      planilla: 0,
    };
    actual.planilla += aNumero(planilla.total);
    mapaCuentas.set(clave, actual);
  });

  const filasCuenta = [...mapaCuentas.values()]
    .map((fila) => ({ ...fila, granTotal: aNumero(fila.total) + aNumero(fila.planilla) }))
    .filter((fila) => fila.cantidad > 0 || fila.planilla > 0)
    .sort((a, b) => b.granTotal - a.granTotal);

  seccion('GASTOS POR CUENTA', 'De dónde salió el dinero');
  if (filasCuenta.length === 0) {
    aviso('Sin cuentas con movimientos en el período.');
  } else {
    autoTable(doc, {
      startY: y + 3,
      head: [['Cuenta', 'Facturas (CRC)', 'Planilla (CRC)', 'Total (CRC)', '% del gasto']],
      body: filasCuenta.map((fila) => [
        fila.nombre,
        formatearNumero(fila.total),
        formatearNumero(fila.planilla),
        formatearNumero(fila.granTotal),
        `${formatearNumero(totalGastado > 0 ? (fila.granTotal / totalGastado) * 100 : 0)}%`,
      ]),
      foot: [[
        'Total',
        formatearNumero(resumen.total),
        formatearNumero(resumenPlanilla.total),
        formatearNumero(totalGastado),
        '100%',
      ]],
      theme: 'grid',
      margin: { left: MARGEN, right: MARGEN, bottom: 24 },
      rowPageBreak: 'avoid',
      styles: { fontSize: 8.3, cellPadding: 1.8, textColor: GRIS },
      headStyles: { fillColor: TINTA, textColor: 255, fontStyle: 'bold', fontSize: 8.3 },
      footStyles: { fillColor: [241, 245, 249], textColor: TINTA, fontStyle: 'bold', fontSize: 8.3 },
      alternateRowStyles: { fillColor: [250, 250, 252] },
      columnStyles: {
        0: { cellWidth: 62 },
        1: { halign: 'right', cellWidth: 30 },
        2: { halign: 'right', cellWidth: 30 },
        3: { halign: 'right', cellWidth: 32 },
        4: { halign: 'right', cellWidth: 28 },
      },
    });
    y = (doc.lastAutoTable?.finalY ?? y) + 4;
  }

  // ----- Planilla: resumen por trabajador -----
  seccion('PLANILLA DE PERSONAL', 'Pago por jornal, sin IVA');
  if (planillas.length === 0) {
    aviso('No hay pagos de planilla en el período.');
  } else {
    autoTable(doc, {
      startY: y + 3,
      head: [['Trabajador', 'Pagos', 'Días', 'Total pagado (CRC)', '% de la planilla']],
      body: resumenPlanilla.trabajadores.map((trabajador) => [
        trabajador.nombre,
        `${trabajador.pagos}`,
        `${formatearNumero(trabajador.dias)}`,
        formatearNumero(trabajador.total),
        `${formatearNumero(resumenPlanilla.total > 0 ? (trabajador.total / resumenPlanilla.total) * 100 : 0)}%`,
      ]),
      foot: [['Total', `${resumenPlanilla.cantidad}`, formatearNumero(resumenPlanilla.dias), formatearNumero(resumenPlanilla.total), '100%']],
      theme: 'grid',
      margin: { left: MARGEN, right: MARGEN, bottom: 24 },
      rowPageBreak: 'avoid',
      styles: { fontSize: 8.3, cellPadding: 1.8, textColor: GRIS },
      headStyles: { fillColor: TINTA, textColor: 255, fontStyle: 'bold', fontSize: 8.3 },
      footStyles: { fillColor: [241, 245, 249], textColor: TINTA, fontStyle: 'bold', fontSize: 8.3 },
      columnStyles: {
        0: { cellWidth: 72 },
        1: { halign: 'center', cellWidth: 18 },
        2: { halign: 'center', cellWidth: 18 },
        3: { halign: 'right', cellWidth: 42 },
        4: { halign: 'right' },
      },
    });
    y = (doc.lastAutoTable?.finalY ?? y) + 4;
  }

  // ----- Detalle de facturas -----
  seccion('DETALLE DE FACTURAS');
  if (facturas.length === 0) {
    aviso('No hay facturas para mostrar.');
  } else {
    autoTable(doc, {
      startY: y + 3,
      head: [['Fecha', 'N.º factura', 'Proveedor', 'Clasificación', 'Pagado con', 'Subtotal (CRC)', 'IVA (CRC)', 'Total (CRC)']],
      body: facturas.map((factura) => [
        fechaISOaTexto(factura.fecha),
        factura.numeroFactura,
        factura.proveedor,
        categoriaPorId(factura.categoria).nombre,
        nombreCuenta(cuentas, factura.cuentaId),
        formatearNumero(factura.subtotal),
        formatearNumero(factura.impuesto),
        formatearNumero(factura.total),
      ]),
      foot: [[
        'Totales',
        '',
        '',
        '',
        '',
        formatearNumero(resumen.subtotal),
        formatearNumero(resumen.impuesto),
        formatearNumero(resumen.total),
      ]],
      theme: 'grid',
      margin: { left: MARGEN, right: MARGEN, bottom: 24 },
      styles: { fontSize: 7, cellPadding: 1.4, textColor: GRIS, overflow: 'linebreak' },
      headStyles: { fillColor: TINTA, textColor: 255, fontStyle: 'bold', fontSize: 7 },
      footStyles: { fillColor: [241, 245, 249], textColor: TINTA, fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: [250, 250, 252] },
      rowPageBreak: 'avoid',
      columnStyles: {
        0: { cellWidth: 17 },
        1: { cellWidth: 20 },
        2: { cellWidth: 28 },
        3: { cellWidth: 23 },
        4: { cellWidth: 24 },
        5: { halign: 'right', cellWidth: 24 },
        6: { halign: 'right', cellWidth: 20 },
        7: { halign: 'right', cellWidth: 26 },
      },
    });
    y = (doc.lastAutoTable?.finalY ?? y) + 4;
  }

  // ----- Detalle de planilla -----
  if (planillas.length > 0) {
    seccion('DETALLE DE PLANILLA');
    autoTable(doc, {
      startY: y + 3,
      head: [['Fecha', 'Trabajador', 'Puesto', 'Días', 'Período', 'Pagado con', 'Total (CRC)']],
      body: planillas.map((planilla) => [
        fechaISOaTexto(planilla.fecha),
        planilla.trabajador,
        planilla.puesto || '—',
        formatearNumero(planilla.dias),
        planilla.periodoDesde || planilla.periodoHasta
          ? `${fechaISOaTexto(planilla.periodoDesde)} al ${fechaISOaTexto(planilla.periodoHasta)}`
          : '—',
        nombreCuenta(cuentas, planilla.cuentaId),
        formatearNumero(planilla.total),
      ]),
      foot: [['Totales', '', '', formatearNumero(resumenPlanilla.dias), '', '', formatearNumero(resumenPlanilla.total)]],
      theme: 'grid',
      margin: { left: MARGEN, right: MARGEN, bottom: 24 },
      styles: { fontSize: 7, cellPadding: 1.4, textColor: GRIS, overflow: 'linebreak' },
      headStyles: { fillColor: TINTA, textColor: 255, fontStyle: 'bold', fontSize: 7 },
      footStyles: { fillColor: [241, 245, 249], textColor: TINTA, fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: [250, 250, 252] },
      rowPageBreak: 'avoid',
      columnStyles: {
        0: { cellWidth: 18 },
        1: { cellWidth: 36 },
        2: { cellWidth: 30 },
        3: { halign: 'center', cellWidth: 12 },
        4: { cellWidth: 34 },
        5: { cellWidth: 26 },
        6: { halign: 'right', cellWidth: 26 },
      },
    });
  }

  // ----- Pie de página -----
  const totalPaginas = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= totalPaginas; pagina += 1) {
    doc.setPage(pagina);
    doc.setDrawColor(...LINEA);
    doc.setLineWidth(0.3);
    doc.line(MARGEN, ALTO_PAGINA - 18, ANCHO_PAGINA - MARGEN, ALTO_PAGINA - 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...SUAVE);
    doc.text('CotiObra CR · Reporte interno de gastos reales de obra', MARGEN, ALTO_PAGINA - 13);
    doc.text(`Página ${pagina} de ${totalPaginas}`, ANCHO_PAGINA - MARGEN, ALTO_PAGINA - 13, { align: 'right' });
  }

  return doc;
};

/** Genera y descarga el reporte. Devuelve el nombre del archivo. */
export const descargarReporteGastos = (datos) => {
  const doc = crearReporteGastos(datos);
  const nombre = `Gastos_${limpiarNombreArchivo(datos.proyecto?.nombre, 'Proyecto')}_${limpiarNombreArchivo(
    datos.fecha,
    'hoy',
  )}.pdf`;

  const blob = doc.output('blob');
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  enlace.rel = 'noopener';
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);

  return nombre;
};
