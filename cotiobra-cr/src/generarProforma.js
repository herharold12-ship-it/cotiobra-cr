import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { construirItems, calcularTotales } from './calculos.js';
import { formatearCRCPdf, formatearFecha, limpiarNombreArchivo } from './formato.js';

const MARGEN = 14;
const ANCHO_PAGINA = 210;
const ALTO_PAGINA = 297;
const ANCHO_UTIL = ANCHO_PAGINA - MARGEN * 2;
const LIMITE_INFERIOR = 268;
const COLOR_TINTA = [15, 23, 42];
const COLOR_GRIS = [71, 85, 105];
const COLOR_SUAVE = [100, 116, 139];
const COLOR_LINEA = [226, 232, 240];

const limpiar = (valor, respaldo = '') => {
  const texto = (valor ?? '').toString().trim();
  return texto || respaldo;
};

/**
 * Arma la estructura que consume el generador de PDF a partir de los datos
 * de la pantalla o de una cotización guardada en Firestore.
 * Los totales se recalculan con el mismo módulo que usa la interfaz, así el
 * PDF nunca muestra cifras distintas a las de la pantalla.
 */
export const construirDatosProforma = (registro = {}) => {
  const {
    cotizacion = {},
    cliente = {},
    condiciones = {},
    materiales = [],
    manoDeObra = [],
    equipos = [],
    subcontratos = [],
    totales = {},
  } = registro;

  const items = construirItems({ materiales, manoDeObra, equipos, subcontratos });

  const totalesCalculados = calcularTotales({
    materiales,
    manoDeObra,
    equipos,
    subcontratos,
    porcentajeImprevistos: totales.porcentajeImprevistos,
    porcentajeUtilidad: totales.porcentajeUtilidad,
    porcentajeIva: totales.porcentajeIva,
  });

  return {
    numProforma: limpiar(cotizacion.numeroCotizacion, 'COT-SIN-CODIGO'),
    fecha: formatearFecha(cotizacion.fechaEmision),
    validez: limpiar(cotizacion.validez, '15 días hábiles'),
    emisor: {
      cedula: limpiar(cotizacion.cedula, 'N/A'),
      telefono: limpiar(cotizacion.telefono, 'N/A'),
      correo: limpiar(cotizacion.correo, 'N/A'),
      elaboradoPor: limpiar(cotizacion.elaboradoPor, 'CotiObra CR'),
    },
    cliente: {
      nombre: limpiar(cliente.nombre, 'Cliente general'),
      empresa: limpiar(cliente.empresa),
      correo: limpiar(cliente.correo),
      telefono: limpiar(cliente.telefono),
      proyecto: limpiar(cliente.proyecto, 'Proyecto / Obra general'),
      ubicacion: limpiar(cliente.ubicacion),
      fechaInicio: limpiar(cliente.fechaInicio),
    },
    items,
    totales: totalesCalculados,
    condiciones: {
      adelanto: limpiar(condiciones.adelanto, 'A convenir con el cliente.'),
      tiempoEjecucion: limpiar(condiciones.tiempoEjecucion, 'A definir según calendario.'),
      garantia: limpiar(condiciones.garantia, '6 meses sobre mano de obra.'),
      cuentaIBAN: limpiar(condiciones.cuentaIBAN ?? cotizacion.cuentaIBAN, 'Consultar con el emisor.'),
      banco: limpiar(condiciones.banco ?? cotizacion.banco),
      notas: limpiar(
        condiciones.notas,
        'Los precios no incluyen trámites o permisos no detallados en esta oferta.',
      ),
    },
  };
};

/** Crea el documento PDF (sin descargarlo) para poder probarlo o previsualizarlo. */
export const crearDocumentoPdf = (datos) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const { emisor, cliente, items, totales, condiciones } = datos;

  let y = 0;

  const nuevaPagina = () => {
    doc.addPage();
    // Encabezado de continuación para que las páginas sueltas tengan contexto.
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(...COLOR_TINTA);
    doc.text('COTIOBRA CR', MARGEN, 16);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLOR_SUAVE);
    doc.text(`Proforma N° ${datos.numProforma} (continuación)`, ANCHO_PAGINA - MARGEN, 16, { align: 'right' });
    doc.setDrawColor(...COLOR_LINEA);
    doc.setLineWidth(0.3);
    doc.line(MARGEN, 19, ANCHO_PAGINA - MARGEN, 19);
    y = 26;
  };

  const asegurarEspacio = (necesario) => {
    if (y + necesario > LIMITE_INFERIOR) nuevaPagina();
  };

  // ---------- Encabezado de la primera página ----------
  doc.setFillColor(...COLOR_TINTA);
  doc.rect(0, 0, ANCHO_PAGINA, 7, 'F');

  y = 20;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(...COLOR_TINTA);
  doc.text('COTIOBRA CR', MARGEN, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...COLOR_SUAVE);
  doc.text('Cotización y presupuesto de obra', MARGEN, y + 5);
  doc.text(`Identificación: ${emisor.cedula}`, MARGEN, y + 10);
  doc.text(`Teléfono / WhatsApp: ${emisor.telefono}`, MARGEN, y + 14.5);
  doc.text(`Correo: ${emisor.correo}`, MARGEN, y + 19);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...COLOR_TINTA);
  doc.text(`PROFORMA N° ${datos.numProforma}`, ANCHO_PAGINA - MARGEN, y, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(...COLOR_SUAVE);
  doc.text(`Fecha de emisión: ${datos.fecha}`, ANCHO_PAGINA - MARGEN, y + 5, { align: 'right' });
  doc.text(`Validez de la oferta: ${datos.validez}`, ANCHO_PAGINA - MARGEN, y + 9.5, { align: 'right' });

  const finCabecera = y + 24;
  doc.setDrawColor(...COLOR_LINEA);
  doc.setLineWidth(0.4);
  doc.line(MARGEN, finCabecera, ANCHO_PAGINA - MARGEN, finCabecera);

  // ---------- Cliente y proyecto ----------
  y = finCabecera + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...COLOR_TINTA);
  doc.text('INFORMACIÓN DEL CLIENTE Y PROYECTO', MARGEN, y);

  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.8);
  doc.setTextColor(...COLOR_GRIS);

  const datosCliente = [
    ['Cliente', cliente.nombre],
    cliente.empresa ? ['Empresa', cliente.empresa] : null,
    ['Proyecto / obra', cliente.proyecto],
    cliente.ubicacion ? ['Ubicación', cliente.ubicacion] : null,
    cliente.correo ? ['Correo', cliente.correo] : null,
    cliente.telefono ? ['Teléfono', cliente.telefono] : null,
    cliente.fechaInicio ? ['Fecha de inicio', cliente.fechaInicio] : null,
  ].filter(Boolean);

  datosCliente.forEach(([etiqueta, valor]) => {
    doc.setFont('helvetica', 'bold');
    doc.text(`${etiqueta}:`, MARGEN, y);
    doc.setFont('helvetica', 'normal');
    const lineas = doc.splitTextToSize(valor, ANCHO_UTIL - 28);
    doc.text(lineas, MARGEN + 27, y);
    y += lineas.length * 4.4 + 1.4;
  });

  // ---------- Tabla de conceptos ----------
  const filas = [];
  let rubroActual = null;

  if (items.length === 0) {
    filas.push([
      { content: 'No se registraron ítems en esta cotización.', colSpan: 5, styles: { halign: 'center', textColor: COLOR_SUAVE } },
    ]);
  }

  items.forEach((item) => {
    if (item.rubro !== rubroActual) {
      rubroActual = item.rubro;
      filas.push([
        {
          content: rubroActual.toUpperCase(),
          colSpan: 5,
          styles: { fillColor: [241, 245, 249], textColor: COLOR_TINTA, fontStyle: 'bold', fontSize: 8 },
        },
      ]);
    }
    filas.push([
      item.detalle ? `${item.descripcion}\n${item.detalle}` : item.descripcion,
      item.unidad,
      item.cantidad,
      formatearCRCPdf(item.precioUnitario),
      formatearCRCPdf(item.subtotal),
    ]);
  });

  autoTable(doc, {
    startY: y + 3,
    head: [['Descripción / concepto', 'Unidad', 'Cant.', 'Precio unitario', 'Subtotal']],
    body: filas,
    theme: 'grid',
    margin: { left: MARGEN, right: MARGEN, bottom: 24 },
    styles: { fontSize: 8.5, cellPadding: 2, textColor: COLOR_GRIS, overflow: 'linebreak' },
    headStyles: { fillColor: COLOR_TINTA, textColor: 255, fontStyle: 'bold', fontSize: 8.5 },
    alternateRowStyles: { fillColor: [250, 250, 252] },
    columnStyles: {
      0: { cellWidth: 84 },
      1: { halign: 'center', cellWidth: 22 },
      2: { halign: 'center', cellWidth: 16 },
      3: { halign: 'right', cellWidth: 30 },
      4: { halign: 'right', cellWidth: 30 },
    },
  });

  y = (doc.lastAutoTable?.finalY ?? y) + 8;

  // ---------- Liquidación ----------
  const filasTotales = [
    ['Materiales e insumos', formatearCRCPdf(totales.subtotalMateriales)],
    ['Mano de obra', formatearCRCPdf(totales.subtotalManoDeObra)],
    ['Equipos y alquileres', formatearCRCPdf(totales.subtotalEquipos)],
    ['Subcontratos', formatearCRCPdf(totales.subtotalSubcontratos)],
    ['Costo directo', formatearCRCPdf(totales.costoDirectoTotal)],
    [`Imprevistos (${totales.porcentajeImprevistos}%)`, formatearCRCPdf(totales.montoImprevistos)],
    [`Utilidad (${totales.porcentajeUtilidad}%)`, formatearCRCPdf(totales.montoUtilidad)],
    ['Subtotal neto', formatearCRCPdf(totales.subtotalNeto)],
    [`IVA (${totales.porcentajeIva}%)`, formatearCRCPdf(totales.montoIva)],
  ];

  const altoBloque = filasTotales.length * 5 + 18;
  asegurarEspacio(altoBloque);

  const xEtiqueta = ANCHO_PAGINA - MARGEN - 80;
  doc.setFontSize(8.5);
  filasTotales.forEach(([etiqueta, valor], indice) => {
    const esCostoDirecto = indice === 4;
    const esSubtotal = indice === 7;
    doc.setFont('helvetica', esCostoDirecto || esSubtotal ? 'bold' : 'normal');
    doc.setTextColor(...(esCostoDirecto || esSubtotal ? COLOR_TINTA : COLOR_GRIS));
    doc.text(etiqueta, xEtiqueta, y + indice * 5);
    doc.text(valor, ANCHO_PAGINA - MARGEN, y + indice * 5, { align: 'right' });
  });

  y += filasTotales.length * 5 + 2;
  doc.setDrawColor(...COLOR_TINTA);
  doc.setLineWidth(0.5);
  doc.line(xEtiqueta, y, ANCHO_PAGINA - MARGEN, y);

  y += 7;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...COLOR_TINTA);
  doc.text('TOTAL:', xEtiqueta, y);
  doc.text(formatearCRCPdf(totales.totalGeneral), ANCHO_PAGINA - MARGEN, y, { align: 'right' });

  // ---------- Condiciones ----------
  y += 12;
  asegurarEspacio(30);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...COLOR_TINTA);
  doc.text('CONDICIONES COMERCIALES', MARGEN, y);
  y += 5.5;

  const cuenta = condiciones.banco
    ? `${condiciones.cuentaIBAN} (${condiciones.banco})`
    : condiciones.cuentaIBAN;

  const bloques = [
    ['Forma de pago', condiciones.adelanto],
    ['Tiempo de ejecución', condiciones.tiempoEjecucion],
    ['Garantía', condiciones.garantia],
    ['Cuenta para depósito', cuenta],
    ['Notas y exclusiones', condiciones.notas],
  ];

  doc.setFontSize(8.5);
  bloques.forEach(([etiqueta, valor]) => {
    doc.setFont('helvetica', 'bold');
    const etiquetaAncho = doc.getTextWidth(`${etiqueta}: `);
    doc.setFont('helvetica', 'normal');
    const contenido = doc.splitTextToSize(valor, ANCHO_UTIL - etiquetaAncho);

    asegurarEspacio(contenido.length * 4.4 + 2);

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLOR_TINTA);
    doc.text(`${etiqueta}:`, MARGEN, y);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLOR_GRIS);
    doc.text(contenido, MARGEN + etiquetaAncho, y);
    y += contenido.length * 4.4 + 1.8;
  });

  // ---------- Firma ----------
  asegurarEspacio(24);
  y += 8;
  doc.setDrawColor(...COLOR_SUAVE);
  doc.setLineWidth(0.3);
  doc.line(MARGEN, y, MARGEN + 70, y);
  doc.setFontSize(8);
  doc.setTextColor(...COLOR_SUAVE);
  doc.text(`Elaborado por: ${emisor.elaboradoPor}`, MARGEN, y + 4.5);
  doc.text('Firma y sello del oferente', MARGEN, y + 8.5);

  // ---------- Pie de página ----------
  const totalPaginas = doc.getNumberOfPages();
  for (let pagina = 1; pagina <= totalPaginas; pagina += 1) {
    doc.setPage(pagina);
    doc.setDrawColor(...COLOR_LINEA);
    doc.setLineWidth(0.3);
    doc.line(MARGEN, ALTO_PAGINA - 18, ANCHO_PAGINA - MARGEN, ALTO_PAGINA - 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...COLOR_SUAVE);
    doc.text('CotiObra CR · Documento formal de cotización y presupuesto de obra', MARGEN, ALTO_PAGINA - 13);
    doc.text(`Página ${pagina} de ${totalPaginas}`, ANCHO_PAGINA - MARGEN, ALTO_PAGINA - 13, { align: 'right' });
  }

  return doc;
};

/** Descarga el PDF. `registro` puede venir de la pantalla o de Firestore. */
export const descargarProforma = (registro) => {
  const datos = registro?.emisor && registro?.totales ? registro : construirDatosProforma(registro);

  if (!datos.items || datos.items.length === 0) {
    throw new Error('La cotización no tiene ítems para exportar.');
  }

  const doc = crearDocumentoPdf(datos);
  const nombre = `Cotizacion_${limpiarNombreArchivo(datos.numProforma, 'COT')}_${limpiarNombreArchivo(
    datos.cliente.nombre,
    'Cliente',
  )}.pdf`;

  // Se descarga con un enlace propio (blob) en vez de doc.save(): así funciona
  // igual en cualquier navegador y no depende de window.open (bloqueadores de
  // ventanas emergentes).
  if (typeof document === 'undefined') {
    doc.save(nombre);
    return nombre;
  }

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
