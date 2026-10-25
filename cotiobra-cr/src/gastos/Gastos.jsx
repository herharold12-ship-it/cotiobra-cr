import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../firebase.js';
import { CATEGORIAS, TIPOS_CUENTA, categoriaPorId, tipoCuentaPorId } from './categorias.js';
import {
  PROYECTO_TODOS,
  calcularResumen,
  calcularResumenPorCuenta,
  facturaVacia,
  facturasACSV,
  filtrarFacturas,
  normalizarFactura,
  ordenarFacturas,
  resumenPorProyecto,
} from './resumen.js';
import { combinarProveedores, idProveedor, normalizarProveedor } from './proveedores.js';
import {
  calcularResumenPlanillas,
  normalizarPlanilla,
  planillaVacia,
  planillasACSV,
  planillasComoGastos,
} from './planillas.js';
import FormularioFactura from './FormularioFactura.jsx';
import FormularioPlanilla from './FormularioPlanilla.jsx';
import ModalReasignar from './ModalReasignar.jsx';
import { descargarTexto, fechaISOaTexto, formatearCRC, hoyISO, limpiarNombreArchivo } from '../formato.js';

const mensajeFirestore = (error) => {
  if (!error) return 'Ocurrió un error inesperado.';
  if (error.code === 'permission-denied') return 'Firestore rechazó la operación. Revisa tus permisos o las reglas.';
  if (error.code === 'unavailable') return 'Sin conexión con Firestore. Revisa tu internet.';
  if (error.code === 'unauthenticated') return 'Tu sesión expiró. Vuelve a iniciar sesión.';
  return error.message || 'Ocurrió un error inesperado.';
};

const fechaDeHoy = () => fechaISOaTexto(hoyISO());

const claseBotonSecundario =
  'bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium px-3 py-2 rounded-lg border border-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

const claseCampoChico =
  'w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-blue-500';

function EncabezadoOrdenable({ campo, etiqueta, orden, onOrdenar, alineacion = 'left' }) {
  const activo = orden.campo === campo;
  return (
    <th
      className={`p-2 align-bottom ${alineacion === 'right' ? 'text-right' : 'text-left'}`}
      aria-sort={activo ? (orden.direccion === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
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

export default function Gastos({ usuario, notificar, esAdmin = false }) {
  const [proyectos, setProyectos] = useState([]);
  const [facturas, setFacturas] = useState([]);
  const [cuentas, setCuentas] = useState([]);
  const [proveedoresGuardados, setProveedoresGuardados] = useState([]);
  const [planillas, setPlanillas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');

  const [vista, setVista] = useState('facturas');
  const [proyectoActivo, setProyectoActivo] = useState(PROYECTO_TODOS);
  const [busqueda, setBusqueda] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState('');
  const [cuentaFiltro, setCuentaFiltro] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [orden, setOrden] = useState({ campo: 'fecha', direccion: 'desc' });

  const [formulario, setFormulario] = useState(null);
  const [formularioPlanilla, setFormularioPlanilla] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [proyectoForm, setProyectoForm] = useState(null);
  const [cuentaForm, setCuentaForm] = useState(null);
  const [guardandoCuenta, setGuardandoCuenta] = useState(false);
  const [guardandoProyecto, setGuardandoProyecto] = useState(false);
  const [seleccion, setSeleccion] = useState([]);
  const [modalReasignar, setModalReasignar] = useState(false);
  const [reasignando, setReasignando] = useState(false);
  const [exportando, setExportando] = useState(false);

  const consultarDatos = useCallback(async () => {
    const [snapProyectos, snapFacturas, snapCuentas, snapProveedores, snapPlanillas] = await Promise.all([
      getDocs(collection(db, 'proyectos')),
      getDocs(collection(db, 'facturas')),
      getDocs(collection(db, 'cuentas')),
      getDocs(collection(db, 'proveedores')),
      getDocs(collection(db, 'planillas')),
    ]);

    const listaProyectos = snapProyectos.docs
      .map((documento) => ({ id: documento.id, ...documento.data() }))
      .filter((proyecto) => (proyecto.nombre ?? '').toString().trim())
      .sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? '', 'es'));

    const listaFacturas = snapFacturas.docs
      .map((documento) => normalizarFactura({ id: documento.id, ...documento.data() }))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));

    const listaCuentas = snapCuentas.docs
      .map((documento) => ({ id: documento.id, ...documento.data() }))
      .filter((cuenta) => (cuenta.nombre ?? '').toString().trim())
      .sort((a, b) => (a.nombre ?? '').localeCompare(b.nombre ?? '', 'es'));

    const listaProveedores = snapProveedores.docs
      .map((documento) => normalizarProveedor({ id: documento.id, ...documento.data() }));

    const listaPlanillas = snapPlanillas.docs
      .map((documento) => normalizarPlanilla({ id: documento.id, ...documento.data() }))
      .sort((a, b) => b.fecha.localeCompare(a.fecha));

    return {
      proyectos: listaProyectos,
      facturas: listaFacturas,
      cuentas: listaCuentas,
      proveedores: listaProveedores,
      planillas: listaPlanillas,
    };
  }, []);

  useEffect(() => {
    let vigente = true;

    const cargar = async () => {
      try {
        const datos = await consultarDatos();
        if (!vigente) return;
        setProyectos(datos.proyectos);
        setFacturas(datos.facturas);
        setCuentas(datos.cuentas);
        setProveedoresGuardados(datos.proveedores);
        setPlanillas(datos.planillas);
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
      setCuentas(datos.cuentas);
      setProveedoresGuardados(datos.proveedores);
      setPlanillas(datos.planillas);
    } catch (error) {
      console.error('Error cargando gastos:', error);
      setErrorCarga(mensajeFirestore(error));
    } finally {
      setCargando(false);
    }
  };

  const proyectoSeleccionado = proyectos.find((proyecto) => proyecto.id === proyectoActivo) ?? null;

  const delProyecto = useCallback(
    (lista) => (proyectoActivo === PROYECTO_TODOS ? lista : lista.filter((item) => item.proyectoId === proyectoActivo)),
    [proyectoActivo],
  );

  const facturasDelProyecto = useMemo(() => delProyecto(facturas), [facturas, delProyecto]);
  const planillasDelProyecto = useMemo(() => delProyecto(planillas), [planillas, delProyecto]);

  const filtradas = useMemo(
    () => filtrarFacturas(facturasDelProyecto, { busqueda, categoria: categoriaFiltro, cuentaId: cuentaFiltro, desde, hasta }),
    [facturasDelProyecto, busqueda, categoriaFiltro, cuentaFiltro, desde, hasta],
  );

  const ordenadas = useMemo(() => ordenarFacturas(filtradas, orden.campo, orden.direccion), [filtradas, orden]);

  const resumen = useMemo(() => calcularResumen(ordenadas), [ordenadas]);
  const resumenGeneral = useMemo(() => calcularResumen(facturasDelProyecto), [facturasDelProyecto]);
  const resumenCuentas = useMemo(
    () => calcularResumenPorCuenta(facturasDelProyecto, cuentas),
    [facturasDelProyecto, cuentas],
  );
  const porProyecto = useMemo(() => resumenPorProyecto(facturas, proyectos), [facturas, proyectos]);
  const resumenPlanilla = useMemo(() => calcularResumenPlanillas(planillasDelProyecto), [planillasDelProyecto]);

  // Gasto total = facturas + planilla (la planilla no lleva IVA).
  const gastoFacturas = resumenGeneral.total;
  const gastoTotal = gastoFacturas + resumenPlanilla.total;

  const proveedores = useMemo(
    () => combinarProveedores(proveedoresGuardados, facturas),
    [proveedoresGuardados, facturas],
  );

  const hayFiltros = Boolean(busqueda || categoriaFiltro || cuentaFiltro || desde || hasta);
  const nombreProyecto = (id) => proyectos.find((proyecto) => proyecto.id === id)?.nombre ?? 'Sin proyecto';
  const nombreCuenta = (id) => cuentas.find((cuenta) => cuenta.id === id)?.nombre ?? (id ? 'Cuenta eliminada' : 'Sin cuenta');

  const limpiarFiltros = () => {
    setBusqueda('');
    setCategoriaFiltro('');
    setCuentaFiltro('');
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

  // ---------- Selección múltiple ----------
  const idsVisibles = ordenadas.map((factura) => factura.id);
  const todosSeleccionados = idsVisibles.length > 0 && idsVisibles.every((id) => seleccion.includes(id));

  const alternarSeleccion = (id) => {
    setSeleccion((previa) => (previa.includes(id) ? previa.filter((item) => item !== id) : [...previa, id]));
  };

  const alternarTodos = () => {
    setSeleccion((previa) => (todosSeleccionados ? previa.filter((id) => !idsVisibles.includes(id)) : [...new Set([...previa, ...idsVisibles])]));
  };

  const facturasSeleccionadas = facturas.filter((factura) => seleccion.includes(factura.id));

  // ---------- Proveedores ----------
  const guardarProveedor = async (factura) => {
    const id = idProveedor(factura.proveedor);
    if (!id || !factura.proveedor) return;
    const existente = proveedoresGuardados.find((proveedor) => proveedor.id === id);
    const previo = existente ?? { veces: 0, total: 0 };
    await setDoc(
      doc(db, 'proveedores', id),
      {
        nombre: factura.proveedor,
        categoria: factura.categoria,
        tasaIva: Number(factura.tasaIva) || 0,
        cuentaId: factura.cuentaId ?? '',
        veces: (previo.veces ?? 0) + 1,
        total: (previo.total ?? 0) + (Number(factura.total) || 0),
        actualizadoEn: serverTimestamp(),
      },
      { merge: true },
    );
  };

  // ---------- Facturas ----------
  const abrirNueva = (proyectoId) => {
    const destino = proyectoId ?? (proyectoActivo === PROYECTO_TODOS ? proyectos[0]?.id ?? '' : proyectoActivo);
    setFormulario(facturaVacia({ fecha: hoyISO(), proyectoId: destino, cuentaId: cuentas[0]?.id ?? '' }));
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

      // El proveedor se guarda solo, sin que el usuario tenga que capturarlo aparte.
      try {
        await guardarProveedor(datos);
        const actualizado = await consultarDatos();
        setProveedoresGuardados(actualizado.proveedores);
      } catch (error) {
        console.warn('No se pudo guardar el proveedor:', error);
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
      setSeleccion((previa) => previa.filter((id) => id !== factura.id));
      notificar(`Factura ${factura.numeroFactura} eliminada.`);
    } catch (error) {
      console.error('Error eliminando factura:', error);
      notificar(`No se pudo eliminar la factura: ${mensajeFirestore(error)}`, 'error');
    }
  };

  // ---------- Reasignación de cuenta/proyecto ----------
  const aplicarReasignacion = async ({ cuentaId, proyectoId, motivo, cuentaNombre }) => {
    setReasignando(true);
    const marca = new Date().toISOString();
    let movidas = 0;

    try {
      for (const factura of facturasSeleccionadas) {
        const cambios = {};
        const eventos = [];

        if (cuentaId && cuentaId !== factura.cuentaId) {
          cambios.cuentaId = cuentaId;
          eventos.push({
            campo: 'cuenta',
            de: nombreCuenta(factura.cuentaId),
            a: cuentaNombre,
            motivo,
            fecha: marca,
            usuario: usuario?.email ?? null,
          });
        }

        if (proyectoId && proyectoId !== factura.proyectoId) {
          cambios.proyectoId = proyectoId;
          eventos.push({
            campo: 'proyecto',
            de: nombreProyecto(factura.proyectoId),
            a: nombreProyecto(proyectoId),
            motivo,
            fecha: marca,
            usuario: usuario?.email ?? null,
          });
        }

        if (eventos.length === 0) continue;

        const historial = [...(factura.historial ?? []), ...eventos];
        await updateDoc(doc(db, 'facturas', factura.id), {
          ...cambios,
          historial,
          actualizadoEn: serverTimestamp(),
          actualizadoPor: usuario?.email ?? null,
        });

        setFacturas((previas) =>
          previas.map((item) => (item.id === factura.id ? { ...item, ...cambios, historial } : item)),
        );
        movidas += 1;
      }

      notificar(
        movidas > 0
          ? `${movidas} factura(s) movidas${cuentaNombre ? ` a ${cuentaNombre}` : ''}.`
          : 'No hubo cambios que aplicar.',
        movidas > 0 ? 'exito' : 'error',
      );
      setSeleccion([]);
      setModalReasignar(false);
    } catch (error) {
      console.error('Error moviendo facturas:', error);
      notificar(`No se pudieron mover todas las facturas: ${mensajeFirestore(error)}`, 'error');
    } finally {
      setReasignando(false);
    }
  };

  // ---------- Planilla ----------
  const abrirNuevaPlanilla = () => {
    const destino = proyectoActivo === PROYECTO_TODOS ? proyectos[0]?.id ?? '' : proyectoActivo;
    setFormularioPlanilla(planillaVacia({ fecha: hoyISO(), proyectoId: destino, cuentaId: cuentas[0]?.id ?? '' }));
  };

  const guardarPlanilla = async (datos) => {
    setGuardando(true);
    try {
      const { id, ...campos } = datos;
      const auditoria = { actualizadoEn: serverTimestamp(), actualizadoPor: usuario?.email ?? null };

      if (id) {
        await updateDoc(doc(db, 'planillas', id), { ...campos, ...auditoria });
        setPlanillas((previas) => previas.map((planilla) => (planilla.id === id ? { ...datos } : planilla)));
        notificar(`Planilla de ${campos.trabajador} actualizada.`);
      } else {
        const referencia = await addDoc(collection(db, 'planillas'), {
          ...campos,
          ...auditoria,
          creadoEn: serverTimestamp(),
          creadoPor: usuario?.email ?? null,
        });
        setPlanillas((previas) => [...previas, { ...datos, id: referencia.id }]);
        notificar(`Pago de planilla de ${campos.trabajador} registrado.`);
      }
      setFormularioPlanilla(null);
    } catch (error) {
      console.error('Error guardando planilla:', error);
      notificar(`No se pudo guardar la planilla: ${mensajeFirestore(error)}`, 'error');
    } finally {
      setGuardando(false);
    }
  };

  const eliminarPlanilla = async (planilla) => {
    if (!window.confirm(`¿Eliminar el pago de ${planilla.trabajador} del ${fechaISOaTexto(planilla.fecha)}?`)) return;
    try {
      await deleteDoc(doc(db, 'planillas', planilla.id));
      setPlanillas((previas) => previas.filter((item) => item.id !== planilla.id));
      notificar('Pago de planilla eliminado.');
    } catch (error) {
      console.error('Error eliminando planilla:', error);
      notificar(`No se pudo eliminar: ${mensajeFirestore(error)}`, 'error');
    }
  };

  // ---------- Proyectos y cuentas ----------
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
    const asociadas = facturas.filter((factura) => factura.proyectoId === proyecto.id).length
      + planillas.filter((planilla) => planilla.proyectoId === proyecto.id).length;
    if (asociadas > 0) {
      notificar(`El proyecto tiene ${asociadas} registro(s). Elimínalos o reasígnalos antes de borrarlo.`, 'error');
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

  const guardarCuenta = async (evento) => {
    evento.preventDefault();
    const nombre = (cuentaForm?.nombre ?? '').trim();
    if (!nombre) {
      notificar('Escribe el nombre de la cuenta.', 'error');
      return;
    }

    setGuardandoCuenta(true);
    const datos = {
      nombre,
      titular: (cuentaForm?.titular ?? '').trim(),
      tipo: cuentaForm?.tipo ?? 'efectivo',
      activa: true,
    };

    try {
      if (cuentaForm?.id) {
        await updateDoc(doc(db, 'cuentas', cuentaForm.id), { ...datos, actualizadoEn: serverTimestamp() });
        setCuentas((previas) => previas.map((cuenta) => (cuenta.id === cuentaForm.id ? { ...cuenta, ...datos } : cuenta)));
        notificar(`Cuenta “${nombre}” actualizada.`);
      } else {
        const referencia = await addDoc(collection(db, 'cuentas'), {
          ...datos,
          creadoEn: serverTimestamp(),
          creadoPor: usuario?.email ?? null,
        });
        setCuentas((previos) => [...previos, { id: referencia.id, ...datos }].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')));
        notificar(`Cuenta “${nombre}” creada.`);
      }
      setCuentaForm(null);
    } catch (error) {
      console.error('Error guardando cuenta:', error);
      notificar(`No se pudo guardar la cuenta: ${mensajeFirestore(error)}`, 'error');
    } finally {
      setGuardandoCuenta(false);
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
      const contenido = facturasACSV(ordenadas, { incluirProyecto, proyectos, cuentas });
      const nombre = `Gastos_${limpiarNombreArchivo(proyectoSeleccionado?.nombre ?? 'Todos', 'Proyecto')}_${hoyISO()}.csv`;
      descargarTexto(contenido, nombre);
      notificar(`Archivo generado: ${nombre}`);
    } catch (error) {
      console.error('Error exportando CSV:', error);
      notificar('No se pudo generar el CSV.', 'error');
    }
  };

  const exportarPlanillaCSV = () => {
    if (planillasDelProyecto.length === 0) {
      notificar('No hay pagos de planilla para exportar.', 'error');
      return;
    }
    try {
      const contenido = planillasACSV(planillasDelProyecto, { proyectos, cuentas });
      const nombre = `Planilla_${limpiarNombreArchivo(proyectoSeleccionado?.nombre ?? 'Todos', 'Proyecto')}_${hoyISO()}.csv`;
      descargarTexto(contenido, nombre);
      notificar(`Archivo generado: ${nombre}`);
    } catch (error) {
      console.error('Error exportando planilla:', error);
      notificar('No se pudo generar el CSV de planilla.', 'error');
    }
  };

  const exportarPDF = async () => {
    const gastosComoFacturas = [...ordenadas, ...planillasComoGastos(planillasDelProyecto)];
    if (gastosComoFacturas.length === 0) {
      notificar('No hay gastos para el reporte con los filtros actuales.', 'error');
      return;
    }
    try {
      setExportando(true);
      const { descargarReporteGastos } = await import('./reporteGastos.js');
      const nombre = descargarReporteGastos({
        proyecto: proyectoSeleccionado ?? { nombre: 'Todos los proyectos' },
        facturas: ordenadas,
        planillas: planillasDelProyecto,
        cuentas,
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
      {/* ENCABEZADO */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>🧾</span> Gastos reales de la obra
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Facturas, planilla, cuentas de pago y control del IVA del 13% de Hacienda.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={recargar} className={claseBotonSecundario}>🔄 Actualizar</button>
          <button type="button" onClick={() => setProyectoForm({ nombre: '', ubicacion: '', responsable: '' })} className={claseBotonSecundario}>
            🏗️ Nuevo proyecto
          </button>
          {esAdmin && (
            <button type="button" onClick={() => setCuentaForm({ nombre: '', titular: '', tipo: 'efectivo' })} className={claseBotonSecundario}>
              🏦 Cuentas
            </button>
          )}
          {vista === 'facturas' ? (
            <button
              type="button"
              onClick={() => abrirNueva()}
              disabled={proyectos.length === 0}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
              title={proyectos.length === 0 ? 'Primero crea un proyecto' : 'Registrar una factura'}
            >
              + Registrar factura
            </button>
          ) : (
            <button
              type="button"
              onClick={abrirNuevaPlanilla}
              disabled={proyectos.length === 0}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              + Registrar pago de planilla
            </button>
          )}
        </div>
      </div>

      {errorCarga && (
        <div className="rounded-xl border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-200 flex flex-wrap items-center justify-between gap-3">
          <span>No se pudo cargar el facturero: {errorCarga}</span>
          <button type="button" onClick={recargar} className="underline hover:no-underline">Reintentar</button>
        </div>
      )}

      {/* PROYECTOS */}
      <div className="space-y-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Proyecto / obra</span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setProyectoActivo(PROYECTO_TODOS)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              proyectoActivo === PROYECTO_TODOS ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
            }`}
          >
            🗂️ Todos ({facturas.length + planillas.length})
          </button>
          {proyectos.map((proyecto) => {
            const cantidad = facturas.filter((factura) => factura.proyectoId === proyecto.id).length
              + planillas.filter((planilla) => planilla.proyectoId === proyecto.id).length;
            const activo = proyectoActivo === proyecto.id;
            return (
              <button
                key={proyecto.id}
                type="button"
                onClick={() => setProyectoActivo(proyecto.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                  activo ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                }`}
                title={proyecto.ubicacion || proyecto.nombre}
              >
                🏗️ {proyecto.nombre} ({cantidad})
              </button>
            );
          })}
          {proyectos.length === 0 && (
            <span className="text-xs text-slate-500 self-center">Aún no hay proyectos. Crea el primero con “Nuevo proyecto”.</span>
          )}
        </div>

        {proyectoSeleccionado && (
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400 pt-1">
            {proyectoSeleccionado.ubicacion && <span>📍 {proyectoSeleccionado.ubicacion}</span>}
            {proyectoSeleccionado.responsable && <span>👷 {proyectoSeleccionado.responsable}</span>}
            <button type="button" onClick={() => setProyectoForm({ ...proyectoSeleccionado })} className="text-blue-400 hover:text-blue-300">
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
            Cada factura y cada planilla se imputan a un proyecto para que los gastos y el IVA queden separados.
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
          {/* TARJETAS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Total gastado</p>
              <p className="text-2xl font-bold text-emerald-400 font-mono mt-1">{formatearCRC(gastoTotal)}</p>
              <p className="text-[11px] text-slate-500 mt-1">
                Facturas {formatearCRC(gastoFacturas)} + planilla {formatearCRC(resumenPlanilla.total)}
              </p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Subtotal (base)</p>
              <p className="text-2xl font-bold text-slate-100 font-mono mt-1">{formatearCRC(resumenGeneral.subtotal)}</p>
              <p className="text-[11px] text-slate-500 mt-1">Monto sin impuestos</p>
            </div>
            <div className="rounded-xl border border-amber-800/60 bg-amber-950/20 p-4">
              <p className="text-[11px] uppercase tracking-wide text-amber-300/80">IVA 13% · Hacienda</p>
              <p className="text-2xl font-bold text-amber-300 font-mono mt-1">{formatearCRC(resumenGeneral.impuesto)}</p>
              <p className="text-[11px] text-amber-200/60 mt-1">IVA acumulado de las facturas</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Proveedores</p>
              <p className="text-2xl font-bold text-slate-100 font-mono mt-1">{proveedores.length}</p>
              <p className="text-[11px] text-slate-500 mt-1">
                {proyectoActivo === PROYECTO_TODOS ? 'Todos los proyectos' : proyectoSeleccionado?.nombre}
              </p>
            </div>
          </div>

          {/* PESTAÑAS */}
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-800">
            {[
              { id: 'facturas', etiqueta: `🧾 Facturas (${facturasDelProyecto.length})` },
              { id: 'planilla', etiqueta: `👷 Planilla (${planillasDelProyecto.length})` },
            ].map((opcion) => (
              <button
                key={opcion.id}
                type="button"
                onClick={() => setVista(opcion.id)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  vista === opcion.id
                    ? 'border-blue-500 text-white'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {opcion.etiqueta}
              </button>
            ))}
          </div>

          {vista === 'facturas' ? (
            <>
              {/* CONTROL DE IVA + CLASIFICACIÓN */}
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
                    <ul className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                      {resumen.porCategoria.map((categoria) => (
                        <li key={categoria.id}>
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="text-slate-300 truncate">
                              <span aria-hidden="true">{categoria.icono}</span> {categoria.nombre}
                            </span>
                            <span className="font-mono text-slate-200 shrink-0">{formatearCRC(categoria.total)}</span>
                          </div>
                          <div className="mt-1 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                            <div className={`h-full rounded-full ${categoria.barra}`} style={{ width: `${Math.max(2, Math.round(categoria.porcentaje))}%` }} />
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

              {/* GASTOS POR CUENTA */}
              <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>🏦</span> Gastos por cuenta
                    </h3>
                    <p className="text-[11px] text-slate-500">De qué cuenta o caja salió cada colón.</p>
                  </div>
                  {esAdmin && (
                    <button type="button" onClick={() => setCuentaForm({ nombre: '', titular: '', tipo: 'efectivo' })} className={claseBotonSecundario}>
                      + Nueva cuenta
                    </button>
                  )}
                </div>

                {resumenCuentas.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">
                    Aún no hay cuentas. {esAdmin ? 'Crea una con “+ Nueva cuenta”.' : 'Pide al administrador que cree las cuentas.'}
                  </p>
                ) : (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-slate-400 border-b border-slate-800">
                          <th className="text-left py-2 font-medium">Cuenta</th>
                          <th className="text-left py-2 font-medium">Titular / tipo</th>
                          <th className="text-center py-2 font-medium">Facturas</th>
                          <th className="text-right py-2 font-medium">Total</th>
                          <th className="text-right py-2 font-medium w-24">% del gasto</th>
                          <th className="text-right py-2 font-medium w-16"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/70">
                        {resumenCuentas.map((cuenta) => {
                          const tipo = tipoCuentaPorId(cuenta.tipo);
                          return (
                            <tr key={cuenta.id} className="hover:bg-slate-800/40">
                              <td className="py-2 text-slate-200">
                                <button
                                  type="button"
                                  onClick={() => setCuentaFiltro(cuenta.id === '__sin__' ? '' : cuenta.id)}
                                  className="hover:text-blue-300 text-left"
                                  title="Filtrar por esta cuenta"
                                >
                                  {tipo.icono} {cuenta.nombre}
                                </button>
                              </td>
                              <td className="py-2 text-slate-400">
                                {cuenta.titular || '—'}
                                {cuenta.id !== '__sin__' && <span className="text-slate-500"> · {tipo.nombre}</span>}
                              </td>
                              <td className="py-2 text-center text-slate-300 font-mono">{cuenta.cantidad}</td>
                              <td className="py-2 text-right text-emerald-300 font-mono font-semibold">{formatearCRC(cuenta.total)}</td>
                              <td className="py-2 text-right text-slate-400 font-mono">{cuenta.porcentaje.toFixed(1)}%</td>
                              <td className="py-2 text-right">
                                {esAdmin && cuenta.id !== '__sin__' && (
                                  <button
                                    type="button"
                                    onClick={() => setCuentaForm({ ...cuentas.find((item) => item.id === cuenta.id) })}
                                    className="text-slate-400 hover:text-blue-300 px-1"
                                    aria-label={`Editar cuenta ${cuenta.nombre}`}
                                    title="Editar cuenta"
                                  >
                                    ✏️
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* COMPARATIVO POR PROYECTO */}
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
                              <button type="button" onClick={() => setProyectoActivo(fila.proyecto.id)} className="text-blue-300 hover:text-blue-200 font-medium text-left">
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

              {/* FILTROS */}
              <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>🔎</span> Facturas registradas
                    <span className="text-[11px] font-normal text-slate-400">({resumen.cantidad} de {facturasDelProyecto.length})</span>
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={exportarCSV} className={claseBotonSecundario}>📊 CSV / Excel</button>
                    <button type="button" onClick={exportarPDF} disabled={exportando} className={claseBotonSecundario}>
                      {exportando ? 'Generando…' : '📄 Reporte PDF'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2">
                  <div className="lg:col-span-2">
                    <label className="sr-only" htmlFor="filtro-busqueda">Buscar factura</label>
                    <input
                      id="filtro-busqueda"
                      type="search"
                      value={busqueda}
                      onChange={(evento) => setBusqueda(evento.target.value)}
                      placeholder="Buscar por n.º, proveedor o nota…"
                      className={claseCampoChico}
                    />
                  </div>
                  <div>
                    <label className="sr-only" htmlFor="filtro-categoria">Clasificación</label>
                    <select id="filtro-categoria" value={categoriaFiltro} onChange={(evento) => setCategoriaFiltro(evento.target.value)} className={claseCampoChico}>
                      <option value="">Toda clasificación</option>
                      {CATEGORIAS.map((categoria) => (
                        <option key={categoria.id} value={categoria.id}>{categoria.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="sr-only" htmlFor="filtro-cuenta">Cuenta</label>
                    <select id="filtro-cuenta" value={cuentaFiltro} onChange={(evento) => setCuentaFiltro(evento.target.value)} className={claseCampoChico}>
                      <option value="">Toda cuenta</option>
                      {cuentas.map((cuenta) => (
                        <option key={cuenta.id} value={cuenta.id}>{cuenta.nombre}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="sr-only" htmlFor="filtro-desde">Desde</label>
                    <input id="filtro-desde" type="date" value={desde} onChange={(evento) => setDesde(evento.target.value)} title="Desde" className={claseCampoChico} />
                  </div>
                  <div>
                    <label className="sr-only" htmlFor="filtro-hasta">Hasta</label>
                    <input id="filtro-hasta" type="date" value={hasta} onChange={(evento) => setHasta(evento.target.value)} title="Hasta" className={claseCampoChico} />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="sr-only" htmlFor="filtro-orden">Ordenar por</label>
                    <select
                      id="filtro-orden"
                      value={orden.campo}
                      onChange={(evento) => setOrden({ campo: evento.target.value, direccion: orden.direccion })}
                      className={claseCampoChico}
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
                    <button type="button" onClick={limpiarFiltros} className="text-blue-400 hover:text-blue-300 underline">Limpiar filtros</button>
                  </div>
                )}

                {/* BARRA DE ACCIONES EN LOTE */}
                {seleccion.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-700/60 bg-blue-950/40 px-3 py-2">
                    <span className="text-xs text-blue-100">
                      {seleccion.length} factura(s) seleccionada(s) ·{' '}
                      <span className="font-mono">{formatearCRC(facturasSeleccionadas.reduce((acc, f) => acc + f.total, 0))}</span>
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setModalReasignar(true)}
                        className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg"
                      >
                        🔀 Mover a otra cuenta / proyecto
                      </button>
                      <button type="button" onClick={() => setSeleccion([])} className="text-xs text-slate-300 hover:text-white underline">
                        Quitar selección
                      </button>
                    </div>
                  </div>
                )}
              </section>

              {/* TABLA DE FACTURAS */}
              <section className="rounded-xl border border-slate-800 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-800/90 text-slate-300">
                      <tr>
                        <th className="p-2 w-8">
                          <input
                            type="checkbox"
                            checked={todosSeleccionados}
                            onChange={alternarTodos}
                            aria-label="Seleccionar todas las facturas listadas"
                            className="accent-blue-500"
                          />
                        </th>
                        <EncabezadoOrdenable campo="fecha" etiqueta="Fecha" orden={orden} onOrdenar={alternarOrden} />
                        <EncabezadoOrdenable campo="numeroFactura" etiqueta="N.º factura" orden={orden} onOrdenar={alternarOrden} />
                        <EncabezadoOrdenable campo="proveedor" etiqueta="Proveedor" orden={orden} onOrdenar={alternarOrden} />
                        {proyectoActivo === PROYECTO_TODOS && (
                          <th className="p-2 text-left text-[11px] uppercase tracking-wide text-slate-400 align-bottom">Proyecto</th>
                        )}
                        <EncabezadoOrdenable campo="categoria" etiqueta="Clasificación" orden={orden} onOrdenar={alternarOrden} />
                        <th className="p-2 text-left text-[11px] uppercase tracking-wide text-slate-400 align-bottom">Cuenta</th>
                        <EncabezadoOrdenable campo="subtotal" etiqueta="Subtotal" orden={orden} onOrdenar={alternarOrden} alineacion="right" />
                        <EncabezadoOrdenable campo="impuesto" etiqueta="IVA" orden={orden} onOrdenar={alternarOrden} alineacion="right" />
                        <EncabezadoOrdenable campo="total" etiqueta="Total" orden={orden} onOrdenar={alternarOrden} alineacion="right" />
                        <th className="p-2 text-center text-[11px] uppercase tracking-wide text-slate-400 align-bottom w-20">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 bg-slate-900/60">
                      {ordenadas.length === 0 && (
                        <tr>
                          <td colSpan={proyectoActivo === PROYECTO_TODOS ? 11 : 10} className="p-8 text-center text-sm text-slate-400">
                            {facturasDelProyecto.length === 0
                              ? 'Aún no hay facturas en este proyecto. Usa “+ Registrar factura”.'
                              : 'Ninguna factura coincide con los filtros aplicados.'}
                          </td>
                        </tr>
                      )}

                      {ordenadas.map((factura) => {
                        const categoria = categoriaPorId(factura.categoria);
                        const cuenta = cuentas.find((item) => item.id === factura.cuentaId);
                        return (
                          <tr key={factura.id} className={`hover:bg-slate-800/40 transition-colors ${seleccion.includes(factura.id) ? 'bg-blue-950/30' : ''}`}>
                            <td className="p-2 text-center">
                              <input
                                type="checkbox"
                                checked={seleccion.includes(factura.id)}
                                onChange={() => alternarSeleccion(factura.id)}
                                aria-label={`Seleccionar factura ${factura.numeroFactura}`}
                                className="accent-blue-500"
                              />
                            </td>
                            <td className="p-2 text-slate-300 whitespace-nowrap font-mono text-xs">{fechaISOaTexto(factura.fecha)}</td>
                            <td className="p-2 text-slate-100 font-mono text-xs whitespace-nowrap">{factura.numeroFactura}</td>
                            <td className="p-2 text-slate-200">
                              <span className="block truncate max-w-[170px]" title={factura.proveedor}>{factura.proveedor}</span>
                              {factura.notas && (
                                <span className="block text-[10px] text-slate-500 truncate max-w-[170px]" title={factura.notas}>{factura.notas}</span>
                              )}
                            </td>
                            {proyectoActivo === PROYECTO_TODOS && (
                              <td className="p-2 text-xs text-slate-400">
                                <span className="block truncate max-w-[130px]" title={nombreProyecto(factura.proyectoId)}>{nombreProyecto(factura.proyectoId)}</span>
                              </td>
                            )}
                            <td className="p-2">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium whitespace-nowrap ${categoria.chip}`}>
                                <span aria-hidden="true">{categoria.icono}</span> {categoria.nombre}
                              </span>
                            </td>
                            <td className="p-2 text-[11px] text-slate-400">
                              <span className="block truncate max-w-[110px]" title={cuenta?.nombre ?? 'Sin cuenta'}>
                                {cuenta?.nombre ?? '—'}
                              </span>
                              {factura.historial?.length > 0 && (
                                <span className="text-[9px] text-amber-400/80" title={`Movida ${factura.historial.length} vez/veces`}>
                                  🔀 movida
                                </span>
                              )}
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
                          <td className="p-2 text-xs" colSpan={proyectoActivo === PROYECTO_TODOS ? 7 : 6}>
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
                Orden actual: <strong className="text-slate-400">{orden.campo}</strong>{' '}
                {orden.direccion === 'asc' ? 'ascendente (más antiguo primero)' : 'descendente (más reciente primero)'}. Haz clic en
                cualquier encabezado para cambiar el orden.
              </p>
            </>
          ) : (
            <>
              {/* PLANILLA */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-green-800/60 bg-green-950/20 p-4">
                  <p className="text-[11px] uppercase tracking-wide text-green-300/80">Total planilla</p>
                  <p className="text-2xl font-bold text-green-300 font-mono mt-1">{formatearCRC(resumenPlanilla.total)}</p>
                  <p className="text-[11px] text-green-200/60 mt-1">Sin IVA · {resumenPlanilla.cantidad} pago(s)</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">Días pagados</p>
                  <p className="text-2xl font-bold text-slate-100 font-mono mt-1">{resumenPlanilla.dias}</p>
                  <p className="text-[11px] text-slate-500 mt-1">Jornales acumulados</p>
                </div>
                <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">Trabajadores</p>
                  <p className="text-2xl font-bold text-slate-100 font-mono mt-1">{resumenPlanilla.trabajadores.length}</p>
                  <p className="text-[11px] text-slate-500 mt-1">Personas con pagos registrados</p>
                </div>
              </div>

              {resumenPlanilla.trabajadores.length > 0 && (
                <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                    <span>👥</span> Resumen por trabajador
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-slate-400 border-b border-slate-800">
                          <th className="text-left py-2 font-medium">Trabajador</th>
                          <th className="text-center py-2 font-medium">Pagos</th>
                          <th className="text-center py-2 font-medium">Días</th>
                          <th className="text-right py-2 font-medium">Total pagado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/70">
                        {resumenPlanilla.trabajadores.map((trabajador) => (
                          <tr key={trabajador.nombre}>
                            <td className="py-2 text-slate-200">{trabajador.nombre}</td>
                            <td className="py-2 text-center text-slate-300 font-mono">{trabajador.pagos}</td>
                            <td className="py-2 text-center text-slate-300 font-mono">{trabajador.dias}</td>
                            <td className="py-2 text-right text-green-300 font-mono font-semibold">{formatearCRC(trabajador.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}

              <section className="rounded-xl border border-slate-800 overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-800 bg-slate-900/60">
                  <h3 className="text-sm font-bold text-white">👷 Pagos de planilla ({planillasDelProyecto.length})</h3>
                  <button type="button" onClick={exportarPlanillaCSV} className={claseBotonSecundario}>📊 CSV / Excel</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-800/90 text-slate-300">
                      <tr>
                        <th className="p-2 text-left text-[11px] uppercase tracking-wide text-slate-400">Fecha de pago</th>
                        <th className="p-2 text-left text-[11px] uppercase tracking-wide text-slate-400">Trabajador</th>
                        <th className="p-2 text-left text-[11px] uppercase tracking-wide text-slate-400">Puesto</th>
                        {proyectoActivo === PROYECTO_TODOS && (
                          <th className="p-2 text-left text-[11px] uppercase tracking-wide text-slate-400">Proyecto</th>
                        )}
                        <th className="p-2 text-left text-[11px] uppercase tracking-wide text-slate-400">Período</th>
                        <th className="p-2 text-center text-[11px] uppercase tracking-wide text-slate-400">Días</th>
                        <th className="p-2 text-right text-[11px] uppercase tracking-wide text-slate-400">Jornal</th>
                        <th className="p-2 text-right text-[11px] uppercase tracking-wide text-slate-400">Extras</th>
                        <th className="p-2 text-right text-[11px] uppercase tracking-wide text-slate-400">Deducc.</th>
                        <th className="p-2 text-right text-[11px] uppercase tracking-wide text-slate-400">Total</th>
                        <th className="p-2 text-left text-[11px] uppercase tracking-wide text-slate-400">Cuenta</th>
                        <th className="p-2 text-center text-[11px] uppercase tracking-wide text-slate-400 w-20">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 bg-slate-900/60">
                      {planillasDelProyecto.length === 0 && (
                        <tr>
                          <td colSpan={proyectoActivo === PROYECTO_TODOS ? 12 : 11} className="p-8 text-center text-sm text-slate-400">
                            Aún no hay pagos de planilla. Usa “+ Registrar pago de planilla”.
                          </td>
                        </tr>
                      )}
                      {planillasDelProyecto.map((planilla) => (
                        <tr key={planilla.id} className="hover:bg-slate-800/40">
                          <td className="p-2 text-slate-300 whitespace-nowrap font-mono text-xs">{fechaISOaTexto(planilla.fecha)}</td>
                          <td className="p-2 text-slate-100">{planilla.trabajador}</td>
                          <td className="p-2 text-slate-400 text-xs">{planilla.puesto || '—'}</td>
                          {proyectoActivo === PROYECTO_TODOS && (
                            <td className="p-2 text-xs text-slate-400">
                              <span className="block truncate max-w-[130px]">{nombreProyecto(planilla.proyectoId)}</span>
                            </td>
                          )}
                          <td className="p-2 text-[11px] text-slate-400 whitespace-nowrap">
                            {planilla.periodoDesde || planilla.periodoHasta
                              ? `${fechaISOaTexto(planilla.periodoDesde) || '—'} → ${fechaISOaTexto(planilla.periodoHasta) || '—'}`
                              : '—'}
                          </td>
                          <td className="p-2 text-center font-mono text-xs text-slate-300">{planilla.dias}</td>
                          <td className="p-2 text-right font-mono text-xs text-slate-300">{formatearCRC(planilla.jornalDia)}</td>
                          <td className="p-2 text-right font-mono text-xs text-slate-300">{formatearCRC(planilla.horasExtra)}</td>
                          <td className="p-2 text-right font-mono text-xs text-red-300">{formatearCRC(planilla.deducciones)}</td>
                          <td className="p-2 text-right font-mono text-sm font-semibold text-green-300">{formatearCRC(planilla.total)}</td>
                          <td className="p-2 text-[11px] text-slate-400">
                            <span className="block truncate max-w-[110px]" title={nombreCuenta(planilla.cuentaId)}>{nombreCuenta(planilla.cuentaId)}</span>
                          </td>
                          <td className="p-2 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => setFormularioPlanilla({ ...planilla })}
                              className="text-slate-400 hover:text-blue-300 px-1"
                              aria-label={`Editar planilla de ${planilla.trabajador}`}
                              title="Editar"
                            >
                              ✏️
                            </button>
                            <button
                              type="button"
                              onClick={() => eliminarPlanilla(planilla)}
                              className="text-slate-400 hover:text-red-300 px-1"
                              aria-label={`Eliminar planilla de ${planilla.trabajador}`}
                              title="Eliminar"
                            >
                              🗑️
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    {planillasDelProyecto.length > 0 && (
                      <tfoot className="bg-slate-900 border-t-2 border-slate-700">
                        <tr className="text-slate-100 font-semibold">
                          <td className="p-2 text-xs" colSpan={proyectoActivo === PROYECTO_TODOS ? 5 : 4}>
                            Total planilla ({resumenPlanilla.cantidad} pago{resumenPlanilla.cantidad === 1 ? '' : 's'})
                          </td>
                          <td className="p-2 text-center font-mono text-xs">{resumenPlanilla.dias}</td>
                          <td colSpan={3}></td>
                          <td className="p-2 text-right font-mono text-sm text-green-300">{formatearCRC(resumenPlanilla.total)}</td>
                          <td colSpan={2}></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </section>
            </>
          )}
        </>
      )}

      {/* FORMULARIOS Y MODALES */}
      {formulario && (
        <FormularioFactura
          key={formulario.id ?? 'nueva-factura'}
          factura={formulario}
          proyectos={proyectos}
          cuentas={cuentas}
          proveedores={proveedores}
          guardando={guardando}
          onGuardar={guardarFactura}
          onCerrar={() => setFormulario(null)}
        />
      )}

      {formularioPlanilla && (
        <FormularioPlanilla
          key={formularioPlanilla.id ?? 'nueva-planilla'}
          planilla={formularioPlanilla}
          proyectos={proyectos}
          cuentas={cuentas}
          guardando={guardando}
          onGuardar={guardarPlanilla}
          onCerrar={() => setFormularioPlanilla(null)}
        />
      )}

      {modalReasignar && facturasSeleccionadas.length > 0 && (
        <ModalReasignar
          facturas={facturasSeleccionadas}
          cuentas={cuentas}
          proyectos={proyectos}
          guardando={reasignando}
          onAplicar={aplicarReasignacion}
          onCerrar={() => setModalReasignar(false)}
          notificar={notificar}
        />
      )}

      {proyectoForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4" role="dialog" aria-modal="true">
          <form onSubmit={guardarProyecto} className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl my-auto">
            <header className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
              <div>
                <h2 className="text-base font-bold text-white">{proyectoForm.id ? 'Editar proyecto' : 'Nuevo proyecto / obra'}</h2>
                <p className="text-xs text-slate-400">Cada proyecto lleva su propio facturero y su planilla.</p>
              </div>
              <button type="button" onClick={() => setProyectoForm(null)} className="text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-800" aria-label="Cerrar">✕</button>
            </header>

            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1" htmlFor="proyecto-nombre">Nombre del proyecto *</label>
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
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1" htmlFor="proyecto-ubicacion">Ubicación</label>
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
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1" htmlFor="proyecto-responsable">Encargado / equipo</label>
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
                <button type="button" onClick={() => eliminarProyecto(proyectoForm)} className="text-xs text-red-300 hover:text-red-200 border border-red-900/60 bg-red-950/30 px-3 py-2 rounded-lg">
                  🗑️ Eliminar proyecto
                </button>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setProyectoForm(null)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm px-4 py-2 rounded-lg border border-slate-700">Cancelar</button>
                <button type="submit" disabled={guardandoProyecto} className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60">
                  {guardandoProyecto ? 'Guardando…' : 'Guardar proyecto'}
                </button>
              </div>
            </footer>
          </form>
        </div>
      )}

      {cuentaForm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4" role="dialog" aria-modal="true">
          <form onSubmit={guardarCuenta} className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl my-auto">
            <header className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
              <div>
                <h2 className="text-base font-bold text-white">{cuentaForm.id ? 'Editar cuenta' : 'Nueva cuenta / caja'}</h2>
                <p className="text-xs text-slate-400">Solo el administrador puede crear cuentas.</p>
              </div>
              <button type="button" onClick={() => setCuentaForm(null)} className="text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-800" aria-label="Cerrar">✕</button>
            </header>

            <div className="px-5 py-4 space-y-3">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1" htmlFor="cuenta-nombre">Nombre de la cuenta *</label>
                <input
                  id="cuenta-nombre"
                  type="text"
                  autoFocus
                  required
                  value={cuentaForm.nombre}
                  onChange={(evento) => setCuentaForm({ ...cuentaForm, nombre: evento.target.value })}
                  placeholder="Ej. Cuenta del jefe / Efectivo obra"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1" htmlFor="cuenta-titular">Titular</label>
                <input
                  id="cuenta-titular"
                  type="text"
                  value={cuentaForm.titular}
                  onChange={(evento) => setCuentaForm({ ...cuentaForm, titular: evento.target.value })}
                  placeholder="Ej. Harold Rodríguez / Empresa"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1" htmlFor="cuenta-tipo">Tipo</label>
                <select
                  id="cuenta-tipo"
                  value={cuentaForm.tipo}
                  onChange={(evento) => setCuentaForm({ ...cuentaForm, tipo: evento.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 outline-none focus:border-blue-500"
                >
                  {TIPOS_CUENTA.map((tipo) => (
                    <option key={tipo.id} value={tipo.id}>{tipo.icono} {tipo.nombre}</option>
                  ))}
                </select>
              </div>
            </div>

            <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-800 px-5 py-4">
              <button type="button" onClick={() => setCuentaForm(null)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm px-4 py-2 rounded-lg border border-slate-700">Cancelar</button>
              <button type="submit" disabled={guardandoCuenta} className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60">
                {guardandoCuenta ? 'Guardando…' : 'Guardar cuenta'}
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}
