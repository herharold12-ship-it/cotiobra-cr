import { useEffect, useState } from 'react';
import { CATEGORIAS, METODOS_PAGO, categoriaPorId } from './categorias.js';
import { normalizarFactura, validarFactura } from './resumen.js';
import { aMonto, aNumero, fechaISOaTexto, formatearCRC } from '../formato.js';

const claseCampo =
  'w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-blue-500 transition-colors';

const claseEtiqueta = 'block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1';

const redondear = (valor) => Math.round(aNumero(valor));

/**
 * Formulario de alta/edición de una factura de gasto.
 * El IVA y el total se completan solos, pero se pueden ajustar a mano
 * (algunas facturas traen redondeos o exenciones).
 */
export default function FormularioFactura({ factura, proyectos, guardando, onGuardar, onCerrar }) {
  const [datos, setDatos] = useState(() => normalizarFactura(factura));
  const [error, setError] = useState('');

  useEffect(() => {
    const alPresionarTecla = (evento) => {
      if (evento.key === 'Escape') onCerrar();
    };
    document.addEventListener('keydown', alPresionarTecla);
    return () => document.removeEventListener('keydown', alPresionarTecla);
  }, [onCerrar]);

  const actualizar = (campo, valor) => setDatos((previos) => ({ ...previos, [campo]: valor }));

  // Al cambiar subtotal o tasa, se recalculan IVA y total.
  const recalcular = (base, tasa) => {
    const subtotal = redondear(base);
    const porcentaje = Math.min(100, Math.max(0, aNumero(tasa)));
    const impuesto = Math.round(subtotal * (porcentaje / 100));
    return { subtotal, impuesto, total: subtotal + impuesto };
  };

  const cambiarSubtotal = (valor) => {
    setDatos((previos) => ({ ...previos, ...recalcular(valor, previos.tasaIva), subtotal: redondear(valor) }));
  };

  const cambiarTasa = (valor) => {
    setDatos((previos) => ({ ...previos, ...recalcular(previos.subtotal, valor), tasaIva: valor }));
  };

  const cambiarImpuesto = (valor) => {
    setDatos((previos) => {
      const impuesto = redondear(valor);
      return { ...previos, impuesto, total: aMonto(previos.subtotal) + impuesto };
    });
  };

  const ajustarIva13 = () => {
    setDatos((previos) => ({ ...previos, ...recalcular(previos.subtotal, 13), tasaIva: 13 }));
  };

  const enviar = (evento) => {
    evento.preventDefault();
    const normalizada = normalizarFactura(datos);
    const problema = validarFactura(normalizada);
    if (problema) {
      setError(problema);
      return;
    }
    setError('');
    onGuardar(normalizada);
  };

  const categoria = categoriaPorId(datos.categoria);

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-950/80 backdrop-blur-sm p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-factura"
    >
      <form
        onSubmit={enviar}
        className="w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
          <div>
            <h2 id="titulo-factura" className="text-lg font-bold text-white">
              {datos.id ? 'Editar factura' : 'Registrar factura de gasto'}
            </h2>
            <p className="text-xs text-slate-400">Gasto real imputado a un proyecto de obra.</p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="text-slate-400 hover:text-white text-lg leading-none px-2 py-1 rounded-lg hover:bg-slate-800"
            aria-label="Cerrar formulario"
          >
            ✕
          </button>
        </header>

        <div className="px-5 py-4 space-y-4">
          {error && (
            <p role="alert" className="text-sm text-red-200 bg-red-950/60 border border-red-800 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="sm:col-span-2 lg:col-span-3">
              <label className={claseEtiqueta} htmlFor="factura-proyecto">Proyecto / obra *</label>
              <select
                id="factura-proyecto"
                className={claseCampo}
                value={datos.proyectoId}
                onChange={(evento) => actualizar('proyectoId', evento.target.value)}
                required
              >
                <option value="">Selecciona el proyecto…</option>
                {proyectos.map((proyecto) => (
                  <option key={proyecto.id} value={proyecto.id}>
                    {proyecto.nombre}{proyecto.ubicacion ? ` — ${proyecto.ubicacion}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={claseEtiqueta} htmlFor="factura-fecha">Fecha *</label>
              <input
                id="factura-fecha"
                type="date"
                className={claseCampo}
                value={datos.fecha}
                onChange={(evento) => actualizar('fecha', evento.target.value)}
                required
              />
              <p className="text-[11px] text-slate-500 mt-1">{datos.fecha ? fechaISOaTexto(datos.fecha) : 'dd/mm/aaaa'}</p>
            </div>

            <div>
              <label className={claseEtiqueta} htmlFor="factura-numero">N.º de factura *</label>
              <input
                id="factura-numero"
                type="text"
                className={claseCampo}
                placeholder="Ej. 001-000123"
                value={datos.numeroFactura}
                onChange={(evento) => actualizar('numeroFactura', evento.target.value)}
                required
              />
            </div>

            <div>
              <label className={claseEtiqueta} htmlFor="factura-proveedor">Proveedor / casa comercial *</label>
              <input
                id="factura-proveedor"
                type="text"
                className={claseCampo}
                placeholder="Ej. EPA Liberia"
                value={datos.proveedor}
                onChange={(evento) => actualizar('proveedor', evento.target.value)}
                required
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <label className={claseEtiqueta} htmlFor="factura-categoria">Clasificación del gasto</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {CATEGORIAS.map((opcion) => {
                  const activa = datos.categoria === opcion.id;
                  return (
                    <button
                      key={opcion.id}
                      type="button"
                      onClick={() => actualizar('categoria', opcion.id)}
                      aria-pressed={activa}
                      className={`flex items-center gap-2 text-left text-xs px-3 py-2 rounded-lg border transition-colors ${
                        activa
                          ? 'border-blue-500 bg-blue-500/10 text-white'
                          : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <span aria-hidden="true">{opcion.icono}</span>
                      <span className="truncate">{opcion.nombre}</span>
                    </button>
                  );
                })}
              </div>
              <select
                id="factura-categoria"
                className="sr-only"
                value={datos.categoria}
                onChange={(evento) => actualizar('categoria', evento.target.value)}
                tabIndex={-1}
                aria-hidden="true"
              >
                {CATEGORIAS.map((opcion) => (
                  <option key={opcion.id} value={opcion.id}>{opcion.nombre}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={claseEtiqueta} htmlFor="factura-subtotal">Subtotal (₡) *</label>
              <input
                id="factura-subtotal"
                type="number"
                min="0"
                step="1"
                className={claseCampo}
                value={datos.subtotal}
                onChange={(evento) => cambiarSubtotal(evento.target.value)}
              />
              <p className="text-[11px] text-slate-500 mt-1">{formatearCRC(datos.subtotal)}</p>
            </div>

            <div>
              <label className={claseEtiqueta} htmlFor="factura-tasa">IVA (%)</label>
              <input
                id="factura-tasa"
                type="number"
                min="0"
                max="100"
                step="1"
                className={claseCampo}
                value={datos.tasaIva}
                onChange={(evento) => cambiarTasa(evento.target.value)}
              />
              <button
                type="button"
                onClick={ajustarIva13}
                className="text-[11px] text-blue-400 hover:text-blue-300 mt-1"
              >
                Aplicar 13% de Hacienda
              </button>
            </div>

            <div>
              <label className={claseEtiqueta} htmlFor="factura-impuesto">IVA en colones (₡)</label>
              <input
                id="factura-impuesto"
                type="number"
                min="0"
                step="1"
                className={claseCampo}
                value={datos.impuesto}
                onChange={(evento) => cambiarImpuesto(evento.target.value)}
              />
              <p className="text-[11px] text-slate-500 mt-1">{formatearCRC(datos.impuesto)}</p>
            </div>

            <div>
              <label className={claseEtiqueta} htmlFor="factura-total">Total de la factura (₡) *</label>
              <input
                id="factura-total"
                type="number"
                min="0"
                step="1"
                className={`${claseCampo} font-semibold text-emerald-300`}
                value={datos.total}
                onChange={(evento) => actualizar('total', redondear(evento.target.value))}
              />
              <p className="text-[11px] text-slate-500 mt-1">{formatearCRC(datos.total)}</p>
            </div>

            <div>
              <label className={claseEtiqueta} htmlFor="factura-metodo">Método de pago</label>
              <select
                id="factura-metodo"
                className={claseCampo}
                value={datos.metodoPago}
                onChange={(evento) => actualizar('metodoPago', evento.target.value)}
              >
                {METODOS_PAGO.map((metodo) => (
                  <option key={metodo} value={metodo}>{metodo}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <label className={claseEtiqueta} htmlFor="factura-notas">Notas / detalle</label>
              <textarea
                id="factura-notas"
                rows={2}
                className={`${claseCampo} resize-none`}
                placeholder="Ej. 2 viajes de material para la losa del segundo piso"
                value={datos.notas}
                onChange={(evento) => actualizar('notas', evento.target.value)}
              />
            </div>
          </div>

          <div className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2 text-xs ${categoria.chip}`}>
            <span>
              {categoria.icono} Se guardará como <strong>{categoria.nombre}</strong>
            </span>
            <span className="font-mono">
              {formatearCRC(datos.subtotal)} + {formatearCRC(datos.impuesto)} = {formatearCRC(datos.total)}
            </span>
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-800 px-5 py-4">
          <button
            type="button"
            onClick={onCerrar}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium px-4 py-2 rounded-lg border border-slate-700 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {guardando ? 'Guardando…' : datos.id ? 'Guardar cambios' : 'Registrar factura'}
          </button>
        </footer>
      </form>
    </div>
  );
}
