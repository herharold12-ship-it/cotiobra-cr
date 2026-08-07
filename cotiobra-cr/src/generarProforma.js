import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const descargarProforma = (datos) => {
  const doc = new jsPDF();

  // --- 1. ENCABEZADO PROFESIONAL (EMISOR) ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(30, 41, 59);
  doc.text('COTIOBRA CR', 14, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Identificación / Cédula: ${datos.cedulaEmisor || 'N/A'}`, 14, 26);
  doc.text(`Teléfono / WhatsApp: ${datos.telefonoEmisor || 'N/A'}`, 14, 31);
  doc.text(`Correo: ${datos.correoEmisor || 'N/A'}`, 14, 36);

  // --- 2. CONTROL DE PROFORMA ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text(`PROFORMA N°: ${datos.numProforma || 'PROF-001'}`, 196, 20, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Fecha de Emisión: ${datos.fecha || new Date().toLocaleDateString()}`, 196, 26, { align: 'right' });
  doc.text(`Validez de Oferta: ${datos.validez || '15 días hábiles'}`, 196, 31, { align: 'right' });

  // Línea divisora
  doc.setDrawColor(226, 232, 240);
  doc.line(14, 40, 196, 40);

  // --- 3. DATOS DEL CLIENTE Y PROYECTO ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.text('INFORMACIÓN DEL CLIENTE Y PROYECTO', 14, 47);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Cliente: ${datos.cliente || 'No especificado'}`, 14, 53);
  
  let offsetY = 58;
  if (datos.empresaCliente) {
    doc.text(`Empresa / Razón Social: ${datos.empresaCliente}`, 14, offsetY);
    offsetY += 5;
  }
  doc.text(`Proyecto / Obra: ${datos.proyecto || 'Proyecto General'}`, 14, offsetY);
  offsetY += 5;
  
  if (datos.ubicacion) {
    doc.text(`Ubicación: ${datos.ubicacion}`, 14, offsetY);
    offsetY += 5;
  }

  const startYTabla = offsetY + 3;

  // --- 4. DESGLOSE DE CONCEPTOS Y TRABAJOS ---
  const filas = (datos.items || []).map((item) => [
    item.descripcion || item.concepto || 'Sin descripción',
    item.unidad || 'Unid',
    item.cantidad || 1,
    `₡${Number(item.precioUnitario || item.costoUnidad || 0).toLocaleString()}`,
    `₡${((Number(item.cantidad) || 1) * (Number(item.precioUnitario || item.costoUnidad) || 0)).toLocaleString()}`,
  ]);

  autoTable(doc, {
    startY: startYTabla,
    head: [['Descripción / Concepto del Trabajo', 'Unidad', 'Cant.', 'Precio Unit.', 'Subtotal (₡)']],
    body: filas,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 8.5, textColor: [51, 65, 85] },
    columnStyles: {
      0: { cellWidth: 85 },
      1: { halign: 'center', cellWidth: 20 },
      2: { halign: 'center', cellWidth: 18 },
      3: { halign: 'right', cellWidth: 30 },
      4: { halign: 'right', cellWidth: 29 },
    },
  });

  // --- 5. CUADRO DE TOTALES ---
  const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 8 : startYTabla + 30;
  const subtotal = (datos.items || []).reduce((acc, i) => acc + ((Number(i.cantidad) || 1) * (Number(i.precioUnitario || i.costoUnidad) || 0)), 0);
  const porcentajeIva = datos.porcentajeIva || 0;
  const montoIva = subtotal * (porcentajeIva / 100);
  const totalGeneral = subtotal + montoIva;

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  
  doc.text('Subtotal Neto:', 135, finalY);
  doc.text(`₡${subtotal.toLocaleString()}`, 196, finalY, { align: 'right' });

  if (porcentajeIva > 0) {
    doc.text(`I.V.A. (${porcentajeIva}%):`, 135, finalY + 6);
    doc.text(`₡${montoIva.toLocaleString()}`, 196, finalY + 6, { align: 'right' });
  }

  const posTotalY = porcentajeIva > 0 ? finalY + 14 : finalY + 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text('TOTAL PROFORMA:', 135, posTotalY);
  doc.text(`₡${totalGeneral.toLocaleString()}`, 196, posTotalY, { align: 'right' });

  // --- 6. CONDICIONES DE PAGO Y GARANTÍA ---
  const condicionesY = posTotalY + 12;
  
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text('CONDICIONES DE PAGO Y GARANTÍA', 14, condicionesY);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);

  const condiciones = [
    `• Forma de pago: ${datos.adelanto || '50% de adelanto al firmar / 50% contra entrega final.'}`,
    `• Tiempo estimado de ejecución: ${datos.tiempoEjecucion || 'A definir según calendario.'}`,
    `• Garantía sobre mano de obra: ${datos.garantia || '6 meses contra defectos de aplicación.'}`,
    `• Cuentas para depósito / IBAN: ${datos.cuentaIBAN || 'Consultar con el emisor.'} ${datos.banco ? `(${datos.banco})` : ''}`,
    `• Notas: ${datos.notas || 'Los precios no incluyen imprevistos ni trámites no contemplados en este desglose.'}`
  ];

  condiciones.forEach((linea, idx) => {
    doc.text(linea, 14, condicionesY + 6 + (idx * 5));
  });

  // --- 7. PIE DE PÁGINA ---
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('Cotiobra CR - Documento formal de cotización y presupuesto de obra', 105, 282, { align: 'center' });

  // Descarga del archivo PDF
  const nombreArchivo = (datos.cliente || 'Proforma').replace(/[^a-zA-Z0-9]/g, '_');
  doc.save(`Proforma_${nombreArchivo}.pdf`);
};