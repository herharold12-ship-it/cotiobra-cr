import { useEffect, useMemo, useState } from 'react';
import { METODOS_PAGO } from './categorias.js';
import {
  MODALIDADES_PAGO,
  calcularTotalPlanilla,
  describirCantidad,
  esPorCantidad,
  modalidadPorId,
  normalizarPlanilla,
  validarPlanilla,
} from './planillas.js';
import { aMonto, aNumero, fechaISOaTexto, formatearCRC, formatearNumero } from '../formato.js';

const claseCampo =
  'w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-blue-500 transition-colors';
const claseEtiqueta = 'block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1';
const claseSeccion = 'rounded-xl border border-slate-800 bg-slate-950/40 p-3';

const redondear = (valor) => Math.round(aNumero(valor));

/**
 * Última tarifa que se le pagó a un trabajador con esa misma forma de pago.
 * Sirve para no volver a escribir el monto cada semana.
 */
const tarifaSugerida = (historial, trabajador, modalidad) => {
  const nombre = (trabajador ?? '').trim().toLowerCase();
  if (!nombre) return null;
  const pagos = historial
    .filter(
      (item) =>
        (item.trabajador ?? '').trim().toLowerCase() === nombre &&
        modalidadPorId(item.modalidad).id === modalidad &&
        aNumero(item.tarifa) > 0,
    )
    .sort((a, b) => (b.fecha ?? '').localeCompare(a.fecha ?? ''));
  return pagos[0] ? { tarifa: aNumero(pagos[0].tarifa), puesto: pagos[0].puesto ?? '' } : null;
};

/** Registro de un pago de planilla (por hora, día, semana, quincena, mes o monto fijo). */
export default function FormularioPlanilla({
  planilla,
  proyectos,
  cuentas = [],
  historial = [],
  guardando,
  onGuardar,
  onCerrar,
}) {
  const [datos, setDatos] = useState(() => normalizarPlanilla(planilla));
  const [totalManual, setTotalManual] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const alPresionarTecla = (evento) => {
      if (evento.key === 'Escape') onCerrar();
    };
    document.addEventListener('keydown', alPresionarTecla);
    return () => document.removeEventListener('keydown', alPresionarTecla);
  }, [onCerrar]);

  const modalidad = modalidadPorId(datos.modalidad);
  const porCantidad = esPorCantidad(modalidad.id);
  const calculado = calcularTotalPlanilla(datos);

  /** Aplica cambios y recalcula el total, salvo que se esté ajustando a mano. */
  const cambiar = (cambios) => {
    setDatos((previos) => {
      const siguiente = { ...previos, ...cambios };
      if (!esPorCantidad(siguiente.modalidad)) siguiente.cantidad = 1;
      return totalManual ? siguiente : { ...siguiente, total: calcularTotalPlanilla(siguiente) };
    });
  };

  /** Al cambiar la forma de pago se recalcula siempre (el total manual deja de aplicar). */
  const cambiarModalidad = (id) => {
    setTotalManual(false);
    setDatos((previos) => {
      const siguiente = { ...previos, modalidad: id };
      if (!esPorCantidad(id)) siguiente.cantidad = 1;
      return { ...siguiente, total: calcularTotalPlanilla(siguiente) };
    });
  };

  /** Al escribir el nombre se reutiliza su puesto y su última tarifa. */
  const cambiarTrabajador = (valor) => {
    const sugerencia = tarifaSugerida(historial, valor, modalidad.id);
    const cambios = { trabajador: valor };
    if (sugerencia && aNumero(datos.tarifa) === 0) cambios.tarifa = sugerencia.tarifa;
    if (sugerencia?.puesto && !datos.puesto) cambios.puesto = sugerencia.puesto;
    cambiar(cambios);
  };

  const trabajadoresConocidos = useMemo(() => {
    const mapa = new Map();
    historial.forEach((item) => {
      const nombre = (item.trabajador ?? '').trim();
      if (!nombre) return;
      const clave = nombre.toLowerCase();
      if (!mapa.has(clave)) mapa.set(clave, { nombre, puesto: item.puesto ?? '' });
    });
    return [...mapa.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  }, [historial]);

  const enviar = (evento) => {
    evento.preventDefault();
    const normalizada = normalizarPlanilla(datos);
    const problema = validarPlanilla(normalizada);
    if (problema) {
      setError(problema);
      return;
    }
    setError('');
    onGuardar(normalizada);
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-950/80 backdrop-blur-sm p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-planilla"
    >
      <form onSubmit={enviar} className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl my-auto">
        <header className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
          <div>
            <h2 id="titulo-planilla" className="text-lg font-bold text-white">
              {datos.id ? 'Editar pago de planilla' : 'Registrar pago de planilla'}
            </h2>
            <p className="text-xs text-slate-400">Elige cómo se le paga y la app calcula el total. Sin IVA.</p>
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

          {/* 1. Datos de la persona */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={claseEtiqueta} htmlFor="planilla-trabajador">¿A quién se le paga? *</label>
              <input
                id="planilla-trabajador"
                type="text"
                list="planilla-trabajadores"
                autoFocus
                className={claseCampo}
                placeholder="Escribe el nombre…"
                value={datos.trabajador}
                onChange={(evento) => cambiarTrabajador(evento.target.value)}
                required
              />
              <datalist id="planilla-trabajadores">
                {trabajadoresConocidos.map((persona) => (
                  <option key={persona.nombre} value={persona.nombre} />
                ))}
              </datalist>

              {!datos.id && trabajadoresConocidos.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {trabajadoresConocidos.slice(0, 5).map((persona) => (
                    <button
                      key={persona.nombre}
                      type="button"
                      onClick={() => cambiarTrabajador(persona.nombre)}
                      className="text-[10px] px-2 py-0.5 rounded-full border border-slate-700 bg-slate-800 text-slate-300 hover:border-blue-500"
                    >
                      {persona.nombre}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <label className={claseEtiqueta} htmlFor="planilla-puesto">Puesto / oficio</label>
              <input
                id="planilla-puesto"
                type="text"
                className={claseCampo}
                placeholder="Ej. Peón, oficial, maestro de obra"
                value={datos.puesto}
                onChange={(evento) => cambiar({ puesto: evento.target.value })}
              />
            </div>
          </div>

          {/* 2. Forma de pago */}
          <div>
            <p className={claseEtiqueta}>¿Cómo se le reconoce el pago? *</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {MODALIDADES_PAGO.map((opcion) => {
                const activa = datos.modalidad === opcion.id;
                return (
                  <button
                    key={opcion.id}
                    type="button"
                    onClick={() => cambiarModalidad(opcion.id)}
                    aria-pressed={activa}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors ${
                      activa
                        ? 'border-blue-500 bg-blue-600/20 text-white'
                        : 'border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    <span className="text-base">{opcion.icono}</span>
                    <span className="text-sm font-medium leading-tight">{opcion.nombre}</span>
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">{modalidad.ejemplo}</p>
          </div>

          {/* 3. Cantidad y tarifa */}
          <div className={claseSeccion}>
            <div className={porCantidad ? 'grid grid-cols-1 sm:grid-cols-2 gap-4' : ''}>
              {porCantidad && (
                <div>
                  <label className={claseEtiqueta} htmlFor="planilla-cantidad">
                    {modalidad.etiquetaCantidad} *
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="planilla-cantidad"
                      type="number"
                      min="0"
                      step={modalidad.paso}
                      inputMode="decimal"
                      className={`${claseCampo} text-lg font-semibold`}
                      value={datos.cantidad}
                      onChange={(evento) => cambiar({ cantidad: evento.target.value })}
                    />
                    <span className="text-xs text-slate-400 w-16 shrink-0">{modalidad.unidad}</span>
                  </div>
                  {modalidad.rapidos.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {modalidad.rapidos.map((valor) => (
                        <button
                          key={valor}
                          type="button"
                          onClick={() => cambiar({ cantidad: valor })}
                          className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors ${
                            aNumero(datos.cantidad) === valor
                              ? 'border-blue-500 bg-blue-600/30 text-white'
                              : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-500'
                          }`}
                        >
                          {valor} {valor === 1 ? modalidad.singular : modalidad.plural}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className={claseEtiqueta} htmlFor="planilla-tarifa">
                  {modalidad.etiquetaTarifa} *
                </label>
                <input
                  id="planilla-tarifa"
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  className={`${claseCampo} text-lg font-semibold`}
                  placeholder="0"
                  value={datos.tarifa}
                  onChange={(evento) => cambiar({ tarifa: redondear(evento.target.value) })}
                />
                <p className="text-[11px] text-slate-500 mt-1">₡{formatearNumero(datos.tarifa)}</p>
              </div>
            </div>

            {/* Cálculo en vivo */}
            <div className="mt-3 rounded-lg border border-emerald-700/40 bg-emerald-950/30 px-3 py-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-emerald-200/80">
                {porCantidad
                  ? `${aNumero(datos.cantidad)} ${aNumero(datos.cantidad) === 1 ? modalidad.singular : modalidad.plural} × ${formatearCRC(datos.tarifa)}`
                  : 'Monto fijo'}
                {aMonto(datos.extras) > 0 ? ` + ${formatearCRC(datos.extras)} extras` : ''}
                {aMonto(datos.deducciones) > 0 ? ` − ${formatearCRC(datos.deducciones)}` : ''}
              </span>
              <span className="text-xl font-bold text-emerald-300 font-mono">{formatearCRC(datos.total)}</span>
            </div>
          </div>

          {/* 4. Extras y deducciones (opcional) */}
          <details className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
            <summary className="cursor-pointer text-xs font-semibold text-slate-400">
              Extras o deducciones (opcional)
            </summary>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3">
              <div>
                <label className={claseEtiqueta} htmlFor="planilla-extras">Extras / bonos (₡)</label>
                <input
                  id="planilla-extras"
                  type="number"
                  min="0"
                  step="1"
                  className={claseCampo}
                  value={datos.extras}
                  onChange={(evento) => cambiar({ extras: redondear(evento.target.value) })}
                />
                <p className="text-[11px] text-slate-500 mt-1">Horas extra, viáticos, bonos.</p>
              </div>
              <div>
                <label className={claseEtiqueta} htmlFor="planilla-deducciones">Deducciones (₡)</label>
                <input
                  id="planilla-deducciones"
                  type="number"
                  min="0"
                  step="1"
                  className={claseCampo}
                  value={datos.deducciones}
                  onChange={(evento) => cambiar({ deducciones: redondear(evento.target.value) })}
                />
                <p className="text-[11px] text-slate-500 mt-1">Adelantos, CCSS, préstamos.</p>
              </div>
            </div>
          </details>

          {/* 5. Fecha, período, cuenta */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={claseEtiqueta} htmlFor="planilla-fecha">Fecha de pago *</label>
              <input
                id="planilla-fecha"
                type="date"
                className={claseCampo}
                value={datos.fecha}
                onChange={(evento) => cambiar({ fecha: evento.target.value })}
                required
              />
              <p className="text-[11px] text-slate-500 mt-1">{datos.fecha ? fechaISOaTexto(datos.fecha) : 'dd/mm/aaaa'}</p>
            </div>

            <div>
              <label className={claseEtiqueta} htmlFor="planilla-proyecto">Proyecto / obra *</label>
              <select
                id="planilla-proyecto"
                className={claseCampo}
                value={datos.proyectoId}
                onChange={(evento) => cambiar({ proyectoId: evento.target.value })}
                required
              >
                <option value="">Selecciona el proyecto…</option>
                {proyectos.map((proyecto) => (
                  <option key={proyecto.id} value={proyecto.id}>{proyecto.nombre}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={claseEtiqueta} htmlFor="planilla-desde">Período desde</label>
                  <input
                    id="planilla-desde"
                    type="date"
                    className={claseCampo}
                    value={datos.periodoDesde}
                    onChange={(evento) => cambiar({ periodoDesde: evento.target.value })}
                  />
                </div>
                <div>
                  <label className={claseEtiqueta} htmlFor="planilla-hasta">Período hasta</label>
                  <input
                    id="planilla-hasta"
                    type="date"
                    className={claseCampo}
                    value={datos.periodoHasta}
                    onChange={(evento) => cambiar({ periodoHasta: evento.target.value })}
                  />
                </div>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Opcional: se usa solo para saber a qué semana o quincena corresponde el pago.
              </p>
            </div>

            <div>
              <label className={claseEtiqueta} htmlFor="planilla-cuenta">Pagado con</label>
              <select
                id="planilla-cuenta"
                className={claseCampo}
                value={datos.cuentaId}
                onChange={(evento) => cambiar({ cuentaId: evento.target.value })}
              >
                <option value="">Sin asignar</option>
                {cuentas.map((cuenta) => (
                  <option key={cuenta.id} value={cuenta.id}>{cuenta.nombre}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={claseEtiqueta} htmlFor="planilla-metodo">Método de pago</label>
              <select
                id="planilla-metodo"
                className={claseCampo}
                value={datos.metodoPago}
                onChange={(evento) => cambiar({ metodoPago: evento.target.value })}
              >
                {METODOS_PAGO.map((metodo) => (
                  <option key={metodo} value={metodo}>{metodo}</option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className={claseEtiqueta} htmlFor="planilla-notas">Notas</label>
              <textarea
                id="planilla-notas"
                rows={2}
                className={`${claseCampo} resize-none`}
                placeholder="Ej. Semana 12, incluye sábado"
                value={datos.notas}
                onChange={(evento) => cambiar({ notas: evento.target.value })}
              />
            </div>
          </div>

          <details className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
            <summary className="cursor-pointer text-xs font-semibold text-slate-400">Ajustar el total a mano</summary>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 items-end">
              <div>
                <label className={claseEtiqueta} htmlFor="planilla-total">Total a pagar (₡)</label>
                <input
                  id="planilla-total"
                  type="number"
                  min="0"
                  step="1"
                  className={`${claseCampo} font-semibold text-emerald-300`}
                  value={datos.total}
                  onChange={(evento) => {
                    setTotalManual(true);
                    setDatos((previos) => ({ ...previos, total: redondear(evento.target.value) }));
                  }}
                />
                <p className="text-[11px] text-slate-500 mt-1">Se calcula solo: {formatearCRC(calculado)}.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTotalManual(false);
                  setDatos((previos) => ({ ...previos, total: calcularTotalPlanilla(previos) }));
                }}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium px-3 py-2 rounded-lg border border-slate-700"
              >
                ↩︎ Volver al cálculo automático
              </button>
            </div>
          </details>

          <p className="text-[11px] text-slate-500">
            Se registrará: <span className="text-slate-300">{datos.trabajador || 'trabajador'}</span> ·{' '}
            {describirCantidad(datos)} · {formatearCRC(datos.total)}
          </p>
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
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors disabled:opacity-60"
          >
            {guardando ? 'Guardando…' : datos.id ? 'Guardar cambios' : 'Registrar pago'}
          </button>
        </footer>
      </form>
    </div>
  );
}
