// Planilla de personal: pagos por jornal que también son gasto real de la obra.
// Se guardan en la colección `planillas` y se suman al control de gastos
// (sin IVA, porque el pago de planilla no lleva impuesto trasladado).

import { aMonto, aNumero } from '../formato.js';

const redondear = (valor) => Math.round(aNumero(valor));

export const planillaVacia = ({ fecha, proyectoId = '', cuentaId = '' } = {}) => ({
  id: null,
  proyectoId,
  fecha: fecha ?? '',
  periodoDesde: '',
  periodoHasta: '',
  trabajador: '',
  puesto: '',
  dias: 0,
  jornalDia: 0,
  horasExtra: 0,
  deducciones: 0,
  total: 0,
  cuentaId,
  metodoPago: 'Efectivo',
  notas: '',
});

/** Total a pagar: días × jornal + horas extra − deducciones (nunca negativo). */
export const calcularTotalPlanilla = ({ dias, jornalDia, horasExtra, deducciones }) =>
  Math.max(0, Math.round(aMonto(dias) * aMonto(jornalDia) + aMonto(horasExtra) - aMonto(deducciones)));

export const normalizarPlanilla = (entrada = {}) => {
  const base = {
    ...planillaVacia(),
    ...entrada,
    proyectoId: (entrada.proyectoId ?? '').toString(),
    fecha: (entrada.fecha ?? '').toString().slice(0, 10),
    periodoDesde: (entrada.periodoDesde ?? '').toString().slice(0, 10),
    periodoHasta: (entrada.periodoHasta ?? '').toString().slice(0, 10),
    trabajador: (entrada.trabajador ?? '').toString().trim(),
    puesto: (entrada.puesto ?? '').toString().trim(),
    dias: aMonto(entrada.dias),
    jornalDia: redondear(entrada.jornalDia),
    horasExtra: redondear(entrada.horasExtra),
    deducciones: redondear(entrada.deducciones),
    cuentaId: (entrada.cuentaId ?? '').toString(),
    metodoPago: (entrada.metodoPago ?? 'Efectivo').toString(),
    notas: (entrada.notas ?? '').toString(),
  };

  const total = entrada.total === '' || entrada.total === null || entrada.total === undefined
    ? calcularTotalPlanilla(base)
    : redondear(entrada.total);

  return { ...base, total };
};

export const validarPlanilla = (planilla) => {
  if (!planilla.proyectoId) return 'Elige el proyecto al que pertenece la planilla.';
  if (!planilla.fecha) return 'Indica la fecha de pago.';
  if (!planilla.trabajador) return 'Escribe el nombre del trabajador.';
  if (planilla.dias <= 0 && planilla.horasExtra <= 0) return 'Indica al menos un día trabajado o un monto de horas extra.';
  if (planilla.total <= 0) return 'El total a pagar debe ser mayor que cero.';
  return null;
};

/** Resumen de planillas (se muestra aparte de las facturas). */
export const calcularResumenPlanillas = (planillas = []) => {
  const resumen = { cantidad: 0, dias: 0, total: 0, trabajadores: [], porCuenta: new Map() };

  planillas.forEach((planilla) => {
    resumen.cantidad += 1;
    resumen.dias += aNumero(planilla.dias);
    resumen.total += aNumero(planilla.total);
  });

  const trabajadores = new Map();
  planillas.forEach((planilla) => {
    const actual = trabajadores.get(planilla.trabajador) ?? { nombre: planilla.trabajador, pagos: 0, dias: 0, total: 0 };
    actual.pagos += 1;
    actual.dias += aNumero(planilla.dias);
    actual.total += aNumero(planilla.total);
    trabajadores.set(planilla.trabajador, actual);
  });
  resumen.trabajadores = [...trabajadores.values()].sort((a, b) => b.total - a.total);

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
      numeroFactura: planilla.periodoDesde && planilla.periodoHasta
        ? `Planilla ${planilla.periodoDesde} / ${planilla.periodoHasta}`
        : 'Planilla',
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
    'Fecha de pago', 'Trabajador', 'Puesto', 'Proyecto', 'Periodo desde', 'Periodo hasta',
    'Dias', 'Jornal dia', 'Horas extra', 'Deducciones', 'Total', 'Metodo de pago', 'Cuenta', 'Notas',
  ];

  const filas = planillas.map((planilla) => [
    planilla.fecha ? planilla.fecha.split('-').reverse().join('/') : '',
    planilla.trabajador,
    planilla.puesto,
    nombreProyecto(planilla.proyectoId),
    planilla.periodoDesde ? planilla.periodoDesde.split('-').reverse().join('/') : '',
    planilla.periodoHasta ? planilla.periodoHasta.split('-').reverse().join('/') : '',
    planilla.dias,
    planilla.jornalDia,
    planilla.horasExtra,
    planilla.deducciones,
    planilla.total,
    planilla.metodoPago,
    nombreCuenta(planilla.cuentaId),
    (planilla.notas ?? '').replace(/\r?\n/g, ' '),
  ].map(escapar).join(';'));

  const resumen = calcularResumenPlanillas(planillas);
  const totales = [
    '', 'TOTALES', '', '', '', '', resumen.dias, '', '', '', resumen.total, '', '', '',
  ].map(escapar).join(';');

  return `\uFEFF${[encabezados.map(escapar).join(';'), ...filas, totales].join('\r\n')}`;
};
