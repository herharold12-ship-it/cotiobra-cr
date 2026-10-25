import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from './firebase.js';
import Login from './Login';
import Gastos from './gastos/Gastos.jsx';
import { calcularTotales, construirItems, PORCENTAJES_POR_DEFECTO } from './calculos.js';
import { aMonto, formatearCRC, formatearFecha } from './formato.js';

const crearNumeroCotizacion = () =>
  `COT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

const COTIZACION_INICIAL = {
  numeroCotizacion: crearNumeroCotizacion(),
  cedula: '3-101-000000',
  telefono: '+506 8888-8888',
  correo: 'contacto@cotiobracr.com',
  validez: '15 días',
  cuentaIBAN: 'CR05015202001023456789',
  banco: 'Banco de Costa Rica (BCR)',
  elaboradoPor: 'Ing. Harold Rodríguez',
};

const CLIENTE_INICIAL = {
  nombre: '',
  empresa: '',
  correo: '',
  telefono: '',
  proyecto: '',
  ubicacion: 'San José, Costa Rica',
  fechaInicio: '',
};

const CONDICIONES_INICIALES = {
  adelanto: '50% al firmar / 50% contra entrega',
  tiempoEjecucion: '15 días hábiles',
  garantia: '6 meses sobre mano de obra',
  notas: 'No incluye permisos municipales de construcción salvo solicitud explícita.',
};

const MATERIALES_INICIALES = [
  { id: 1, descripcion: 'Cemento Holcim 50kg', unidad: 'Saco', cantidad: 10, precioUnitario: 5500, marca: 'Holcim' },
  { id: 2, descripcion: 'Varilla No. 3 (3/8") Grado 60', unidad: 'Varilla', cantidad: 25, precioUnitario: 3200, marca: 'ArcelorMittal' },
];

const MANO_DE_OBRA_INICIAL = [
  { id: 1, concepto: 'Oficial de Albañilería', especialidad: 'Estructuras', horasDias: 5, costoUnidad: 25000 },
  { id: 2, concepto: 'Peón de Construcción', especialidad: 'Soporte General', horasDias: 5, costoUnidad: 16000 },
];

const EQUIPOS_INICIALES = [
  { id: 1, descripcion: 'Mezcladora de concreto 1 saco', tipo: 'Alquiler', dias: 2, costoDia: 15000 },
];

const SUBCONTRATOS_INICIALES = [
  { id: 1, servicio: 'Estudio de Suelos', proveedor: 'GeoTec CR', costoTotal: 150000 },
];

const claseInputTabla =
  'w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 outline-none focus:border-blue-500 transition-colors';

const mensajeDeError = (error) => {
  if (!error) return 'Ocurrió un error inesperado.';
  if (error.code === 'permission-denied') return 'Firestore rechazó la operación. Revisa las reglas de seguridad del proyecto.';
  if (error.code === 'unavailable') return 'Sin conexión con Firestore. Revisa tu conexión a internet.';
  if (error.code === 'unauthenticated') return 'Tu sesión expiró. Vuelve a iniciar sesión.';
  return error.message || 'Ocurrió un error inesperado.';
};

export default function App() {
  // --- SESIÓN ---
  const [usuario, setUsuario] = useState(null);
  const [verificandoSesion, setVerificandoSesion] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUsuario(user);
      setVerificandoSesion(false);
    });
    return () => unsubscribe();
  }, []);

  // --- AVISOS (reemplazan a los alert del navegador) ---
  const [aviso, setAviso] = useState(null);

  useEffect(() => {
    if (!aviso) return undefined;
    const temporizador = setTimeout(() => setAviso(null), 4500);
    return () => clearTimeout(temporizador);
  }, [aviso]);

  const notificar = useCallback((texto, tipo = 'exito') => setAviso({ texto, tipo }), []);

  // --- NAVEGACIÓN Y ESTADO DE CARGA ---
  const [vistaActual, setVistaActual] = useState('cotizador');
  const [cargandoGuardado, setCargandoGuardado] = useState(false);
  const [generandoPdf, setGenerandoPdf] = useState(false);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [historialCotizaciones, setHistorialCotizaciones] = useState([]);
  const [idDocumento, setIdDocumento] = useState(null);

  // --- DATOS DEL EMISOR Y PAGO ---
  const [cotizacion, setCotizacion] = useState({ ...COTIZACION_INICIAL });

  // --- DATOS DEL CLIENTE Y PROYECTO ---
  const [cliente, setCliente] = useState({ ...CLIENTE_INICIAL });

  // --- TABLAS DINÁMICAS ---
  const [materiales, setMateriales] = useState(MATERIALES_INICIALES.map((i) => ({ ...i })));
  const [manoDeObra, setManoDeObra] = useState(MANO_DE_OBRA_INICIAL.map((i) => ({ ...i })));
  const [equipos, setEquipos] = useState(EQUIPOS_INICIALES.map((i) => ({ ...i })));
  const [subcontratos, setSubcontratos] = useState(SUBCONTRATOS_INICIALES.map((i) => ({ ...i })));

  // --- AJUSTES Y TÉRMINOS COMERCIALES ---
  const [porcentajeIva, setPorcentajeIva] = useState(PORCENTAJES_POR_DEFECTO.iva);
  const [porcentajeUtilidad, setPorcentajeUtilidad] = useState(PORCENTAJES_POR_DEFECTO.utilidad);
  const [porcentajeImprevistos, setPorcentajeImprevistos] = useState(PORCENTAJES_POR_DEFECTO.imprevistos);
  const [condiciones, setCondiciones] = useState({ ...CONDICIONES_INICIALES });

  // --- MANEJO DE FILAS ---
  const contadorId = useRef(1000);
  const nuevoId = () => {
    contadorId.current += 1;
    return contadorId.current;
  };

  const agregarFila = (tipo) => {
    const id = nuevoId();
    if (tipo === 'materiales') setMateriales((prev) => [...prev, { id, descripcion: '', unidad: 'Unid', cantidad: 1, precioUnitario: 0, marca: '' }]);
    if (tipo === 'manoDeObra') setManoDeObra((prev) => [...prev, { id, concepto: '', especialidad: '', horasDias: 1, costoUnidad: 0 }]);
    if (tipo === 'equipos') setEquipos((prev) => [...prev, { id, descripcion: '', tipo: 'Alquiler', dias: 1, costoDia: 0 }]);
    if (tipo === 'subcontratos') setSubcontratos((prev) => [...prev, { id, servicio: '', proveedor: '', costoTotal: 0 }]);
  };

  const eliminarFila = (tipo, id) => {
    if (tipo === 'materiales') setMateriales((prev) => prev.filter((i) => i.id !== id));
    if (tipo === 'manoDeObra') setManoDeObra((prev) => prev.filter((i) => i.id !== id));
    if (tipo === 'equipos') setEquipos((prev) => prev.filter((i) => i.id !== id));
    if (tipo === 'subcontratos') setSubcontratos((prev) => prev.filter((i) => i.id !== id));
  };

  const actualizarFila = (tipo, id, campo, valor) => {
    const fn = (lista) => lista.map((i) => (i.id === id ? { ...i, [campo]: valor } : i));
    if (tipo === 'materiales') setMateriales(fn);
    if (tipo === 'manoDeObra') setManoDeObra(fn);
    if (tipo === 'equipos') setEquipos(fn);
    if (tipo === 'subcontratos') setSubcontratos(fn);
  };

  // --- CÁLCULOS (misma función que usa el PDF) ---
  const totales = calcularTotales({
    materiales,
    manoDeObra,
    equipos,
    subcontratos,
    porcentajeImprevistos,
    porcentajeUtilidad,
    porcentajeIva,
  });

  const {
    subtotalMateriales,
    subtotalManoDeObra,
    subtotalEquipos,
    subtotalSubcontratos,
    costoDirectoTotal,
    montoImprevistos,
    montoUtilidad,
    subtotalNeto,
    montoIva,
    totalGeneral,
  } = totales;

  const items = construirItems({ materiales, manoDeObra, equipos, subcontratos });

  // --- ACCIONES ---
  const handleLimpiar = () => {
    if (!window.confirm('¿Vaciar la cotización actual? Los datos no guardados se perderán.')) return;
    setCotizacion({ ...COTIZACION_INICIAL, numeroCotizacion: crearNumeroCotizacion() });
    setCliente({ ...CLIENTE_INICIAL });
    setMateriales([]);
    setManoDeObra([]);
    setEquipos([]);
    setSubcontratos([]);
    setCondiciones({ ...CONDICIONES_INICIALES });
    setPorcentajeIva(PORCENTAJES_POR_DEFECTO.iva);
    setPorcentajeUtilidad(PORCENTAJES_POR_DEFECTO.utilidad);
    setPorcentajeImprevistos(PORCENTAJES_POR_DEFECTO.imprevistos);
    setIdDocumento(null);
    setVistaActual('cotizador');
    notificar('Cotización reiniciada.');
  };

  const validarCotizacion = () => {
    if (!cliente.nombre.trim()) return 'Ingresa el nombre del cliente.';
    if (!cliente.proyecto.trim()) return 'Ingresa el nombre del proyecto u obra.';
    if (items.length === 0) return 'Agrega al menos un ítem con descripción o monto.';
    return null;
  };

  const handleCerrarSesion = async () => {
    try {
      await signOut(auth);
      notificar('Sesión cerrada correctamente.');
    } catch (error) {
      notificar(`No se pudo cerrar la sesión: ${mensajeDeError(error)}`, 'error');
    }
  };

  const handleGuardarCotizacion = async () => {
    const problema = validarCotizacion();
    if (problema) {
      notificar(problema, 'error');
      return;
    }

    try {
      setCargandoGuardado(true);

      const datosCotizacion = {
        cotizacion,
        cliente,
        materiales,
        manoDeObra,
        equipos,
        subcontratos,
        totales: {
          ...totales,
          items,
        },
        condiciones: { ...condiciones, cuentaIBAN: cotizacion.cuentaIBAN, banco: cotizacion.banco },
        actualizadoEn: serverTimestamp(),
        actualizadoPor: usuario?.email ?? null,
      };

      if (idDocumento) {
        await updateDoc(doc(db, 'cotizaciones', idDocumento), datosCotizacion);
        notificar(`Cotización ${cotizacion.numeroCotizacion} actualizada.`);
      } else {
        const referencia = await addDoc(collection(db, 'cotizaciones'), {
          ...datosCotizacion,
          creadoEn: serverTimestamp(),
          creadoPor: usuario?.email ?? null,
        });
        setIdDocumento(referencia.id);
        notificar(`Cotización ${cotizacion.numeroCotizacion} guardada.`);
      }
    } catch (error) {
      console.error('Error guardando en Firestore:', error);
      notificar(`No se pudo guardar: ${mensajeDeError(error)}`, 'error');
    } finally {
      setCargandoGuardado(false);
    }
  };

  const cargarHistorial = async () => {
    try {
      setCargandoHistorial(true);
      let instantanea;
      try {
        instantanea = await getDocs(query(collection(db, 'cotizaciones'), orderBy('creadoEn', 'desc')));
      } catch (error) {
        // Documentos viejos sin fecha o sin índice: se cargan sin ordenar.
        if (error.code !== 'failed-precondition') throw error;
        instantanea = await getDocs(collection(db, 'cotizaciones'));
      }

      const lista = instantanea.docs.map((documento) => ({ id: documento.id, ...documento.data() }));
      lista.sort((a, b) => {
        const fechaA = a.creadoEn?.toDate?.()?.getTime() ?? 0;
        const fechaB = b.creadoEn?.toDate?.()?.getTime() ?? 0;
        return fechaB - fechaA;
      });
      setHistorialCotizaciones(lista);
    } catch (error) {
      console.error('Error cargando historial:', error);
      notificar(`No se pudo cargar el historial: ${mensajeDeError(error)}`, 'error');
    } finally {
      setCargandoHistorial(false);
    }
  };

  const handleCambiarVistaHistorial = () => {
    setVistaActual('historial');
    cargarHistorial();
  };

  const handleCargarCotizacionExistente = (item) => {
    setCotizacion({ ...COTIZACION_INICIAL, ...(item.cotizacion ?? {}) });
    setCliente({ ...CLIENTE_INICIAL, ...(item.cliente ?? {}) });
    setMateriales((item.materiales ?? []).map((fila, indice) => ({ id: indice + 1, ...fila })));
    setManoDeObra((item.manoDeObra ?? []).map((fila, indice) => ({ id: indice + 1, ...fila })));
    setEquipos((item.equipos ?? []).map((fila, indice) => ({ id: indice + 1, ...fila })));
    setSubcontratos((item.subcontratos ?? []).map((fila, indice) => ({ id: indice + 1, ...fila })));
    setCondiciones({ ...CONDICIONES_INICIALES, ...(item.condiciones ?? {}) });
    setPorcentajeIva(item.totales?.porcentajeIva ?? PORCENTAJES_POR_DEFECTO.iva);
    setPorcentajeUtilidad(item.totales?.porcentajeUtilidad ?? PORCENTAJES_POR_DEFECTO.utilidad);
    setPorcentajeImprevistos(item.totales?.porcentajeImprevistos ?? PORCENTAJES_POR_DEFECTO.imprevistos);
    setIdDocumento(item.id);
    setVistaActual('cotizador');
    notificar(`Cotización ${item.cotizacion?.numeroCotizacion ?? ''} cargada.`);
  };

  const handleEliminarCotizacion = async (item) => {
    const numero = item.cotizacion?.numeroCotizacion ?? 'esta cotización';
    if (!window.confirm(`¿Eliminar ${numero}? Esta acción no se puede deshacer.`)) return;

    try {
      await deleteDoc(doc(db, 'cotizaciones', item.id));
      setHistorialCotizaciones((prev) => prev.filter((registro) => registro.id !== item.id));
      if (idDocumento === item.id) setIdDocumento(null);
      notificar(`Cotización ${numero} eliminada.`);
    } catch (error) {
      console.error('Error eliminando cotización:', error);
      notificar(`No se pudo eliminar: ${mensajeDeError(error)}`, 'error');
    }
  };

  const handleExportarPDF = async (registro) => {
    const origen = registro ?? {
      cotizacion,
      cliente,
      materiales,
      manoDeObra,
      equipos,
      subcontratos,
      condiciones,
      totales,
    };

    try {
      setGenerandoPdf(true);
      // jsPDF pesa bastante: se carga solo cuando el usuario exporta.
      const { descargarProforma } = await import('./generarProforma.js');
      const nombre = descargarProforma(origen);
      notificar(`PDF generado: ${nombre}`);
    } catch (error) {
      console.error('Error al exportar PDF:', error);
      notificar(
        error.message === 'La cotización no tiene ítems para exportar.'
          ? 'Agrega al menos un ítem antes de exportar el PDF.'
          : `No se pudo generar el PDF: ${error.message}`,
        'error',
      );
    } finally {
      setGenerandoPdf(false);
    }
  };

  // --- CONTROL DE ACCESO ---
  if (verificandoSesion) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300">
        Verificando sesión...
      </div>
    );
  }

  if (!usuario) {
    return <Login />;
  }

  const botonTabla =
    'bg-blue-600/80 hover:bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg border border-blue-500 transition-colors';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 md:p-8">
      {/* AVISO FLOTANTE */}
      {aviso && (
        <div
          role="status"
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md w-[calc(100%-2rem)] rounded-lg border px-4 py-3 text-sm shadow-xl ${
            aviso.tipo === 'error'
              ? 'bg-red-950/95 border-red-800 text-red-100'
              : 'bg-emerald-950/95 border-emerald-800 text-emerald-100'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <span>{aviso.texto}</span>
            <button type="button" onClick={() => setAviso(null)} aria-label="Cerrar aviso" className="opacity-70 hover:opacity-100">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* HEADER PRINCIPAL */}
      <header className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 shadow-md">
        <div className="flex items-center gap-3">
          <span className="text-2xl">👷</span>
          <div>
            <h1 className="text-xl font-bold tracking-wide text-white">CotiObra CR</h1>
            <p className="text-xs text-slate-400">Control de Costos y Cotizaciones Profesionales</p>
          </div>
        </div>
        <nav className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setVistaActual('cotizador')}
            className={`flex items-center gap-2 font-medium text-sm px-4 py-2 rounded-lg transition-colors ${
              vistaActual === 'cotizador'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
            }`}
          >
            <span>🧮</span> Cotizador
          </button>
          <button
            type="button"
            onClick={() => setVistaActual('gastos')}
            className={`flex items-center gap-2 font-medium text-sm px-4 py-2 rounded-lg transition-colors ${
              vistaActual === 'gastos'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
            }`}
          >
            <span>🧾</span> Gastos
          </button>
          <button
            type="button"
            onClick={handleCambiarVistaHistorial}
            className={`flex items-center gap-2 font-medium text-sm px-4 py-2 rounded-lg transition-colors ${
              vistaActual === 'historial'
                ? 'bg-blue-600 text-white'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
            }`}
          >
            <span>📋</span> Historial
          </button>
          <span className="hidden sm:block text-[11px] text-slate-400 max-w-[160px] truncate" title={usuario.email ?? ''}>
            {usuario.email}
          </span>
          <button
            type="button"
            onClick={handleCerrarSesion}
            title="Cerrar sesión"
            className="flex items-center gap-2 bg-slate-800 hover:bg-red-900/50 hover:text-red-300 text-slate-300 font-medium text-sm px-3 py-2 rounded-lg border border-slate-700 transition-colors"
          >
            <span>🚪</span> <span className="hidden sm:inline">Salir</span>
          </button>
        </nav>
      </header>

      {/* PANEL PRINCIPAL */}
      <main className="max-w-6xl mx-auto bg-slate-900 border border-slate-800 rounded-xl p-4 md:p-6 shadow-xl space-y-8">
        {vistaActual === 'cotizador' && (
          <div id="area-cotizacion" className="space-y-8 p-1">
            {/* BARRA DE BOTONES DE ACCIÓN */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
              <div className="flex items-center gap-3">
                <span className="text-3xl">📄</span>
                <div>
                  <h2 className="text-2xl font-extrabold text-white">Generador de Cotización</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <label htmlFor="numero-cotizacion" className="text-xs text-blue-400 font-mono font-semibold">
                      N.º
                    </label>
                    <input
                      id="numero-cotizacion"
                      type="text"
                      value={cotizacion.numeroCotizacion}
                      onChange={(evento) => setCotizacion({ ...cotizacion, numeroCotizacion: evento.target.value })}
                      className="bg-slate-950 border border-slate-700 rounded px-2 py-0.5 text-xs text-blue-300 font-mono outline-none focus:border-blue-500"
                      placeholder="COT-2026-0001"
                    />
                    {idDocumento && <span className="text-[10px] text-emerald-400">● guardada</span>}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={handleLimpiar} className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm px-3 py-2 rounded-lg border border-slate-700 transition-colors">
                  <span>🔄</span> Limpiar
                </button>
                <button
                  type="button"
                  onClick={handleGuardarCotizacion}
                  disabled={cargandoGuardado}
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm px-3 py-2 rounded-lg border border-slate-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <span>💾</span> {cargandoGuardado ? 'Guardando...' : 'Guardar'}
                </button>
                <button
                  type="button"
                  onClick={() => handleExportarPDF()}
                  disabled={generandoPdf}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm px-4 py-2 rounded-lg transition-colors shadow-md disabled:opacity-60 disabled:cursor-progress"
                >
                  <span>📥</span> {generandoPdf ? 'Generando PDF...' : 'Exportar PDF'}
                </button>
              </div>
            </div>

            {/* SECCIÓN DATOS EMISOR */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-800/50 p-4 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/60 rounded-lg px-3 py-2">
                <span className="text-slate-400">🆔</span>
                <input
                  type="text"
                  value={cotizacion.cedula}
                  onChange={(evento) => setCotizacion({ ...cotizacion, cedula: evento.target.value })}
                  className="bg-transparent text-sm text-slate-200 outline-none w-full"
                  placeholder="Cédula Jurídica"
                  aria-label="Cédula del emisor"
                />
              </div>
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/60 rounded-lg px-3 py-2">
                <span className="text-slate-400">📞</span>
                <input
                  type="text"
                  value={cotizacion.telefono}
                  onChange={(evento) => setCotizacion({ ...cotizacion, telefono: evento.target.value })}
                  className="bg-transparent text-sm text-slate-200 outline-none w-full"
                  placeholder="Teléfono"
                  aria-label="Teléfono del emisor"
                />
              </div>
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/60 rounded-lg px-3 py-2">
                <span className="text-slate-400">✉️</span>
                <input
                  type="email"
                  value={cotizacion.correo}
                  onChange={(evento) => setCotizacion({ ...cotizacion, correo: evento.target.value })}
                  className="bg-transparent text-sm text-slate-200 outline-none w-full"
                  placeholder="Correo Emisor"
                  aria-label="Correo del emisor"
                />
              </div>
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/60 rounded-lg px-3 py-2">
                <span className="text-slate-400 text-xs font-bold uppercase">Validez</span>
                <input
                  type="text"
                  value={cotizacion.validez}
                  onChange={(evento) => setCotizacion({ ...cotizacion, validez: evento.target.value })}
                  className="bg-transparent text-sm text-slate-200 outline-none w-full"
                  placeholder="Días de oferta"
                  aria-label="Validez de la oferta"
                />
              </div>
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/60 rounded-lg px-3 py-2">
                <span className="text-slate-400">🧑‍💼</span>
                <input
                  type="text"
                  value={cotizacion.elaboradoPor}
                  onChange={(evento) => setCotizacion({ ...cotizacion, elaboradoPor: evento.target.value })}
                  className="bg-transparent text-sm text-slate-200 outline-none w-full"
                  placeholder="Elaborado por"
                  aria-label="Elaborado por"
                />
              </div>
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/60 rounded-lg px-3 py-2">
                <span className="text-slate-400">🏦</span>
                <input
                  type="text"
                  value={cotizacion.cuentaIBAN}
                  onChange={(evento) => setCotizacion({ ...cotizacion, cuentaIBAN: evento.target.value })}
                  className="bg-transparent text-sm text-slate-200 outline-none w-full font-mono"
                  placeholder="IBAN / Cuenta"
                  aria-label="Cuenta IBAN"
                />
              </div>
            </div>

            {/* SECCIÓN INFORMACIÓN CLIENTE Y PROYECTO */}
            <section className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 shadow-md">
              <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2 border-b border-slate-700 pb-3">
                <span>👤</span> Información del Cliente y Proyecto
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="cliente-nombre" className="text-xs font-semibold text-slate-300 uppercase">Nombre del Cliente</label>
                  <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2">
                    <span className="text-slate-500">👤</span>
                    <input
                      id="cliente-nombre"
                      type="text"
                      placeholder="Ej. Juan Pérez"
                      value={cliente.nombre}
                      onChange={(evento) => setCliente({ ...cliente, nombre: evento.target.value })}
                      className="bg-transparent text-sm text-white placeholder-slate-500 outline-none w-full"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="cliente-empresa" className="text-xs font-semibold text-slate-300 uppercase">Empresa del Cliente</label>
                  <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2">
                    <span className="text-slate-500">🏢</span>
                    <input
                      id="cliente-empresa"
                      type="text"
                      placeholder="Ej. Constructora Del Valle S.A."
                      value={cliente.empresa}
                      onChange={(evento) => setCliente({ ...cliente, empresa: evento.target.value })}
                      className="bg-transparent text-sm text-white placeholder-slate-500 outline-none w-full"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="cliente-correo" className="text-xs font-semibold text-slate-300 uppercase">Correo Electrónico</label>
                  <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2">
                    <span className="text-slate-500">✉️</span>
                    <input
                      id="cliente-correo"
                      type="email"
                      placeholder="cliente@ejemplo.com"
                      value={cliente.correo}
                      onChange={(evento) => setCliente({ ...cliente, correo: evento.target.value })}
                      className="bg-transparent text-sm text-white placeholder-slate-500 outline-none w-full"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="cliente-telefono" className="text-xs font-semibold text-slate-300 uppercase">Teléfono del Cliente</label>
                  <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2">
                    <span className="text-slate-500">📱</span>
                    <input
                      id="cliente-telefono"
                      type="tel"
                      placeholder="+506 8888-8888"
                      value={cliente.telefono}
                      onChange={(evento) => setCliente({ ...cliente, telefono: evento.target.value })}
                      className="bg-transparent text-sm text-white placeholder-slate-500 outline-none w-full"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="cliente-proyecto" className="text-xs font-semibold text-slate-300 uppercase">Nombre del Proyecto / Obra</label>
                  <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2">
                    <span className="text-slate-500">💼</span>
                    <input
                      id="cliente-proyecto"
                      type="text"
                      placeholder="Ej. Remodelación Casa"
                      value={cliente.proyecto}
                      onChange={(evento) => setCliente({ ...cliente, proyecto: evento.target.value })}
                      className="bg-transparent text-sm text-white placeholder-slate-500 outline-none w-full"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="cliente-ubicacion" className="text-xs font-semibold text-slate-300 uppercase">Ubicación de la Obra</label>
                  <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2">
                    <span className="text-slate-500">📍</span>
                    <input
                      id="cliente-ubicacion"
                      type="text"
                      placeholder="Ej. Liberia, Guanacaste"
                      value={cliente.ubicacion}
                      onChange={(evento) => setCliente({ ...cliente, ubicacion: evento.target.value })}
                      className="bg-transparent text-sm text-white placeholder-slate-500 outline-none w-full"
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* TABLA 1: MATERIALES E INSUMOS */}
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>🧱</span> 1. Materiales e Insumos
                </h3>
                <button type="button" onClick={() => agregarFila('materiales')} className={botonTabla}>
                  + Agregar Material
                </button>
              </div>
              <div className="overflow-x-auto border border-slate-800 rounded-xl">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-800/90 text-slate-300 uppercase text-xs">
                    <tr>
                      <th className="p-3">Descripción</th>
                      <th className="p-3 w-28">Marca/Esp.</th>
                      <th className="p-3 w-24 text-center">Unidad</th>
                      <th className="p-3 w-24 text-center">Cant.</th>
                      <th className="p-3 w-32 text-right">Precio Unit. (₡)</th>
                      <th className="p-3 w-36 text-right">Subtotal (₡)</th>
                      <th className="p-3 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 bg-slate-900/60">
                    {materiales.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-4 text-center text-xs text-slate-500">
                          Sin materiales. Usa “+ Agregar Material”.
                        </td>
                      </tr>
                    )}
                    {materiales.map((item) => (
                      <tr key={item.id}>
                        <td className="p-2">
                          <input type="text" value={item.descripcion} onChange={(evento) => actualizarFila('materiales', item.id, 'descripcion', evento.target.value)} className={claseInputTabla} placeholder="Nombre de insumo" aria-label="Descripción del material" />
                        </td>
                        <td className="p-2">
                          <input type="text" value={item.marca} onChange={(evento) => actualizarFila('materiales', item.id, 'marca', evento.target.value)} className={`${claseInputTabla} text-xs`} placeholder="Opcional" aria-label="Marca o especificación" />
                        </td>
                        <td className="p-2">
                          <input type="text" value={item.unidad} onChange={(evento) => actualizarFila('materiales', item.id, 'unidad', evento.target.value)} className={`${claseInputTabla} text-center text-xs`} aria-label="Unidad" />
                        </td>
                        <td className="p-2">
                          <input type="number" min="0" step="1" inputMode="decimal" value={item.cantidad} onChange={(evento) => actualizarFila('materiales', item.id, 'cantidad', evento.target.value)} className={`${claseInputTabla} text-center`} aria-label="Cantidad" />
                        </td>
                        <td className="p-2">
                          <input type="number" min="0" step="1" inputMode="decimal" value={item.precioUnitario} onChange={(evento) => actualizarFila('materiales', item.id, 'precioUnitario', evento.target.value)} className={`${claseInputTabla} text-right`} aria-label="Precio unitario" />
                        </td>
                        <td className="p-2 text-right font-medium text-slate-200">
                          {formatearCRC(aMonto(item.cantidad) * aMonto(item.precioUnitario))}
                        </td>
                        <td className="p-2 text-center">
                          <button type="button" onClick={() => eliminarFila('materiales', item.id)} className="text-red-400 hover:text-red-300 font-bold px-1" aria-label="Eliminar material">
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* TABLA 2: MANO DE OBRA */}
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>🔨</span> 2. Mano de Obra
                </h3>
                <button type="button" onClick={() => agregarFila('manoDeObra')} className={botonTabla}>
                  + Agregar Personal
                </button>
              </div>
              <div className="overflow-x-auto border border-slate-800 rounded-xl">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-800/90 text-slate-300 uppercase text-xs">
                    <tr>
                      <th className="p-3">Concepto / Cargo</th>
                      <th className="p-3 w-36">Especialidad</th>
                      <th className="p-3 w-28 text-center">Días / Horas</th>
                      <th className="p-3 w-32 text-right">Costo / Día (₡)</th>
                      <th className="p-3 w-36 text-right">Subtotal (₡)</th>
                      <th className="p-3 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 bg-slate-900/60">
                    {manoDeObra.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-xs text-slate-500">
                          Sin personal. Usa “+ Agregar Personal”.
                        </td>
                      </tr>
                    )}
                    {manoDeObra.map((item) => (
                      <tr key={item.id}>
                        <td className="p-2">
                          <input type="text" value={item.concepto} onChange={(evento) => actualizarFila('manoDeObra', item.id, 'concepto', evento.target.value)} className={claseInputTabla} placeholder="Puesto u oficio" aria-label="Concepto" />
                        </td>
                        <td className="p-2">
                          <input type="text" value={item.especialidad} onChange={(evento) => actualizarFila('manoDeObra', item.id, 'especialidad', evento.target.value)} className={`${claseInputTabla} text-xs`} placeholder="Espec. trabajo" aria-label="Especialidad" />
                        </td>
                        <td className="p-2">
                          <input type="number" min="0" step="1" inputMode="decimal" value={item.horasDias} onChange={(evento) => actualizarFila('manoDeObra', item.id, 'horasDias', evento.target.value)} className={`${claseInputTabla} text-center`} aria-label="Días u horas" />
                        </td>
                        <td className="p-2">
                          <input type="number" min="0" step="1" inputMode="decimal" value={item.costoUnidad} onChange={(evento) => actualizarFila('manoDeObra', item.id, 'costoUnidad', evento.target.value)} className={`${claseInputTabla} text-right`} aria-label="Costo por día" />
                        </td>
                        <td className="p-2 text-right font-medium text-slate-200">
                          {formatearCRC(aMonto(item.horasDias) * aMonto(item.costoUnidad))}
                        </td>
                        <td className="p-2 text-center">
                          <button type="button" onClick={() => eliminarFila('manoDeObra', item.id)} className="text-red-400 hover:text-red-300 font-bold px-1" aria-label="Eliminar personal">
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* TABLA 3: EQUIPOS Y HERRAMIENTAS */}
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>🚜</span> 3. Equipos, Maquinaria y Alquileres
                </h3>
                <button type="button" onClick={() => agregarFila('equipos')} className={botonTabla}>
                  + Agregar Equipo
                </button>
              </div>
              <div className="overflow-x-auto border border-slate-800 rounded-xl">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-800/90 text-slate-300 uppercase text-xs">
                    <tr>
                      <th className="p-3">Descripción de Maquinaria</th>
                      <th className="p-3 w-32">Modalidad</th>
                      <th className="p-3 w-28 text-center">Tiempo / Días</th>
                      <th className="p-3 w-32 text-right">Costo / Día (₡)</th>
                      <th className="p-3 w-36 text-right">Subtotal (₡)</th>
                      <th className="p-3 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 bg-slate-900/60">
                    {equipos.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-xs text-slate-500">
                          Sin equipos. Usa “+ Agregar Equipo”.
                        </td>
                      </tr>
                    )}
                    {equipos.map((item) => (
                      <tr key={item.id}>
                        <td className="p-2">
                          <input type="text" value={item.descripcion} onChange={(evento) => actualizarFila('equipos', item.id, 'descripcion', evento.target.value)} className={claseInputTabla} placeholder="Nombre equipo" aria-label="Descripción del equipo" />
                        </td>
                        <td className="p-2">
                          <input type="text" value={item.tipo} onChange={(evento) => actualizarFila('equipos', item.id, 'tipo', evento.target.value)} className={`${claseInputTabla} text-xs`} placeholder="Ej. Propio / Renta" aria-label="Modalidad" />
                        </td>
                        <td className="p-2">
                          <input type="number" min="0" step="1" inputMode="decimal" value={item.dias} onChange={(evento) => actualizarFila('equipos', item.id, 'dias', evento.target.value)} className={`${claseInputTabla} text-center`} aria-label="Días de uso" />
                        </td>
                        <td className="p-2">
                          <input type="number" min="0" step="1" inputMode="decimal" value={item.costoDia} onChange={(evento) => actualizarFila('equipos', item.id, 'costoDia', evento.target.value)} className={`${claseInputTabla} text-right`} aria-label="Costo por día" />
                        </td>
                        <td className="p-2 text-right font-medium text-slate-200">
                          {formatearCRC(aMonto(item.dias) * aMonto(item.costoDia))}
                        </td>
                        <td className="p-2 text-center">
                          <button type="button" onClick={() => eliminarFila('equipos', item.id)} className="text-red-400 hover:text-red-300 font-bold px-1" aria-label="Eliminar equipo">
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* TABLA 4: SUBCONTRATOS Y SERVICIOS */}
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>📋</span> 4. Subcontratos y Servicios Especiales
                </h3>
                <button type="button" onClick={() => agregarFila('subcontratos')} className={botonTabla}>
                  + Agregar Subcontrato
                </button>
              </div>
              <div className="overflow-x-auto border border-slate-800 rounded-xl">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-800/90 text-slate-300 uppercase text-xs">
                    <tr>
                      <th className="p-3">Servicio / Rubro</th>
                      <th className="p-3 w-48">Proveedor / Especialista</th>
                      <th className="p-3 w-48 text-right">Costo Global (₡)</th>
                      <th className="p-3 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 bg-slate-900/60">
                    {subcontratos.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-4 text-center text-xs text-slate-500">
                          Sin subcontratos. Usa “+ Agregar Subcontrato”.
                        </td>
                      </tr>
                    )}
                    {subcontratos.map((item) => (
                      <tr key={item.id}>
                        <td className="p-2">
                          <input type="text" value={item.servicio} onChange={(evento) => actualizarFila('subcontratos', item.id, 'servicio', evento.target.value)} className={claseInputTabla} placeholder="Descripción servicio" aria-label="Servicio" />
                        </td>
                        <td className="p-2">
                          <input type="text" value={item.proveedor} onChange={(evento) => actualizarFila('subcontratos', item.id, 'proveedor', evento.target.value)} className={`${claseInputTabla} text-xs`} placeholder="Nombre empresa" aria-label="Proveedor" />
                        </td>
                        <td className="p-2">
                          <input type="number" min="0" step="1" inputMode="decimal" value={item.costoTotal} onChange={(evento) => actualizarFila('subcontratos', item.id, 'costoTotal', evento.target.value)} className={`${claseInputTabla} text-right font-medium`} aria-label="Costo global" />
                        </td>
                        <td className="p-2 text-center">
                          <button type="button" onClick={() => eliminarFila('subcontratos', item.id)} className="text-red-400 hover:text-red-300 font-bold px-1" aria-label="Eliminar subcontrato">
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* SECCIÓN CONDICIONES Y LIQUIDACIÓN FINANCIERA */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4 border-t border-slate-800">
              {/* TÉRMINOS Y CONDICIONES */}
              <div className="bg-slate-800/40 p-5 rounded-xl border border-slate-800 space-y-4">
                <h3 className="text-base font-bold text-white border-b border-slate-800 pb-2 flex items-center gap-2">
                  <span>📝</span> Términos Comerciales y Pago
                </h3>

                <div className="flex flex-col gap-1">
                  <label htmlFor="cond-adelanto" className="text-xs text-slate-400 font-medium">Forma de Pago / Adelanto:</label>
                  <input id="cond-adelanto" type="text" value={condiciones.adelanto} onChange={(evento) => setCondiciones({ ...condiciones, adelanto: evento.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-500" />
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="cond-tiempo" className="text-xs text-slate-400 font-medium">Tiempo de Ejecución Estimado:</label>
                  <input id="cond-tiempo" type="text" value={condiciones.tiempoEjecucion} onChange={(evento) => setCondiciones({ ...condiciones, tiempoEjecucion: evento.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-500" />
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="cond-garantia" className="text-xs text-slate-400 font-medium">Garantía Ofrecida:</label>
                  <input id="cond-garantia" type="text" value={condiciones.garantia} onChange={(evento) => setCondiciones({ ...condiciones, garantia: evento.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-500" />
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="cond-notas" className="text-xs text-slate-400 font-medium">Notas / Exclusiones:</label>
                  <textarea id="cond-notas" rows={3} value={condiciones.notas} onChange={(evento) => setCondiciones({ ...condiciones, notas: evento.target.value })} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 outline-none resize-none focus:border-blue-500" />
                </div>
              </div>

              {/* DESGLOSE Y LIQUIDACIÓN MATEMÁTICA */}
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
                <h3 className="text-base font-bold text-white border-b border-slate-800 pb-2 flex items-center gap-2">
                  <span>💵</span> Liquidación de la Oferta
                </h3>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>Materiales e Insumos:</span>
                    <span className="font-mono">{formatearCRC(subtotalMateriales)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Mano de Obra:</span>
                    <span className="font-mono">{formatearCRC(subtotalManoDeObra)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Equipos y Alquileres:</span>
                    <span className="font-mono">{formatearCRC(subtotalEquipos)}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Subcontratos:</span>
                    <span className="font-mono">{formatearCRC(subtotalSubcontratos)}</span>
                  </div>

                  <div className="flex justify-between text-slate-200 font-semibold border-t border-slate-800 pt-2">
                    <span>Total Costo Directo:</span>
                    <span className="font-mono text-blue-400">{formatearCRC(costoDirectoTotal)}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80">
                    <div>
                      <label htmlFor="pct-imprevistos" className="text-[10px] text-slate-400 block mb-0.5">Imprevistos (%):</label>
                      <input id="pct-imprevistos" type="number" min="0" max="100" step="1" value={porcentajeImprevistos} onChange={(evento) => setPorcentajeImprevistos(evento.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-right text-xs outline-none text-slate-300 font-mono focus:border-blue-500" />
                    </div>
                    <div>
                      <label htmlFor="pct-utilidad" className="text-[10px] text-slate-400 block mb-0.5">Utilidad (%):</label>
                      <input id="pct-utilidad" type="number" min="0" max="100" step="1" value={porcentajeUtilidad} onChange={(evento) => setPorcentajeUtilidad(evento.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-right text-xs outline-none text-blue-400 font-bold font-mono focus:border-blue-500" />
                    </div>
                  </div>

                  <div className="flex justify-between text-slate-400 pt-1">
                    <span>Imprevistos:</span>
                    <span className="font-mono">{formatearCRC(montoImprevistos)}</span>
                  </div>

                  <div className="flex justify-between text-slate-400">
                    <span>Utilidad:</span>
                    <span className="font-mono">{formatearCRC(montoUtilidad)}</span>
                  </div>

                  <div className="flex justify-between text-slate-300 pt-2 border-t border-slate-800">
                    <span>Subtotal Neto:</span>
                    <span className="font-mono">{formatearCRC(subtotalNeto)}</span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor="pct-iva" className="text-slate-400">I.V.A. Aplicado (%):</label>
                    <input id="pct-iva" type="number" min="0" max="100" step="1" value={porcentajeIva} onChange={(evento) => setPorcentajeIva(evento.target.value)} className="w-16 bg-slate-900 border border-slate-800 rounded px-2 py-0.5 text-right text-xs outline-none text-slate-300 font-mono focus:border-blue-500" />
                  </div>

                  <div className="flex justify-between text-slate-400">
                    <span>Monto I.V.A. ({totales.porcentajeIva}%):</span>
                    <span className="font-mono">{formatearCRC(montoIva)}</span>
                  </div>

                  <div className="flex justify-between items-center text-base font-extrabold text-emerald-400 bg-slate-900 p-3 rounded-lg border border-slate-800 mt-4">
                    <span>TOTAL GENERAL:</span>
                    <span className="font-mono text-xl">{formatearCRC(totalGeneral)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {vistaActual === 'historial' && (
          /* VISTA HISTORIAL DE FIRESTORE */
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>📋</span> Historial de Cotizaciones
                </h2>
                <p className="text-xs text-slate-400">Cotizaciones registradas en Firestore</p>
              </div>
              <button
                type="button"
                onClick={cargarHistorial}
                disabled={cargandoHistorial}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-3 py-1.5 rounded-lg border border-slate-700 transition-colors disabled:opacity-60"
              >
                🔄 Actualizar
              </button>
            </div>

            {cargandoHistorial ? (
              <div className="py-12 text-center text-slate-400">
                <span>⏳ Cargando historial de Firestore...</span>
              </div>
            ) : historialCotizaciones.length === 0 ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <span className="text-3xl">📂</span>
                <p>No se encontraron cotizaciones guardadas aún.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {historialCotizaciones.map((item) => (
                  <div key={item.id} className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 flex flex-col justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono font-bold text-blue-400">{item.cotizacion?.numeroCotizacion || 'COT-SIN-CODIGO'}</span>
                        <span className="text-[10px] text-slate-400">{item.creadoEn ? formatearFecha(item.creadoEn) : 'Sin fecha'}</span>
                      </div>
                      <h4 className="text-base font-bold text-white">{item.cliente?.proyecto || 'Proyecto sin nombre'}</h4>
                      <p className="text-xs text-slate-300"><strong>Cliente:</strong> {item.cliente?.nombre || 'No especificado'}</p>
                      <p className="text-xs text-slate-400"><strong>Empresa:</strong> {item.cliente?.empresa || 'N/A'}</p>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-700/80 pt-3">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase block">Total Cotizado</span>
                        <span className="text-base font-mono font-bold text-emerald-400">
                          {formatearCRC(item.totales?.totalGeneral ?? calcularTotales({
                            materiales: item.materiales,
                            manoDeObra: item.manoDeObra,
                            equipos: item.equipos,
                            subcontratos: item.subcontratos,
                            porcentajeImprevistos: item.totales?.porcentajeImprevistos,
                            porcentajeUtilidad: item.totales?.porcentajeUtilidad,
                            porcentajeIva: item.totales?.porcentajeIva,
                          }).totalGeneral)}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleExportarPDF(item)}
                          disabled={generandoPdf}
                          className="bg-slate-700 hover:bg-slate-600 text-slate-100 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-60"
                        >
                          📥 PDF
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCargarCotizacionExistente(item)}
                          className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                        >
                          Cargar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEliminarCotizacion(item)}
                          className="bg-slate-800 hover:bg-red-900/60 text-red-300 text-xs px-3 py-1.5 rounded-lg font-medium border border-red-900/50 transition-colors"
                          aria-label={`Eliminar ${item.cotizacion?.numeroCotizacion ?? 'cotización'}`}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {vistaActual === 'gastos' && (
          /* VISTA FACTURERO DE GASTOS REALES */
          <Gastos usuario={usuario} notificar={notificar} />
        )}
      </main>
    </div>
  );
}
