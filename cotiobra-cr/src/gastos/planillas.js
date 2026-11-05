// Planilla de personal: pagos por hora, día, semana, quincena, mes o monto fijo.
// También son gasto real de la obra (se guardan en `planillas` y se suman al
// control de gastos, sin IVA porque el pago de planilla no lleva impuesto).

import { aMonto, aNumero } from '../formato.js';

const redondear = (valor) => Math.round(aNumero(valor));

/**
 * Formas de reconocer la planilla. Cada modalidad dice cómo se calcula el pago:
 * cantidad × tarifa (hora, día, semana, quincena, mes) o un monto fijo (destajo).
 * `decimales` permite medias horas o medios días.
 */
export const MODALIDADES_PAGO = [
  {
    id: 'hora',
    nombre: 'Por hora',
    icono: '⏱️',
    unidad: 'horas',
    singular: 'hora',
    plural: 'horas',
    abreviatura: 'h',
    etiquetaCantidad: '¿Cuántas horas trabajó?',
    etiquetaTarifa: 'Pago por hora (₡)',
    ejemplo: 'Ej. 8 horas × ₡1.800',
    decimales: true,
    paso: '0.5',
    rapidos: [4, 6, 8, 10, 12],
    chip: 'bg-sky-500/15 text-sky-300 border-sky-500/40',
  },
  {
    id: 'dia',
    nombre: 'Por día',
    icono: '📅',
    unidad: 'días',
    singular: 'día',
    plural: 'días',
    abreviatura: 'd',
    etiquetaCantidad: '¿Cuántos días trabajó?',
    etiquetaTarifa: 'Jornal por día (₡)',
    ejemplo: 'Ej. 6 días × ₡15.000',
    decimales: true,
    paso: '0.5',
    rapidos: [1, 3, 5, 6, 12],
    chip: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
  },
  {
    id: 'semana',
    nombre: 'Por semana',
    icono: '🗓️',
    unidad: 'semanas',
    singular: 'semana',
    plural: 'semanas',
    abreviatura: 'sem',
    etiquetaCantidad: '¿Cuántas semanas?',
    etiquetaTarifa: 'Pago por semana (₡)',
    ejemplo: 'Ej. 1 semana × ₡100.000',
    decimales: true,
    paso: '0.5',
    rapidos: [1, 2, 3, 4],
    chip: 'bg-violet-500/15 text-violet-300 border-violet-500/40',
  },
  {
    id: 'quincena',
    nombre: 'Por quincena',
    icono: '📆',
    unidad: 'quincenas',
    singular: 'quincena',
    plural: 'quincenas',
    abreviatura: 'quinc',
    etiquetaCantidad: '¿Cuántas quincenas?',
    etiquetaTarifa: 'Pago por quincena (₡)',
    ejemplo: 'Ej. 1 quincena × ₡250.000',
    decimales: false,
    paso: '1',
    rapidos: [1, 2],
    chip: 'bg-teal-500/15 text-teal-300 border-teal-500/40',
  },
  {
    id: 'mes',
    nombre: 'Por mes',
    icono: '📊',
    unidad: 'meses',
    singular: 'mes',
    plural: 'meses',
    abreviatura: 'mes',
    etiquetaCantidad: '¿Cuántos meses?',
    etiquetaTarifa: 'Salario por mes (₡)',
    ejemplo: 'Ej. 1 mes × ₡450.000',
    decimales: false,
    paso: '1',
    rapidos: [1, 2, 3],
    chip: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/40',
  },
  {
    id: 'fijo',
    nombre: 'Monto fijo',
    icono: '💰',
    unidad: 'pagos',
    singular: 'pago',
    plural: 'pagos',
    abreviatura: 'fijo',
    etiquetaCantidad: null,
    etiquetaTarifa: 'Monto a pagar (₡)',
    ejemplo: 'Ej. destajo o trato: ₡80.000',
    decimales: false,
    paso: '1',
    rapidos: [],
    chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
  },
];

export const MODALIDAD_POR_DEFECTO = 'dia';

export const modalidadPorId = (id) =>
  MODALIDADES_PAGO.find((modalidad) => modalidad.id === id) ??
  MODALIDADES_PAGO.find((modalidad) => modalidad.id === MODALIDAD_POR_DEFECTO);

/** ¿La modalidad se calcula como cantidad × tarifa? (El monto fijo no). */
export const esPorCantidad = (modalidad) => modalidadPorId(modalidad).id !== 'fijo';

export const planillaVacia = ({ fecha, proyectoId = '', cuentaId = '' } = {}) => ({
  id: null,
  proyectoId,
  fecha: fecha ?? '',
  periodoDesde: '',
  periodoHasta: '',
  trabajador: '',
  puesto: '',
  modalidad: MODALIDAD_POR_DEFECTO,
  cantidad: 0,
  tarifa: 0,
  extras: 0,
  deducciones: 0,
  total: 0,
  cuentaId,
  metodoPago: 'Efectivo',
  notas: '',
});

/**
 * Total a pagar: (horas/días/semanas × tarifa) + extras − deducciones.
 * En "monto fijo" el total es la tarifa + extras − deducciones. Nunca negativo.
 */
export const calcularTotalPlanilla = ({ modalidad, cantidad, tarifa, extras, deducciones }) => {
  const base = esPorCantidad(modalidad)
    ? aMonto(cantidad) * aMonto(tarifa)
    : aMonto(tarifa);
  return Math.max(0, Math.round(base + aMonto(extras) - aMonto(deducciones)));
};

/** "8 horas", "6 días", "1 semana", "₡80.000 (fijo)" — texto corto para tablas. */
export const describirCantidad = (planilla = {}) => {
  const modalidad = modalidadPorId(planilla.modalidad);
  if (!esPorCantidad(modalidad.id)) return 'Monto fijo';
  const cantidad = aNumero(planilla.cantidad);
  return `${cantidad} ${cantidad === 1 ? modalidad.singular : modalidad.plural}`;
};

/** "8 h", "6 d", "1 sem" — versión compacta para resúmenes. */
export const detalleCorto = (planilla = {}) => {
  const modalidad = modalidadPorId(planilla.modalidad);
  if (!esPorCantidad(modalidad.id)) return 'fijo';
  return `${aNumero(planilla.cantidad)} ${modalidad.abreviatura}`;
};

/** "8 h × ₡1.800" — cómo se calculó el pago. */
export const describirCalculo = (planilla = {}) => {
  const modalidad = modalidadPorId(planilla.modalidad);
  if (!esPorCantidad(modalidad.id)) return 'Monto fijo';
  return `${aNumero(planilla.cantidad)} ${modalidad.abreviatura} × ₡${aNumero(planilla.tarifa)}`;
};

/** Normaliza lo que viene de Firestore o del formulario (y datos viejos de jornal). */
export const normalizarPlanilla = (entrada = {}) => {
  const tieneModalidad = Boolean(entrada.modalidad);

  // Compatibilidad con registros anteriores (días + jornalDia + horasExtra).
  const modalidad = tieneModalidad ? modalidadPorId(entrada.modalidad).id : 'dia';
  const cantidadCruda = tieneModalidad
    ? entrada.cantidad
    : (entrada.dias ?? entrada.cantidad);
  const tarifaCruda = tieneModalidad
    ? entrada.tarifa
    : (entrada.jornalDia ?? entrada.tarifa);

  const base = {
    ...planillaVacia(),
    ...entrada,
    proyectoId: (entrada.proyectoId ?? '').toString(),
    fecha: (entrada.fecha ?? '').toString().slice(0, 10),
    periodoDesde: (entrada.periodoDesde ?? '').toString().slice(0, 10),
    periodoHasta: (entrada.periodoHasta ?? '').toString().slice(0, 10),
    trabajador: (entrada.trabajador ?? '').toString().trim(),
    puesto: (entrada.puesto ?? '').toString().trim(),
    modalidad,
    cantidad: aMonto(cantidadCruda),
    tarifa: redondear(tarifaCruda),
    extras: redondear(entrada.extras ?? entrada.horasExtra),
    deducciones: redondear(entrada.deducciones),
    cuentaId: (entrada.cuentaId ?? '').toString(),
    metodoPago: (entrada.metodoPago ?? 'Efectivo').toString(),
    notas: (entrada.notas ?? '').toString(),
  };

  // El monto fijo siempre es un solo pago.
  if (!esPorCantidad(base.modalidad)) base.cantidad = 1;

  const total =
    entrada.total === '' || entrada.total === null || entrada.total === undefined
      ? calcularTotalPlanilla(base)
      : redondear(entrada.total);

  return { ...base, total };
};

export const validarPlanilla = (planilla) => {
  if (!planilla.proyectoId) return 'Elige el proyecto al que pertenece la planilla.';
  if (!planilla.fecha) return 'Indica la fecha de pago.';
  if (!planilla.trabajador) return 'Escribe el nombre del trabajador.';

  const modalidad = modalidadPorId(planilla.modalidad);
  if (esPorCantidad(modalidad.id) && aNumero(planilla.cantidad) <= 0) {
    return `Indica cuántas ${modalidad.plural} se van a pagar.`;
  }
  if (aNumero(planilla.tarifa) <= 0) return `Falta el ${modalidad.etiquetaTarifa.toLowerCase()}.`;
  if (planilla.total <= 0) return 'El total a pagar debe ser mayor que cero.';
  return null;
};

/** Suma las cantidades por modalidad para el resumen (8 h, 6 días, 1 semana…). */
const acumularPorModalidad = (planillas) => {
  const mapa = new Map();

  MODALIDADES_PAGO.forEach((modalidad) => {
    mapa.set(modalidad.id, {
      id: modalidad.id,
      nombre: modalidad.nombre,
      icono: modalidad.icono,
      abreviatura: modalidad.abreviatura,
      unidad: modalidad.unidad,
      singular: modalidad.singular,
      plural: modalidad.plural,
      chip: modalidad.chip,
      cantidad: 0,
      pagos: 0,
      total: 0,
    });
  });

  planillas.forEach((planilla) => {
    const modalidad = modalidadPorId(planilla.modalidad);
    const actual = mapa.get(modalidad.id);
    if (!actual) return;
    actual.pagos += 1;
    actual.cantidad += esPorCantidad(modalidad.id) ? aNumero(planilla.cantidad) : 0;
    actual.total += aNumero(planilla.total);
  });

  return [...mapa.values()].filter((fila) => fila.pagos > 0);
};

/** Resumen de planillas (se muestra aparte de las facturas). */
export const calcularResumenPlanillas = (planillas = []) => {
  const resumen = { cantidad: 0, total: 0, trabajadores: [], porModalidad: [] };

  planillas.forEach((planilla) => {
    resumen.cantidad += 1;
    resumen.total += aNumero(planilla.total);
  });

  const trabajadores = new Map();
  planillas.forEach((planilla) => {
    const actual = trabajadores.get(planilla.trabajador) ?? {
      nombre: planilla.trabajador,
      puesto: planilla.puesto ?? '',
      pagos: 0,
      total: 0,
      detalle: new Map(),
    };
    actual.pagos += 1;
    actual.total += aNumero(planilla.total);
    const corto = modalidadPorId(planilla.modalidad);
    const llave = corto.id;
    const acumulado = actual.detalle.get(llave) ?? { id: corto.id, abreviatura: corto.abreviatura, cantidad: 0 };
    acumulado.cantidad += esPorCantidad(corto.id) ? aNumero(planilla.cantidad) : 0;
    actual.detalle.set(llave, acumulado);
    if (!actual.puesto && planilla.puesto) actual.puesto = planilla.puesto;
    trabajadores.set(planilla.trabajador, actual);
  });

  resumen.trabajadores = [...trabajadores.values()]
    .map((trabajador) => ({
      ...trabajador,
      detalleTexto: [...trabajador.detalle.values()]
        .filter((fila) => fila.cantidad > 0)
        .map((fila) => `${fila.cantidad} ${fila.abreviatura}`)
        .join(' · ') || 'Monto fijo',
    }))
    .sort((a, b) => b.total - a.total);

  resumen.porModalidad = acumularPorModalidad(planillas);

  return resumen;
};

/**
 * Convierte las planillas en filas equivalentes a facturas para los reportes y
 * para poder sumarlas al total gastado sin duplicar la lógica.
 */
export const planillasComoGastos = (planillas = [], proyectoId = '') =>
  planillas
    .filter((planilla) => !proyectoId || planilla.proyectoId === proyectoId)
    .map((planilla) => ({
      id: planilla.id,
      proyectoId: planilla.proyectoId,
      fecha: planilla.fecha,
      numeroFactura: `Planilla · ${detalleCorto(planilla)}`,
      proveedor: planilla.trabajador,
      categoria: 'planilla',
      subtotal: aNumero(planilla.total),
      tasaIva: 0,
      impuesto: 0,
      total: aNumero(planilla.total),
      metodoPago: planilla.metodoPago,
      cuentaId: planilla.cuentaId,
      notas: planilla.notas,
      origen: 'planilla',
    }));

/** CSV de planillas (Excel en español: separador ; y BOM UTF-8). */
export const planillasACSV = (planillas = [], { proyectos = [], cuentas = [] } = {}) => {
  const nombreProyecto = (id) => proyectos.find((proyecto) => proyecto.id === id)?.nombre ?? '';
  const nombreCuenta = (id) => cuentas.find((cuenta) => cuenta.id === id)?.nombre ?? (id ? 'Cuenta eliminada' : 'Sin cuenta');
  const escapar = (valor) => `"${(valor ?? '').toString().replace(/"/g, '""')}"`;

  const encabezados = [
    'Fecha de pago', 'Trabajador', 'Puesto', 'Proyecto', 'Forma de pago',
    'Cantidad', 'Pago por unidad', 'Extras', 'Deducciones', 'Total',
    'Periodo desde', 'Periodo hasta', 'Metodo de pago', 'Cuenta', 'Notas',
  ];

  const filas = planillas.map((planilla) => {
    const modalidad = modalidadPorId(planilla.modalidad);
    const porCantidad = esPorCantidad(modalidad.id);
    return [
      planilla.fecha ? planilla.fecha.split('-').reverse().join('/') : '',
      planilla.trabajador,
      planilla.puesto,
      nombreProyecto(planilla.proyectoId),
      modalidad.nombre,
      porCantidad ? planilla.cantidad : 1,
      planilla.tarifa,
      planilla.extras,
      planilla.deducciones,
      planilla.total,
      planilla.periodoDesde ? planilla.periodoDesde.split('-').reverse().join('/') : '',
      planilla.periodoHasta ? planilla.periodoHasta.split('-').reverse().join('/') : '',
      planilla.metodoPago,
      nombreCuenta(planilla.cuentaId),
      (planilla.notas ?? '').replace(/\r?\n/g, ' '),
    ].map(escapar).join(';');
  });

  const resumen = calcularResumenPlanillas(planillas);
  const totales = [
    '', 'TOTALES', '', '', '', '', '', '', '', resumen.total, '', '', '', '', '',
  ].map(escapar).join(';');

  return `\uFEFF${[encabezados.map(escapar).join(';'), ...filas, totales].join('\r\n')}`;
};
