// Utilidades de formato compartidas por la interfaz y el PDF.
// Se evita Intl.NumberFormat a propósito: usa espacios finos (U+202F) como
// separador de miles y la fuente estándar de jsPDF (WinAnsi) no los soporta.

/**
 * Convierte cualquier entrada (texto de un <input>, número, null) a número.
 * Devuelve 0 cuando el valor no es numérico.
 */
export const aNumero = (valor) => {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0;
  if (typeof valor !== 'string') return 0;

  const limpio = valor.replace(/[^\d.,-]/g, '');
  if (!limpio) return 0;

  // Si viene con coma decimal ("1,5") y sin punto, se interpreta como decimal.
  const normalizado =
    limpio.includes(',') && !limpio.includes('.')
      ? limpio.replace(',', '.')
      : limpio.replace(/,/g, '');

  const numero = Number.parseFloat(normalizado);
  return Number.isFinite(numero) ? numero : 0;
};

/** Igual que aNumero pero nunca devuelve valores negativos (cantidades, precios). */
export const aMonto = (valor) => Math.max(0, aNumero(valor));

/** Formatea un monto con separador de miles: 1234567 -> "1.234.567". */
export const formatearNumero = (valor) => {
  const numero = Math.round(aNumero(valor));
  const signo = numero < 0 ? '-' : '';
  return signo + Math.abs(numero).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

/** Monto con el símbolo del colón, para la interfaz web. */
export const formatearCRC = (valor) => `₡${formatearNumero(valor)}`;

/**
 * Monto para el PDF. La fuente estándar de jsPDF no incluye el glifo "₡"
 * (lo dibuja como "¡"), así que se usa el código ISO de la moneda.
 */
export const formatearCRCPdf = (valor) => `CRC ${formatearNumero(valor)}`;

const DOS_DIGITOS = (n) => String(n).padStart(2, '0');

/** Fecha en formato dd/mm/aaaa. Acepta Date, Timestamp de Firestore o texto. */
export const formatearFecha = (valor) => {
  if (valor && typeof valor.toDate === 'function') return formatearFecha(valor.toDate());
  if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
    return `${DOS_DIGITOS(valor.getDate())}/${DOS_DIGITOS(valor.getMonth() + 1)}/${valor.getFullYear()}`;
  }
  if (typeof valor === 'string' && valor.trim()) return valor;
  return formatearFecha(new Date());
};

/** Quita caracteres problemáticos para nombrar archivos. */
export const limpiarNombreArchivo = (valor, respaldo = 'cotizacion') => {
  const limpio = (valor ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9-_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return limpio || respaldo;
};
