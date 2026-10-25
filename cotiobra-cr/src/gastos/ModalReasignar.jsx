import { useState } from 'react';
import { formatearCRC } from '../formato.js';

/**
 * Mueve varias facturas de cuenta y/o de proyecto en un solo paso.
 * Deja constancia del cambio en el historial de cada factura.
 */
export default function ModalReasignar({ facturas, cuentas, proyectos, guardando, onAplicar, onCerrar, notificar }) {
  const [cuentaDestino, setCuentaDestino] = useState('');
  const [proyectoDestino, setProyectoDestino] = useState('');
  const [motivo, setMotivo] = useState('');

  const total = facturas.reduce((acc, factura) => acc + (Number(factura.total) || 0), 0);
  const sinCambios = !cuentaDestino && !proyectoDestino;

  const nombreCuenta = (id) => cuentas.find((cuenta) => cuenta.id === id)?.nombre ?? (id ? 'Cuenta eliminada' : 'Sin cuenta');
  const nombreProyecto = (id) => proyectos.find((proyecto) => proyecto.id === id)?.nombre ?? 'Sin proyecto';

  const enviar = (evento) => {
    evento.preventDefault();
    if (sinCambios) {
      notificar('Elige al menos una cuenta o un proyecto de destino.', 'error');
      return;
    }
    onAplicar({
      cuentaId: cuentaDestino || null,
      proyectoId: proyectoDestino || null,
      motivo: motivo.trim(),
      cuentaNombre: cuentaDestino ? nombreCuenta(cuentaDestino) : null,
    });
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-950/80 backdrop-blur-sm p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-reasignar"
    >
      <form onSubmit={enviar} className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl my-auto">
        <header className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
          <div>
            <h2 id="titulo-reasignar" className="text-lg font-bold text-white">
              Mover {facturas.length} factura{facturas.length === 1 ? '' : 's'}
            </h2>
            <p className="text-xs text-slate-400">
              Total movido: <span className="font-mono text-emerald-300">{formatearCRC(total)}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="text-slate-400 hover:text-white text-lg leading-none px-2 py-1 rounded-lg hover:bg-slate-800"
            aria-label="Cerrar"
          >
            ✕
          </button>
        </header>

        <div className="px-5 py-4 space-y-4">
          <div className="rounded-lg border border-slate-800 bg-slate-950/60 max-h-32 overflow-y-auto divide-y divide-slate-800/70">
            {facturas.map((factura) => (
              <div key={factura.id} className="flex items-center justify-between gap-3 px-3 py-1.5 text-[11px]">
                <span className="text-slate-300 truncate">
                  {factura.numeroFactura} · {factura.proveedor}
                </span>
                <span className="text-slate-400 font-mono shrink-0">
                  {nombreCuenta(factura.cuentaId)} → {formatearCRC(factura.total)}
                </span>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1" htmlFor="reasignar-cuenta">
              Mover a la cuenta
            </label>
            <select
              id="reasignar-cuenta"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-500"
              value={cuentaDestino}
              onChange={(evento) => setCuentaDestino(evento.target.value)}
            >
              <option value="">Sin cambio de cuenta</option>
              {cuentas.map((cuenta) => (
                <option key={cuenta.id} value={cuenta.id}>
                  {cuenta.nombre}{cuenta.titular ? ` — ${cuenta.titular}` : ''}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-500 mt-1">Ej. de “Cuenta Harold (personal)” a “Cuenta del jefe”.</p>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1" htmlFor="reasignar-proyecto">
              Mover al proyecto
            </label>
            <select
              id="reasignar-proyecto"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-500"
              value={proyectoDestino}
              onChange={(evento) => setProyectoDestino(evento.target.value)}
            >
              <option value="">Sin cambio de proyecto</option>
              {proyectos.map((proyecto) => (
                <option key={proyecto.id} value={proyecto.id}>{proyecto.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1" htmlFor="reasignar-motivo">
              Motivo (queda en el historial)
            </label>
            <input
              id="reasignar-motivo"
              type="text"
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-blue-500"
              placeholder="Ej. este gasto lo pagó el jefe"
              value={motivo}
              onChange={(evento) => setMotivo(evento.target.value)}
            />
          </div>

          <p className="text-[11px] text-slate-500">
            Se mostrará: {cuentaDestino ? nombreCuenta(cuentaDestino) : 'misma cuenta'}
            {proyectoDestino ? ` · ${nombreProyecto(proyectoDestino)}` : ''}. No se borra nada: cada factura guarda el cambio en su historial.
          </p>
        </div>

        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-800 px-5 py-4">
          <button
            type="button"
            onClick={onCerrar}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium px-4 py-2 rounded-lg border border-slate-700"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando || sinCambios}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-5 py-2 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {guardando ? 'Moviendo…' : 'Mover facturas'}
          </button>
        </footer>
      </form>
    </div>
  );
}
