import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase.js';
import { CATEGORIAS, categoriaPorId } from './categorias.js';
import {
  PROYECTO_TODOS,
  calcularResumen,
  facturaVacia,
  facturasACSV,
  filtrarFacturas,
  normalizarFactura,
  ordenarFacturas,
  resumenPorProyecto,
} from './resumen.js';
import FormularioFactura from './FormularioFactura.jsx';
import { descargarTexto, fechaISOaTexto, formatearCRC, hoyISO, limpiarNombreArchivo } from '../formato.js';

const mensajeFirestore = (error) => {
  if (!error) return 'Ocurrió un error inesperado.';
  if (error.code === 'permission-denied') return 'Firestore rechazó la operación. Revisa las reglas de seguridad.';
  if (error.code === 'unavailable') return 'Sin conexión con Firestore. Revisa tu internet.';
  if (error.code === 'unauthenticated') return 'Tu sesión expiró. Vuelve a iniciar sesión.';
  return error.message || 'Ocurrió un error inesperado.';
};

const fechaDeHoy = () => fechaISOaTexto(hoyISO());

const claseBotonSecundario =
  'bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium px-3 py-2 rounded-lg border border-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

function EncabezadoOrdenable({ campo, etiqueta, orden, onOrdenar, alineacion = 'left' }) {
  const activo = orden.campo === campo;
  return (
    <th className={`p-2 align-bottom ${alineacion === 'right' ? 'text-right' : 'text-left'}`} aria-sort={activo ? (orden.direccion === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => onOrdenar(campo)}
        className={`inline-flex items-center gap-1 text-[11px] uppercase tracking-wide transition-colors hover:text-blue-300 ${
          activo ? 'text-blue-300 font-semibold' : 'text-slate-400'
        }`}
        title={`Ordenar por ${etiqueta.toLowerCase()}`}
      >
        {etiqueta}
        <span aria-hidden="true" className="text-[9px]">{activo ? (orden.direccion === 'asc' ? '▲' : '▼') : '↕'}</span>
      </button>
    </th>
  );
}

export default function Gastos({ usuario, notificar }) {
  const [proyectos, setProyectos] = useState([]);
  const [facturas, setFacturas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');

  const [proyectoActivo, setProyectoActivo] = useState(PROYECTO_TODOS);
  const [busqueda, setBusqueda] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [orden, setOrden] = useState({ campo: 'fecha', direccion: 'desc' });

  const [formulario, setFormulario] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [proyectoForm, setProyectoForm] = useState(null);
  const [guardandoProyecto, setGuardandoProyecto] = useState(false);
  const [exportando, setExportando] = useState(false);

  // Lectura pura: no toca el estado, así el efecto puede usarla sin cascadas.
  const consultarDatos = useCallback(async () => {
    const [instantaneaProyectos, instantaneaFacturas] = await Promise.all([
      getDocs(collection(db, 'proyectos')),
      getDocs(collection(db, 'facturas')),
    ]);

    const listaProyectos = instantaneaProyectos.docs
      .map((documento) => ({ id: documento.id, ...documento.data() }))
      .filter((proyecto) => (proyecto.nombre ?? '').toString().trim())
      .sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? '', 'es'));

    const listaFacturas = instantaneaFacturas.docs
      .map((documento) => normalizarFactura({ id: documento.id, ...documento.data() }))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));

    return { proyectos: listaProyectos, facturas: listaFacturas };
  }, []);

  useEffect(() => {
    let vigente = true;

    const cargar = async () => {
      try {
        const datos = await consultarDatos();
        if (!vigente) return;
        setProyectos(datos.proyectos);
        setFacturas(datos.facturas);
        setErrorCarga('');
      } catch (error) {
        if (!vigente) return;
        console.error('Error cargando gastos:', error);
        setErrorCarga(mensajeFirestore(error));
      } finally {
        if (vigente) setCargando(false);
      }
    };

    cargar();
    return () => {
      vigente = false;
    };
  }, [consultarDatos]);

  const recargar = async () => {
    setCargando(true);
    setErrorCarga('');
    try {
      const datos = await consultarDatos();
      setProyectos(datos.proyectos);
      setFacturas(datos.facturas);
    } catch (error) {
      console.error('Error cargando gastos:', error);
      setErrorCarga(mensajeFirestore(error));
    } finally {
      setCargando(false);
    }
  };

  const proyectoSeleccionado = proyectos.find((proyecto) => proyecto.id === proyectoActivo) ?? null;

  const facturasDelProyecto = useMemo(
    () => (proyectoActivo === PROYECTO_TODOS ? facturas : facturas.filter((factura) => factura.proyectoId === proyectoActivo)),
    [facturas, proyectoActivo],
  );

  const filtradas = useMemo(
    () => filtrarFacturas(facturasDelProyecto, { busqueda, categoria: categoriaFiltro, desde, hasta }),
    [facturasDelProyecto, busqueda, categoriaFiltro, desde, hasta],
  );

  const ordenadas = useMemo(
    () => ordenarFacturas(filtradas, orden.campo, orden.direccion),
    [filtradas, orden],
  );

  const resumen = useMemo(() => calcularResumen(ordenadas), [ordenadas]);
  const resumenGeneral = useMemo(() => calcularResumen(facturasDelProyecto), [facturasDelProyecto]);
  const porProyecto = useMemo(() => resumenPorProyecto(facturas, proyectos), [facturas, proyectos]);

  const hayFiltros = Boolean(busqueda || categoriaFiltro || desde || hasta);
  const nombreProyecto = (id) => proyectos.find((proyecto) => proyecto.id === id)?.nombre ?? 'Sin proyecto';

  const limpiarFiltros = () => {
    setBusqueda('');
    setCategoriaFiltro('');
    setDesde('');
    setHasta('');
  };

  const alternarOrden = (campo) => {
    setOrden((previo) =>
      previo.campo === campo
        ? { campo, direccion: previo.direccion === 'asc' ? 'desc' : 'asc' }
        : { campo, direccion: campo === 'fecha' ? 'desc' : 'asc' },
    );
  };

  // ---------- Facturas ----------
  const abrirNueva = (proyectoId) => {
    const destino = proyectoId ?? (proyectoActivo === PROYECTO_TODOS ? proyectos[0]?.id ?? '' : proyectoActivo);
    setFormulario(facturaVacia({ fecha: hoyISO(), proyectoId: destino }));
  };

  const guardarFactura = async (datos) => {
    setGuardando(true);
    try {
      const { id, ...campos } = datos;
      const auditoria = { actualizadoEn: serverTimestamp(), actualizadoPor: usuario?.email ?? null };

      if (id) {
        await updateDoc(doc(db, 'facturas', id), { ...campos, ...auditoria });
        setFacturas((previas) => previas.map((factura) => (factura.id === id ? { ...datos } : factura)));
        notificar(`Factura ${campos.numeroFactura} actualizada.`);
      } else {
        const referencia = await addDoc(collection(db, 'facturas'), {
          ...campos,
          ...auditoria,
          creadoEn: serverTimestamp(),
          creadoPor: usuario?.email ?? null,
        });
        setFacturas((previas) => [...previas, { ...datos, id: referencia.id }]);
        notificar(`Factura ${campos.numeroFactura} registrada.`);
      }
      setFormulario(null);
    } catch (error) {
      console.error('Error guardando factura:', error);
      notificar(`No se pudo guardar la factura: ${mensajeFirestore(error)}`, 'error');
    } finally {
      setGuardando(false);
    }
  };

  const eliminarFactura = async (factura) => {
    if (!window.confirm(`¿Eliminar la factura ${factura.numeroFactura} de ${factura.proveedor}? No se puede deshacer.`)) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'facturas', factura.id));
      setFacturas((previas) => previas.filter((item) => item.id !== factura.id));
      notificar(`Factura ${factura.numeroFactura} eliminada.`);
    } catch (error) {
      console.error('Error eliminando factura:', error);
      notificar(`No se pudo eliminar la factura: ${mensajeFirestore(error)}`, 'error');
    }
  };

  // ---------- Proyectos ----------
  const guardarProyecto = async (evento) => {
    evento.preventDefault();
    const nombre = (proyectoForm?.nombre ?? '').trim();
    if (!nombre) {
      notificar('Escribe el nombre del proyecto.', 'error');
      return;
    }

    setGuardandoProyecto(true);
    const datos = {
      nombre,
      ubicacion: (proyectoForm?.ubicacion ?? '').trim(),
      responsable: (proyectoForm?.responsable ?? '').trim(),
    };

    try {
      if (proyectoForm?.id) {
        await updateDoc(doc(db, 'proyectos', proyectoForm.id), { ...datos, actualizadoEn: serverTimestamp() });
        setProyectos((previos) => previos.map((proyecto) => (proyecto.id === proyectoForm.id ? { ...proyecto, ...datos } : proyecto)));
        notificar(`Proyecto “${nombre}” actualizado.`);
      } else {
        const referencia = await addDoc(collection(db, 'proyectos'), {
          ...datos,
          activo: true,
          creadoEn: serverTimestamp(),
          creadoPor: usuario?.email ?? null,
        });
        setProyectos((previos) => [...previos, { id: referencia.id, ...datos }].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')));
        setProyectoActivo(referencia.id);
        notificar(`Proyecto “${nombre}” creado.`);
      }
      setProyectoForm(null);
    } catch (error) {
      console.error('Error guardando proyecto:', error);
      notificar(`No se pudo guardar el proyecto: ${mensajeFirestore(error)}`, 'error');
    } finally {
      setGuardandoProyecto(false);
    }
  };

  const eliminarProyecto = async (proyecto) => {
    const asociadas = facturas.filter((factura) => factura.proyectoId === proyecto.id).length;
    if (asociadas > 0) {
      notificar(`El proyecto tiene ${asociadas} factura(s). Elimínalas o reasígnalas antes de borrarlo.`, 'error');
      return;
    }
    if (!window.confirm(`¿Eliminar el proyecto “${proyecto.nombre}”?`)) return;

    try {
      await deleteDoc(doc(db, 'proyectos', proyecto.id));
      setProyectos((previos) => previos.filter((item) => item.id !== proyecto.id));
      if (proyectoActivo === proyecto.id) setProyectoActivo(PROYECTO_TODOS);
      notificar(`Proyecto “${proyecto.nombre}” eliminado.`);
      setProyectoForm(null);
    } catch (error) {
      console.error('Error eliminando proyecto:', error);
      notificar(`No se pudo eliminar el proyecto: ${mensajeFirestore(error)}`, 'error');
    }
  };

  // ---------- Exportaciones ----------
  const exportarCSV = () => {
    if (ordenadas.length === 0) {
      notificar('No hay facturas para exportar con los filtros actuales.', 'error');
      return;
    }
    try {
      const incluirProyecto = proyectoActivo === PROYECTO_TODOS;
      const contenido = facturasACSV(ordenadas, { incluirProyecto, proyectos });
      const nombre = `Gastos_${limpiarNombreArchivo(proyectoSeleccionado?.nombre ?? 'Todos', 'Proyecto')}_${hoyISO()}.csv`;
      descargarTexto(contenido, nombre);
      notificar(`Archivo generado: ${nombre}`);
    } catch (error) {
      console.error('Error exportando CSV:', error);
      notificar('No se pudo generar el CSV.', 'error');
    }
  };

  const exportarPDF = async () => {
    if (ordenadas.length === 0) {
      notificar('No hay facturas para el reporte con los filtros actuales.', 'error');
      return;
    }
    try {
      setExportando(true);
      const { descargarReporteGastos } = await import('./reporteGastos.js');
      const nombre = descargarReporteGastos({
        proyecto: proyectoSeleccionado ?? { nombre: 'Todos los proyectos' },
        facturas: ordenadas,
        desde,
        hasta,
        generadoPor: usuario?.email ?? '',
        fecha: fechaDeHoy(),
      });
      notificar(`Reporte generado: ${nombre}`);
    } catch (error) {
      console.error('Error generando el reporte:', error);
      notificar(`No se pudo generar el reporte: ${error.message}`, 'error');
    } finally {
      setExportando(false);
    }
  };

  // ---------- Render ----------
  if (cargando) {
    return (
      <div className="space-y-4">
        <div className="h-24 rounded-xl bg-slate-800/40 animate-pulse" />
        <div className="h-40 rounded-xl bg-slate-800/40 animate-pulse" />
        <p className="text-center text-sm text-slate-400">Cargando facturero…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ENCABEZADO DEL FACTURERO */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>🧾</span> Facturero de gastos reales
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Registra cada factura de la obra, clasifícala y controla el IVA del 13% de Hacienda.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={recargar} className={claseBotonSecundario}>
            🔄 Actualizar
          </button>
          <button
            type="button"
            onClick={() => setProyectoForm({ nombre: '', ubicacion: '', responsable: '' })}
            className={claseBotonSecundario}
          >
            🏗️ Nuevo proyecto
          </button>
          <button
            type="button"
            onClick={() => abrirNueva()}
            disabled={proyectos.length === 0}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            title={proyectos.length === 0 ? 'Primero crea un proyecto' : 'Registrar una factura'}
          >
            + Registrar factura
          </button>
        </div>
      </div>

      {errorCarga && (
        <div className="rounded-xl border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-200 flex flex-wrap items-center justify-between gap-3">
          <span>No se pudo cargar el facturero: {errorCarga}</span>
          <button type="button" onClick={recargar} className="underline hover:no-underline">Reintentar</button>
        </div>
      )}

      {/* SELECTOR DE PROYECTO */}
      <div className="space-y-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Proyecto / obra</span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setProyectoActivo(PROYECTO_TODOS)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              proyectoActivo === PROYECTO_TODOS
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
            }`}
          >
            🗂️ Todos ({facturas.length})
          </button>
          {proyectos.map((proyecto) => {
            const cantidad = facturas.filter((factura) => factura.proyectoId === proyecto.id).length;
            const activo = proyectoActivo === proyecto.id;
            return (
              <button
                key={proyecto.id}
                type="button"
                onClick={() => setProyectoActivo(proyecto.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  activo
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
                title={proyecto.ubicacion || proyecto.nombre}
              >
                🏗️ {proyecto.nombre} ({cantidad})
              </button>
            );
          })}
          {proyectos.length === 0 && (
            <span className="text-xs text-slate-500 self-center">
              Aún no hay proyectos. Crea el primero con “Nuevo proyecto”.
            </span>
          )}
        </div>

        {proyectoSeleccionado && (
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-1">
            {proyectoSeleccionado.ubicacion && <span>📍 {proyectoSeleccionado.ubicacion}</span>}
            {proyectoSeleccionado.responsable && <span>👷 {proyectoSeleccionado.responsable}</span>}
            <button
              type="button"
              onClick={() => setProyectoForm({ ...proyectoSeleccionado })}
              className="text-blue-400 hover:text-blue-300"
            >
              Editar proyecto
            </button>
          </div>
        )}
      </div>

      {proyectos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/60 px-6 py-12 text-center space-y-3">
          <span className="text-4xl">🏗️</span>
          <h3 className="text-white font-semibold">Crea tu primer proyecto</h3>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            El facturero trabaja por obra: la construcción principal, la villa donde está el otro equipo, etc.
            Cada factura se imputa a un proyecto para que los gastos y el IVA queden separados.
          </p>
          <button
            type="button"
            onClick={() => setProyectoForm({ nombre: '', ubicacion: '', responsable: '' })}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
          >
            + Nuevo proyecto
          </button>
        </div>
      ) : (
        <>
          {/* TARJETAS DE CONTROL DE GASTOS E IVA */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Total gastado</p>
              <p className="text-2xl font-bold text-emerald-400 font-mono mt-1">{formatearCRC(resumen.total)}</p>
              <p className="text-[11px] text-slate-500 mt-1">
                {resumen.cantidad} factura(s){hayFiltros ? ' con filtros' : ''}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Subtotal (base)</p>
              <p className="text-2xl font-bold text-slate-100 font-mono mt-1">{formatearCRC(resumen.subtotal)}</p>
              <p className="text-[11px] text-slate-500 mt-1">Monto sin impuestos</p>
            </div>
            <div className="rounded-xl border border-amber-800/60 bg-amber-950/20 p-4">
              <p className="text-[11px] uppercase tracking-wide text-amber-300/80">IVA 13% · Hacienda</p>
              <p className="text-2xl font-bold text-amber-300 font-mono mt-1">{formatearCRC(resumen.impuesto)}</p>
              <p className="text-[11px] text-amber-200/60 mt-1">IVA acumulado de las facturas</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Proveedores</p>
              <p className="text-2xl font-bold text-slate-100 font-mono mt-1">
                {new Set(ordenadas.map((factura) => factura.proveedor.toLowerCase())).size}
              </p>
              <p className="text-[11px] text-slate-500 mt-1">
                {proyectoActivo === PROYECTO_TODOS ? 'Todos los proyectos' : proyectoSeleccionado?.nombre}
              </p>
            </div>
          </div>

          {/* CONTROL DE IVA Y CLASIFICACIÓN */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>🏛️</span> Control de IVA para Hacienda
              </h3>
              <p className="text-[11px] text-slate-500 mb-3">Desglose por tasa de las facturas listadas.</p>

              {resumen.porTasa.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">Sin facturas en el período.</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-800">
                      <th className="text-left py-1.5 font-medium">Tasa</th>
                      <th className="text-center py-1.5 font-medium">Facturas</th>
                      <th className="text-right py-1.5 font-medium">Base</th>
                      <th className="text-right py-1.5 font-medium">IVA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {resumen.porTasa.map((fila) => (
                      <tr key={fila.tasa}>
                        <td className="py-1.5">
                          <span className={`px-2 py-0.5 rounded-full border text-[11px] font-semibold ${
                            fila.tasa === 13
                              ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                              : fila.tasa === 0
                                ? 'bg-slate-500/15 text-slate-300 border-slate-500/30'
                                : 'bg-sky-500/15 text-sky-300 border-sky-500/30'
                          }`}>
                            {fila.tasa}%
                          </span>
                        </td>
                        <td className="py-1.5 text-center text-slate-300 font-mono">{fila.cantidad}</td>
                        <td className="py-1.5 text-right text-slate-300 font-mono">{formatearCRC(fila.subtotal)}</td>
                        <td className="py-1.5 text-right text-amber-300 font-mono">{formatearCRC(fila.impuesto)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-700 text-slate-200 font-semibold">
                      <td className="py-2">Total</td>
                      <td className="py-2 text-center font-mono">{resumen.cantidad}</td>
                      <td className="py-2 text-right font-mono">{formatearCRC(resumen.subtotal)}</td>
                      <td className="py-2 text-right font-mono text-amber-300">{formatearCRC(resumen.impuesto)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}

              {resumen.sinIva > 0 && (
                <p className="mt-3 text-[11px] text-amber-200/80 bg-amber-950/30 border border-amber-800/50 rounded-lg px-3 py-2">
                  ⚠️ {resumen.sinIva} factura(s) sin IVA registrado. Verifícalas antes de la declaración.
                </p>
              )}
            </section>

            <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>📊</span> Gasto por clasificación
              </h3>
              <p className="text-[11px] text-slate-500 mb-3">¿En qué se está yendo el dinero?</p>

              {resumen.porCategoria.length === 0 ? (
                <p className="text-xs text-slate-500 py-4 text-center">Sin gastos en el período.</p>
              ) : (
                <ul className="space-y-2.5">
                  {resumen.porCategoria.map((categoria) => (
                    <li key={categoria.id}>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-slate-300 truncate">
                          <span aria-hidden="true">{categoria.icono}</span> {categoria.nombre}
                        </span>
                        <span className="font-mono text-slate-200 shrink-0">{formatearCRC(categoria.total)}</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${categoria.barra}`}
                          style={{ width: `${Math.max(2, Math.round(categoria.porcentaje))}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {categoria.cantidad} factura(s) · {categoria.porcentaje.toFixed(1)}% del gasto
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* RESUMEN POR PROYECTO (solo en "Todos") */}
          {proyectoActivo === PROYECTO_TODOS && porProyecto.length > 0 && (
            <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                <span>🏗️</span> Comparativo por proyecto
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-800">
                      <th className="text-left py-2 font-medium">Proyecto</th>
                      <th className="text-left py-2 font-medium">Ubicación</th>
                      <th className="text-center py-2 font-medium">Facturas</th>
                      <th className="text-right py-2 font-medium">Subtotal</th>
                      <th className="text-right py-2 font-medium">IVA</th>
                      <th className="text-right py-2 font-medium">Total</th>
                      <th className="text-right py-2 font-medium w-24">% del gasto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {porProyecto.map((fila) => (
                      <tr key={fila.proyecto.id} className="hover:bg-slate-800/40">
                        <td className="py-2">
                          <button
                            type="button"
                            onClick={() => setProyectoActivo(fila.proyecto.id)}
                            className="text-blue-300 hover:text-blue-200 font-medium text-left"
                          >
                            {fila.proyecto.nombre}
                          </button>
                        </td>
                        <td className="py-2 text-slate-400">{fila.proyecto.ubicacion || '—'}</td>
                        <td className="py-2 text-center text-slate-300 font-mono">{fila.cantidad}</td>
                        <td className="py-2 text-right text-slate-300 font-mono">{formatearCRC(fila.subtotal)}</td>
                        <td className="py-2 text-right text-amber-300 font-mono">{formatearCRC(fila.impuesto)}</td>
                        <td className="py-2 text-right text-emerald-300 font-mono font-semibold">{formatearCRC(fila.total)}</td>
                        <td className="py-2 text-right text-slate-400 font-mono">
                          {resumenGeneral.total > 0 ? `${((fila.total / resumenGeneral.total) * 100).toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-700 font-semibold text-slate-100">
                      <td className="py-2" colSpan={2}>Total general</td>
                      <td className="py-2 text-center font-mono">{facturas.length}</td>
                      <td className="py-2 text-right font-mono">{formatearCRC(resumenGeneral.subtotal)}</td>
                      <td className="py-2 text-right font-mono text-amber-300">{formatearCRC(resumenGeneral.impuesto)}</td>
                      <td className="py-2 text-right font-mono text-emerald-300">{formatearCRC(resumenGeneral.total)}</td>
                      <td className="py-2 text-right font-mono">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          )}

          {/* FILTROS, ORDEN Y EXPORTACIÓN */}
          <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>🔎</span> Facturas registradas
                <span className="text-[11px] font-normal text-slate-400">
                  ({resumen.cantidad} de {facturasDelProyecto.length})
                </span>
              </h3>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={exportarCSV} className={claseBotonSecundario}>
                  📊 CSV / Excel
                </button>
                <button type="button" onClick={exportarPDF} disabled={exportando} className={claseBotonSecundario}>
                  {exportando ? 'Generando…' : '📄 Reporte PDF'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
              <div className="lg:col-span-2">
                <label className="sr-only" htmlFor="filtro-busqueda">Buscar factura</label>
                <input
                  id="filtro-busqueda"
                  type="search"
                  value={busqueda}
                  onChange={(evento) => setBusqueda(evento.target.value)}
                  placeholder="Buscar por n.º, proveedor o nota…"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="sr-only" htmlFor="filtro-categoria">Clasificación</label>
                <select
                  id="filtro-categoria"
                  value={categoriaFiltro}
                  onChange={(evento) => setCategoriaFiltro(evento.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 outline-none focus:border-blue-500"
                >
                  <option value="">Toda clasificación</option>
                  {CATEGORIAS.map((categoria) => (
                    <option key={categoria.id} value={categoria.id}>{categoria.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="sr-only" htmlFor="filtro-desde">Desde</label>
                <input
                  id="filtro-desde"
                  type="date"
                  value={desde}
                  onChange={(evento) => setDesde(evento.target.value)}
                  title="Desde"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="sr-only" htmlFor="filtro-hasta">Hasta</label>
                <input
                  id="filtro-hasta"
                  type="date"
                  value={hasta}
                  onChange={(evento) => setHasta(evento.target.value)}
                  title="Hasta"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <label className="sr-only" htmlFor="filtro-orden">Ordenar por</label>
                <select
                  id="filtro-orden"
                  value={orden.campo}
                  onChange={(evento) => setOrden({ campo: evento.target.value, direccion: orden.direccion })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-xs text-slate-100 outline-none focus:border-blue-500"
                >
                  <option value="fecha">Fecha</option>
                  <option value="numeroFactura">N.º factura</option>
                  <option value="proveedor">Proveedor</option>
                  <option value="categoria">Clasificación</option>
                  <option value="total">Total</option>
                </select>
                <button
                  type="button"
                  onClick={() => setOrden((previo) => ({ ...previo, direccion: previo.direccion === 'asc' ? 'desc' : 'asc' }))}
                  className="shrink-0 bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-xs text-slate-200 hover:border-slate-600"
                  title={orden.direccion === 'asc' ? 'Cambiar a descendente' : 'Cambiar a ascendente'}
                  aria-label={`Orden ${orden.direccion === 'asc' ? 'ascendente' : 'descendente'}; cambiar`}
                >
                  {orden.direccion === 'asc' ? '↑ Asc' : '↓ Desc'}
                </button>
              </div>
            </div>

            {hayFiltros && (
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                <span>Filtros activos.</span>
                <button type="button" onClick={limpiarFiltros} className="text-blue-400 hover:text-blue-300 underline">
                  Limpiar filtros
                </button>
              </div>
            )}
          </section>

          {/* TABLA DE FACTURAS */}
          <section className="rounded-xl border border-slate-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-800/90 text-slate-300">
                  <tr>
                    <EncabezadoOrdenable campo="fecha" etiqueta="Fecha" orden={orden} onOrdenar={alternarOrden} />
                    <EncabezadoOrdenable campo="numeroFactura" etiqueta="N.º factura" orden={orden} onOrdenar={alternarOrden} />
                    <EncabezadoOrdenable campo="proveedor" etiqueta="Proveedor" orden={orden} onOrdenar={alternarOrden} />
                    {proyectoActivo === PROYECTO_TODOS && (
                      <th className="p-2 text-left text-[11px] uppercase tracking-wide text-slate-400 align-bottom">Proyecto</th>
                    )}
                    <EncabezadoOrdenable campo="categoria" etiqueta="Clasificación" orden={orden} onOrdenar={alternarOrden} />
                    <EncabezadoOrdenable campo="subtotal" etiqueta="Subtotal" orden={orden} onOrdenar={alternarOrden} alineacion="right" />
                    <EncabezadoOrdenable campo="impuesto" etiqueta="IVA 13%" orden={orden} onOrdenar={alternarOrden} alineacion="right" />
                    <EncabezadoOrdenable campo="total" etiqueta="Total" orden={orden} onOrdenar={alternarOrden} alineacion="right" />
                    <th className="p-2 text-center text-[11px] uppercase tracking-wide text-slate-400 align-bottom w-20">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 bg-slate-900/60">
                  {ordenadas.length === 0 && (
                    <tr>
                      <td colSpan={proyectoActivo === PROYECTO_TODOS ? 9 : 8} className="p-8 text-center text-sm text-slate-400">
                        {facturasDelProyecto.length === 0
                          ? 'Aún no hay facturas en este proyecto. Usa “+ Registrar factura”.'
                          : 'Ninguna factura coincide con los filtros aplicados.'}
                      </td>
                    </tr>
                  )}

                  {ordenadas.map((factura) => {
                    const categoria = categoriaPorId(factura.categoria);
                    return (
                      <tr key={factura.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="p-2 text-slate-300 whitespace-nowrap font-mono text-xs">
                          {fechaISOaTexto(factura.fecha)}
                        </td>
                        <td className="p-2 text-slate-100 font-mono text-xs whitespace-nowrap">{factura.numeroFactura}</td>
                        <td className="p-2 text-slate-200">
                          <span className="block truncate max-w-[180px]" title={factura.proveedor}>{factura.proveedor}</span>
                          {factura.notas && (
                            <span className="block text-[10px] text-slate-500 truncate max-w-[180px]" title={factura.notas}>
                              {factura.notas}
                            </span>
                          )}
                        </td>
                        {proyectoActivo === PROYECTO_TODOS && (
                          <td className="p-2 text-xs text-slate-400">
                            <span className="block truncate max-w-[140px]" title={nombreProyecto(factura.proyectoId)}>
                              {nombreProyecto(factura.proyectoId)}
                            </span>
                          </td>
                        )}
                        <td className="p-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium whitespace-nowrap ${categoria.chip}`}>
                            <span aria-hidden="true">{categoria.icono}</span> {categoria.nombre}
                          </span>
                        </td>
                        <td className="p-2 text-right font-mono text-xs text-slate-300">{formatearCRC(factura.subtotal)}</td>
                        <td className="p-2 text-right font-mono text-xs text-amber-300">
                          {formatearCRC(factura.impuesto)}
                          <span className="block text-[10px] text-slate-500">{factura.tasaIva}%</span>
                        </td>
                        <td className="p-2 text-right font-mono text-sm font-semibold text-emerald-300">{formatearCRC(factura.total)}</td>
                        <td className="p-2 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => setFormulario({ ...factura })}
                            className="text-slate-400 hover:text-blue-300 px-1"
                            aria-label={`Editar factura ${factura.numeroFactura}`}
                            title="Editar"
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            onClick={() => eliminarFactura(factura)}
                            className="text-slate-400 hover:text-red-300 px-1"
                            aria-label={`Eliminar factura ${factura.numeroFactura}`}
                            title="Eliminar"
                          >
                            🗑️
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {ordenadas.length > 0 && (
                  <tfoot className="bg-slate-900 border-t-2 border-slate-700">
                    <tr className="text-slate-100 font-semibold">
                      <td className="p-2 text-xs" colSpan={proyectoActivo === PROYECTO_TODOS ? 5 : 4}>
                        Totales de lo listado ({resumen.cantidad} factura{resumen.cantidad === 1 ? '' : 's'})
                      </td>
                      <td className="p-2 text-right font-mono text-xs">{formatearCRC(resumen.subtotal)}</td>
                      <td className="p-2 text-right font-mono text-xs text-amber-300">{formatearCRC(resumen.impuesto)}</td>
                      <td className="p-2 text-right font-mono text-sm text-emerald-300">{formatearCRC(resumen.total)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </section>

          <p className="text-[11px] text-slate-500">
            Orden actual: <strong className="text-slate-400">{orden.campo === 'fecha' ? 'fecha' : orden.campo}</strong>{' '}
            {orden.direccion === 'asc' ? 'ascendente (más antiguo primero)' : 'descendente (más reciente primero)'}. Haz clic en
            cualquier encabezado para cambiar el orden.
          </p>
        </>
      )}

      {/* FORMULARIO DE FACTURA */}
      {formulario && (
        <FormularioFactura
          key={formulario.id ?? 'nueva'}
          factura={formulario}
          proyectos={proyectos}
          guardando={guardando}
          onGuardar={guardarFactura}
          onCerrar={() => setFormulario(null)}
        />
      )}

      {/* FORMULARIO DE PROYECTO */}
      {proyectoForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4" role="dialog" aria-modal="true">
          <form onSubmit={guardarProyecto} className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl my-auto">
            <header className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
              <div>
                <h2 className="text-base font-bold text-white">
                  {proyectoForm.id ? 'Editar proyecto' : 'Nuevo proyecto / obra'}
                </h2>
                <p className="text-xs text-slate-400">Cada proyecto lleva su propio facturero.</p>
              </div>
              <button
                type="button"
                onClick={() => setProyectoForm(null)}
                className="text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-800"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </header>

            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1" htmlFor="proyecto-nombre">
                  Nombre del proyecto *
                </label>
                <input
                  id="proyecto-nombre"
                  type="text"
                  autoFocus
                  required
                  value={proyectoForm.nombre}
                  onChange={(evento) => setProyectoForm({ ...proyectoForm, nombre: evento.target.value })}
                  placeholder="Ej. Casa Liberia / Villa 3"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1" htmlFor="proyecto-ubicacion">
                  Ubicación
                </label>
                <input
                  id="proyecto-ubicacion"
                  type="text"
                  value={proyectoForm.ubicacion}
                  onChange={(evento) => setProyectoForm({ ...proyectoForm, ubicacion: evento.target.value })}
                  placeholder="Ej. Liberia, Guanacaste"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1" htmlFor="proyecto-responsable">
                  Encargado / equipo
                </label>
                <input
                  id="proyecto-responsable"
                  type="text"
                  value={proyectoForm.responsable}
                  onChange={(evento) => setProyectoForm({ ...proyectoForm, responsable: evento.target.value })}
                  placeholder="Ej. Cuadrilla de Harold"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 px-5 py-4">
              {proyectoForm.id ? (
                <button
                  type="button"
                  onClick={() => eliminarProyecto(proyectoForm)}
                  className="text-xs text-red-300 hover:text-red-200 border border-red-900/60 bg-red-950/30 px-3 py-2 rounded-lg"
                >
                  🗑️ Eliminar proyecto
                </button>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setProyectoForm(null)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm px-4 py-2 rounded-lg border border-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoProyecto}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
                >
                  {guardandoProyecto ? 'Guardando…' : 'Guardar proyecto'}
                </button>
              </div>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}
