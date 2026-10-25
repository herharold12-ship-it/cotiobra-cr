// Cálculos de la cotización.
// Están en un solo lugar para que la pantalla y el PDF siempre coincidan.

import { aMonto, aNumero } from './formato.js';

export const PORCENTAJES_POR_DEFECTO = {
  imprevistos: 5,
  utilidad: 10,
  iva: 13,
};

const porcentajeSeguro = (valor, respaldo) => {
  const numero = aNumero(valor);
  if (valor === '' || valor === null || valor === undefined) return respaldo;
  return Math.min(100, Math.max(0, numero));
};

const subtotalMateriales = (materiales = []) =>
  materiales.reduce((acc, i) => acc + aMonto(i.cantidad) * aMonto(i.precioUnitario), 0);

const subtotalManoDeObra = (manoDeObra = []) =>
  manoDeObra.reduce((acc, i) => acc + aMonto(i.horasDias) * aMonto(i.costoUnidad), 0);

const subtotalEquipos = (equipos = []) =>
  equipos.reduce((acc, i) => acc + aMonto(i.dias) * aMonto(i.costoDia), 0);

const subtotalSubcontratos = (subcontratos = []) =>
  subcontratos.reduce((acc, i) => acc + aMonto(i.costoTotal), 0);

/**
 * Calcula el desglose completo de la oferta.
 * Los imprevistos y la utilidad se aplican sobre el costo directo y el IVA
 * sobre el subtotal neto (costo directo + imprevistos + utilidad).
 */
export const calcularTotales = ({
  materiales = [],
  manoDeObra = [],
  equipos = [],
  subcontratos = [],
  porcentajeImprevistos = PORCENTAJES_POR_DEFECTO.imprevistos,
  porcentajeUtilidad = PORCENTAJES_POR_DEFECTO.utilidad,
  porcentajeIva = PORCENTAJES_POR_DEFECTO.iva,
} = {}) => {
  const totalesMateriales = subtotalMateriales(materiales);
  const totalesManoDeObra = subtotalManoDeObra(manoDeObra);
  const totalesEquipos = subtotalEquipos(equipos);
  const totalesSubcontratos = subtotalSubcontratos(subcontratos);

  const costoDirectoTotal =
    totalesMateriales + totalesManoDeObra + totalesEquipos + totalesSubcontratos;

  const pctImprevistos = porcentajeSeguro(porcentajeImprevistos, PORCENTAJES_POR_DEFECTO.imprevistos);
  const pctUtilidad = porcentajeSeguro(porcentajeUtilidad, PORCENTAJES_POR_DEFECTO.utilidad);
  const pctIva = porcentajeSeguro(porcentajeIva, PORCENTAJES_POR_DEFECTO.iva);

  const montoImprevistos = costoDirectoTotal * (pctImprevistos / 100);
  const montoUtilidad = costoDirectoTotal * (pctUtilidad / 100);
  const subtotalNeto = costoDirectoTotal + montoImprevistos + montoUtilidad;
  const montoIva = subtotalNeto * (pctIva / 100);
  const totalGeneral = subtotalNeto + montoIva;

  return {
    subtotalMateriales: totalesMateriales,
    subtotalManoDeObra: totalesManoDeObra,
    subtotalEquipos: totalesEquipos,
    subtotalSubcontratos: totalesSubcontratos,
    costoDirectoTotal,
    porcentajeImprevistos: pctImprevistos,
    montoImprevistos,
    porcentajeUtilidad: pctUtilidad,
    montoUtilidad,
    subtotalNeto,
    porcentajeIva: pctIva,
    montoIva,
    totalGeneral,
  };
};

/**
 * Convierte las tablas de la pantalla en las filas que consume el PDF.
 * Se incluye el rubro para poder agruparlas en el documento.
 */
export const construirItems = ({ materiales = [], manoDeObra = [], equipos = [], subcontratos = [] } = {}) => {
  const filas = [];

  materiales.forEach((item) => {
    const cantidad = aMonto(item.cantidad);
    const precio = aMonto(item.precioUnitario);
    const descripcion = (item.descripcion ?? '').toString().trim();
    if (!descripcion && cantidad * precio === 0) return;
    filas.push({
      rubro: 'Materiales e insumos',
      descripcion: descripcion || 'Material sin descripción',
      detalle: (item.marca ?? '').toString().trim(),
      unidad: (item.unidad ?? '').toString().trim() || 'Unid',
      cantidad,
      precioUnitario: precio,
    });
  });

  manoDeObra.forEach((item) => {
    const cantidad = aMonto(item.horasDias);
    const precio = aMonto(item.costoUnidad);
    const descripcion = (item.concepto ?? '').toString().trim();
    if (!descripcion && cantidad * precio === 0) return;
    filas.push({
      rubro: 'Mano de obra',
      descripcion: descripcion || 'Personal sin descripción',
      detalle: (item.especialidad ?? '').toString().trim(),
      unidad: 'Día(s)',
      cantidad,
      precioUnitario: precio,
    });
  });

  equipos.forEach((item) => {
    const cantidad = aMonto(item.dias);
    const precio = aMonto(item.costoDia);
    const descripcion = (item.descripcion ?? '').toString().trim();
    if (!descripcion && cantidad * precio === 0) return;
    filas.push({
      rubro: 'Equipos y alquileres',
      descripcion: descripcion || 'Equipo sin descripción',
      detalle: (item.tipo ?? '').toString().trim(),
      unidad: 'Día(s)',
      cantidad,
      precioUnitario: precio,
    });
  });

  subcontratos.forEach((item) => {
    const precio = aMonto(item.costoTotal);
    const descripcion = (item.servicio ?? '').toString().trim();
    if (!descripcion && precio === 0) return;
    filas.push({
      rubro: 'Subcontratos',
      descripcion: descripcion || 'Servicio sin descripción',
      detalle: (item.proveedor ?? '').toString().trim(),
      unidad: 'Global',
      cantidad: 1,
      precioUnitario: precio,
    });
  });

  return filas.map((fila) => ({
    ...fila,
    subtotal: fila.cantidad * fila.precioUnitario,
  }));
};
