// Catálogo de proveedores: se alimenta solo con las facturas que se registran,
// para que al escribir las primeras letras aparezcan las coincidencias.

/** Normaliza un nombre para comparar (sin acentos, minúsculas, sin espacios extra). */
export const claveProveedor = (nombre = '') =>
  nombre
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

export const proveedorVacio = () => ({
  nombre: '',
  categoria: '',
  tasaIva: null,
  cuentaId: '',
  veces: 0,
  total: 0,
});

/** Convierte lo que viene de Firestore en un proveedor con tipos correctos. */
export const normalizarProveedor = (entrada = {}) => ({
  id: entrada.id ?? claveProveedor(entrada.nombre ?? ''),
  nombre: (entrada.nombre ?? '').toString().trim(),
  categoria: (entrada.categoria ?? '').toString(),
  tasaIva: entrada.tasaIva === null || entrada.tasaIva === undefined ? null : Number(entrada.tasaIva),
  cuentaId: (entrada.cuentaId ?? '').toString(),
  veces: Number(entrada.veces) || 0,
  total: Number(entrada.total) || 0,
});

/**
 * Filtra proveedores por lo que el usuario va escribiendo.
 * Primero los que empiezan con el texto, luego los que lo contienen;
 * dentro de cada grupo, los más usados primero.
 */
export const filtrarProveedores = (proveedores = [], texto = '', limite = 8) => {
  const termino = claveProveedor(texto);
  const ordenados = [...proveedores].sort((a, b) => (b.veces ?? 0) - (a.veces ?? 0) || a.nombre.localeCompare(b.nombre, 'es'));

  if (!termino) return ordenados.slice(0, limite);

  const empiezan = [];
  const contienen = [];

  ordenados.forEach((proveedor) => {
    const clave = claveProveedor(proveedor.nombre);
    if (clave.startsWith(termino)) empiezan.push(proveedor);
    else if (clave.includes(termino)) contienen.push(proveedor);
  });

  return [...empiezan, ...contienen].slice(0, limite);
};

/** ¿Ya existe un proveedor con ese nombre (sin importar mayúsculas/acentos)? */
export const buscarProveedor = (proveedores = [], nombre = '') => {
  const clave = claveProveedor(nombre);
  if (!clave) return null;
  return proveedores.find((proveedor) => claveProveedor(proveedor.nombre) === clave) ?? null;
};

/**
 * Reconstruye el catálogo a partir de las facturas (respaldo si la colección
 * `proveedores` está vacía o incompleta, p. ej. datos históricos).
 */
export const proveedoresDesdeFacturas = (facturas = []) => {
  const mapa = new Map();

  facturas.forEach((factura) => {
    const clave = claveProveedor(factura.proveedor);
    if (!clave) return;
    const actual = mapa.get(clave) ?? {
      id: clave,
      nombre: factura.proveedor.trim(),
      categoria: factura.categoria ?? '',
      tasaIva: Number(factura.tasaIva) || 0,
      cuentaId: factura.cuentaId ?? '',
      veces: 0,
      total: 0,
    };
    actual.veces += 1;
    actual.total += Number(factura.total) || 0;
    mapa.set(clave, actual);
  });

  return [...mapa.values()].sort((a, b) => b.veces - a.veces);
};

/** Une la colección de proveedores con los que aparecen en facturas. */
export const combinarProveedores = (guardados = [], facturas = []) => {
  const mapa = new Map();

  proveedoresDesdeFacturas(facturas).forEach((proveedor) => mapa.set(proveedor.id, proveedor));

  guardados.forEach((proveedor) => {
    const normalizado = normalizarProveedor(proveedor);
    const clave = normalizado.id || claveProveedor(normalizado.nombre);
    const desdeFacturas = mapa.get(clave);
    mapa.set(clave, {
      ...normalizado,
      id: clave,
      veces: Math.max(normalizado.veces, desdeFacturas?.veces ?? 0),
      total: Math.max(normalizado.total, desdeFacturas?.total ?? 0),
      categoria: normalizado.categoria || desdeFacturas?.categoria || '',
      tasaIva: normalizado.tasaIva ?? desdeFacturas?.tasaIva ?? null,
      cuentaId: normalizado.cuentaId || desdeFacturas?.cuentaId || '',
    });
  });

  return [...mapa.values()].sort((a, b) => b.veces - a.veces || a.nombre.localeCompare(b.nombre, 'es'));
};

/** id válido de documento para Firestore (sin barras ni caracteres raros). */
export const idProveedor = (nombre = '') =>
  claveProveedor(nombre).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'proveedor';
