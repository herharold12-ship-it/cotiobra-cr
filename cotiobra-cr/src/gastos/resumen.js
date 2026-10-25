// Lógica pura del facturero de gastos: normalización, validación, filtros,
// orden, resúmenes e IVA. Sin React ni Firestore para poder probarla aislada.

import { aNumero, formatearNumero } from '../formato.js';
import { CATEGORIAS, categoriaPorId } from './categorias.js';

export const TASA_IVA_DEFECTO = 13;

export const PROYECTO_TODOS = 'todos';

const redondear = (valor) => Math.round(aNumero(valor));

/** Construye una factura nueva con los valores por defecto. */
export const facturaVacia = ({ fecha, proyectoId = '' } = {}) => ({
  id: null,
  proyectoId,
  fecha: fecha ?? '',
  numeroFactura: '',
  proveedor: '',
  categoria: 'material',
  subtotal: 0,
  tasaIva: TASA_IVA_DEFECTO,
  impuesto: 0,
  total: 0,
  metodoPago: 'Efectivo',
  notas: '',
});

/** Convierte lo que viene de Firestore en un objeto con tipos correctos. */
export const normalizarFactura = (entrada = {}) => {
  const subtotal = redondear(entrada.subtotal);
  const tasaIva = entrada.tasaIva === '' || entrada.tasaIva === null || entrada.tasaIva === undefined
    ? TASA_IVA_DEFECTO
    : Math.min(100, Math.max(0, aNumero(entrada.tasaIva)));
  const impuesto = entrada.impuesto === '' || entrada.impuesto === null || entrada.impuesto === undefined
    ? Math.round(subtotal * (tasaIva / 100))
    : redondear(entrada.impuesto);
  const total = entrada.total === '' || entrada.total === null || entrada.total === undefined
    ? subtotal + impuesto
    : redondear(entrada.total);

  return {
    ...entrada,
    id: entrada.id ?? null,
    proyectoId: (entrada.proyectoId ?? '').toString(),
    fecha: (entrada.fecha ?? '').toString().slice(0, 10),
    numeroFactura: (entrada.numeroFactura ?? '').toString().trim(),
    proveedor: (entrada.proveedor ?? '').toString().trim(),
    categoria: categoriaPorId(entrada.categoria).id,
    subtotal,
    tasaIva,
    impuesto,
    total,
    metodoPago: (entrada.metodoPago ?? 'Efectivo').toString(),
    notas: (entrada.notas ?? '').toString(),
  };
};

/** Devuelve un mensaje de error o null si la factura es válida. */
export const validarFactura = (factura) => {
  if (!factura.proyectoId) return 'Elige el proyecto al que pertenece la factura.';
  if (!factura.fecha) return 'Indica la fecha de la factura.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(factura.fecha)) return 'La fecha no es válida.';
  if (!factura.numeroFactura) return 'Escribe el número de factura.';
  if (!factura.proveedor) return 'Escribe el nombre del proveedor o casa comercial.';
  if (factura.total <= 0) return 'El total de la factura debe ser mayor que cero.';
  if (factura.total < factura.subtotal) return 'El total no puede ser menor que el subtotal.';
  return null;
};

const texto = (valor) => (valor ?? '').toString().toLowerCase();

/** Busca por número de factura, proveedor, notas o categoría. */
export const filtrarFacturas = (facturas = [], { busqueda = '', categoria = '', desde = '', hasta = '' } = {}) => {
  const termino = texto(busqueda).trim();

  return facturas.filter((factura) => {
    if (categoria && factura.categoria !== categoria) return false;
    if (desde && factura.fecha < desde) return false;
    if (hasta && factura.fecha > hasta) return false;
    if (!termino) return true;

    const categoriaNombre = categoriaPorId(factura.categoria).nombre;
    return [factura.numeroFactura, factura.proveedor, factura.notas, categoriaNombre]
      .some((campo) => texto(campo).includes(termino));
  });
};

export const CAMPOS_ORDEN = ['fecha', 'numeroFactura', 'proveedor', 'categoria', 'subtotal', 'impuesto', 'total'];

/**
 * Ordena facturas por el campo indicado. Devuelve una lista nueva.
 * Si el campo es la fecha se usa el número de factura como desempate.
 */
export const ordenarFacturas = (facturas = [], campo = 'fecha', direccion = 'desc') => {
  const factor = direccion === 'asc' ? 1 : -1;
  const copia = [...facturas];

  const comparar = (a, b) => {
    if (['subtotal', 'impuesto', 'total'].includes(campo)) return aNumero(a[campo]) - aNumero(b[campo]);
    if (campo === 'categoria') {
      return categoriaPorId(a.categoria).nombre.localeCompare(categoriaPorId(b.categoria).nombre, 'es');
    }
    return texto(a[campo]).localeCompare(texto(b[campo]), 'es', { numeric: true, sensitivity: 'base' });
  };

  copia.sort((a, b) => {
    const principal = comparar(a, b);
    if (principal !== 0) return principal * factor;

    // Desempate estable: fecha y luego número de factura (siempre ascendente).
    const porFecha = texto(a.fecha).localeCompare(texto(b.fecha));
    if (porFecha !== 0) return porFecha;
    return texto(a.numeroFactura).localeCompare(texto(b.numeroFactura), 'es', { numeric: true });
  });

  return copia;
};

/**
 * Totales generales, desglose por categoría y desglose por tasa de IVA
 * (para el control del 13% de Hacienda).
 */
export const calcularResumen = (facturas = []) => {
  const resumen = {
    cantidad: facturas.length,
    subtotal: 0,
    impuesto: 0,
    total: 0,
    porCategoria: [],
    porTasa: [],
    sinIva: 0,
  };

  const categorias = new Map();
  const tasas = new Map();

  facturas.forEach((factura) => {
    const subtotal = aNumero(factura.subtotal);
    const impuesto = aNumero(factura.impuesto);
    const total = aNumero(factura.total);

    resumen.subtotal += subtotal;
    resumen.impuesto += impuesto;
    resumen.total += total;
    if (impuesto === 0) resumen.sinIva += 1;

    const categoria = categoriaPorId(factura.categoria);
    const acumuladoCategoria = categorias.get(categoria.id) ?? {
      id: categoria.id,
      nombre: categoria.nombre,
      icono: categoria.icono,
      chip: categoria.chip,
      barra: categoria.barra,
      cantidad: 0,
      subtotal: 0,
      impuesto: 0,
      total: 0,
    };
    acumuladoCategoria.cantidad += 1;
    acumuladoCategoria.subtotal += subtotal;
    acumuladoCategoria.impuesto += impuesto;
    acumuladoCategoria.total += total;
    categorias.set(categoria.id, acumuladoCategoria);

    const tasa = aNumero(factura.tasaIva);
    const clave = Number.isFinite(tasa) ? tasa : 0;
    const acumuladoTasa = tasas.get(clave) ?? { tasa: clave, cantidad: 0, subtotal: 0, impuesto: 0, total: 0 };
    acumuladoTasa.cantidad += 1;
    acumuladoTasa.subtotal += subtotal;
    acumuladoTasa.impuesto += impuesto;
    acumuladoTasa.total += total;
    tasas.set(clave, acumuladoTasa);
  });

  resumen.porCategoria = [...categorias.values()]
    .map((categoria) => ({
      ...categoria,
      porcentaje: resumen.total > 0 ? (categoria.total / resumen.total) * 100 : 0,
    }))
    .sort((a, b) => b.total - a.total);

  resumen.porTasa = [...tasas.values()].sort((a, b) => b.tasa - a.tasa);

  return resumen;
};

/** Agrupa facturas por proyecto para el resumen de todos los proyectos. */
export const resumenPorProyecto = (facturas = [], proyectos = []) =>
  proyectos
    .map((proyecto) => {
      const propias = facturas.filter((factura) => factura.proyectoId === proyecto.id);
      const resumen = calcularResumen(propias);
      return { proyecto, ...resumen };
    })
    .sort((a, b) => b.total - a.total);

/** CSV compatible con Excel en español (separador ; y BOM UTF-8). */
export const facturasACSV = (facturas = [], { incluirProyecto = false, proyectos = [] } = {}) => {
  const nombreProyecto = (id) => proyectos.find((proyecto) => proyecto.id === id)?.nombre ?? '';

  const encabezados = [
    'Fecha',
    'No. factura',
    'Proveedor',
    'Categoria',
    ...(incluirProyecto ? ['Proyecto'] : []),
    'Subtotal',
    'IVA %',
    'IVA',
    'Total',
    'Metodo de pago',
    'Notas',
  ];

  const escapar = (valor) => {
    const cadena = (valor ?? '').toString().replace(/"/g, '""');
    return `"${cadena}"`;
  };

  const filas = facturas.map((factura) => {
    const fecha = factura.fecha ? factura.fecha.split('-').reverse().join('/') : '';
    return [
      fecha,
      factura.numeroFactura,
      factura.proveedor,
      categoriaPorId(factura.categoria).nombre,
      ...(incluirProyecto ? [nombreProyecto(factura.proyectoId)] : []),
      formatearNumero(factura.subtotal),
      formatearNumero(factura.tasaIva),
      formatearNumero(factura.impuesto),
      formatearNumero(factura.total),
      factura.metodoPago,
      (factura.notas ?? '').replace(/\r?\n/g, ' '),
    ].map(escapar).join(';');
  });

  const resumen = calcularResumen(facturas);
  const totales = [
    '',
    '',
    'TOTALES',
    '',
    ...(incluirProyecto ? [''] : []),
    formatearNumero(resumen.subtotal),
    '',
    formatearNumero(resumen.impuesto),
    formatearNumero(resumen.total),
    '',
    '',
  ].map(escapar).join(';');

  return `\uFEFF${[encabezados.map(escapar).join(';'), ...filas, totales].join('\r\n')}`;
};

export { CATEGORIAS };
