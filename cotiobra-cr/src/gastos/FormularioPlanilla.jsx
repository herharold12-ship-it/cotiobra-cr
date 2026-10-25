import { useEffect, useState } from 'react';
import { METODOS_PAGO } from './categorias.js';
import { calcularTotalPlanilla, normalizarPlanilla, validarPlanilla } from './planillas.js';
import { aMonto, aNumero, fechaISOaTexto, formatearCRC } from '../formato.js';

const claseCampo =
  'w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-blue-500 transition-colors';
const claseEtiqueta = 'block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1';

const redondear = (valor) => Math.round(aNumero(valor));

/** Registro de un pago de planilla (jornal) dentro de la sección de gastos. */
export default function FormularioPlanilla({ planilla, proyectos, cuentas = [], guardando, onGuardar, onCerrar }) {
  const [datos, setDatos] = useState(() => normalizarPlanilla(planilla));
  const [error, setError] = useState('');

  useEffect(() => {
    const alPresionarTecla = (evento) => {
      if (evento.key === 'Escape') onCerrar();
    };
    document.addEventListener('keydown', alPresionarTecla);
    return () => document.removeEventListener('keydown', alPresionarTecla);
  }, [onCerrar]);

  const actualizar = (campo, valor) => setDatos((previos) => ({ ...previos, [campo]: valor }));

  /** Cualquier cambio en días/jornal/extras recalcula el total a pagar. */
  const actualizarCalculando = (campo, valor) => {
    setDatos((previos) => {
      const siguiente = { ...previos, [campo]: valor };
      return { ...siguiente, total: calcularTotalPlanilla(siguiente) };
    });
  };

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
            <p className="text-xs text-slate-400">Jornales del personal de la obra. Se suman al gasto real (sin IVA).</p>
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={claseEtiqueta} htmlFor="planilla-proyecto">Proyecto / obra *</label>
              <select
                id="planilla-proyecto"
                className={claseCampo}
                value={datos.proyectoId}
                onChange={(evento) => actualizar('proyectoId', evento.target.value)}
                required
              >
                <option value="">Selecciona el proyecto…</option>
                {proyectos.map((proyecto) => (
                  <option key={proyecto.id} value={proyecto.id}>{proyecto.nombre}</option>
                ))}
              </select>
            </div>

            <div>
              <label className={claseEtiqueta} htmlFor="planilla-trabajador">Trabajador *</label>
              <input
                id="planilla-trabajador"
                type="text"
                className={claseCampo}
                placeholder="Ej. José Ramírez"
                value={datos.trabajador}
                onChange={(evento) => actualizar('trabajador', evento.target.value)}
                required
              />
            </div>

            <div>
              <label className={claseEtiqueta} htmlFor="planilla-puesto">Puesto / oficio</label>
              <input
                id="planilla-puesto"
                type="text"
                className={claseCampo}
                placeholder="Ej. Peón, oficial, maestro de obra"
                value={datos.puesto}
                onChange={(evento) => actualizar('puesto', evento.target.value)}
              />
            </div>

            <div>
              <label className={claseEtiqueta} htmlFor="planilla-desde">Período desde</label>
              <input
                id="planilla-desde"
                type="date"
                className={claseCampo}
                value={datos.periodoDesde}
                onChange={(evento) => actualizar('periodoDesde', evento.target.value)}
              />
            </div>

            <div>
              <label className={claseEtiqueta} htmlFor="planilla-hasta">Período hasta</label>
              <input
                id="planilla-hasta"
                type="date"
                className={claseCampo}
                value={datos.periodoHasta}
                onChange={(evento) => actualizar('periodoHasta', evento.target.value)}
              />
            </div>

            <div>
              <label className={claseEtiqueta} htmlFor="planilla-fecha">Fecha de pago *</label>
              <input
                id="planilla-fecha"
                type="date"
                className={claseCampo}
                value={datos.fecha}
                onChange={(evento) => actualizar('fecha', evento.target.value)}
                required
              />
              <p className="text-[11px] text-slate-500 mt-1">{datos.fecha ? fechaISOaTexto(datos.fecha) : 'dd/mm/aaaa'}</p>
            </div>

            <div>
              <label className={claseEtiqueta} htmlFor="planilla-dias">Días trabajados</label>
              <input
                id="planilla-dias"
                type="number"
                min="0"
                step="0.5"
                className={claseCampo}
                value={datos.dias}
                onChange={(evento) => actualizarCalculando('dias', evento.target.value)}
              />
            </div>

            <div>
              <label className={claseEtiqueta} htmlFor="planilla-jornal">Jornal por día (₡)</label>
              <input
                id="planilla-jornal"
                type="number"
                min="0"
                step="1"
                className={claseCampo}
                value={datos.jornalDia}
                onChange={(evento) => actualizarCalculando('jornalDia', redondear(evento.target.value))}
              />
            </div>

            <div>
              <label className={claseEtiqueta} htmlFor="planilla-extras">Horas extra / bonificaciones (₡)</label>
              <input
                id="planilla-extras"
                type="number"
                min="0"
                step="1"
                className={claseCampo}
                value={datos.horasExtra}
                onChange={(evento) => actualizarCalculando('horasExtra', redondear(evento.target.value))}
              />
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
                onChange={(evento) => actualizarCalculando('deducciones', redondear(evento.target.value))}
              />
              <p className="text-[11px] text-slate-500 mt-1">Adelantos, CCSS, préstamos, etc.</p>
            </div>

            <div>
              <label className={claseEtiqueta} htmlFor="planilla-total">Total a pagar (₡) *</label>
              <input
                id="planilla-total"
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
              <label className={claseEtiqueta} htmlFor="planilla-cuenta">Pagado con</label>
              <select
                id="planilla-cuenta"
                className={claseCampo}
                value={datos.cuentaId}
                onChange={(evento) => actualizar('cuentaId', evento.target.value)}
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
                onChange={(evento) => actualizar('metodoPago', evento.target.value)}
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
                onChange={(evento) => actualizar('notas', evento.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs text-green-200">
            <span>👷 Planilla · sin IVA</span>
            <span className="font-mono">
              {aMonto(datos.dias)} día(s) × {formatearCRC(datos.jornalDia)} + {formatearCRC(datos.horasExtra)} − {formatearCRC(datos.deducciones)} = {formatearCRC(datos.total)}
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
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors disabled:opacity-60"
          >
            {guardando ? 'Guardando…' : datos.id ? 'Guardar cambios' : 'Registrar pago'}
          </button>
        </footer>
      </form>
    </div>
  );
}
