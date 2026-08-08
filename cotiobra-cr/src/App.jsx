import { descargarProforma } from './generarProforma';
import React, { useState, useEffect } from 'react';
import html2pdf from 'html2pdf.js';
// Importamos la configuración y métodos de Firebase
import { auth, db } from './firebase'; // Asegúrate de ajustar la ruta si tu archivo firebase.js está en otro folder
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { collection, addDoc, getDocs, query, orderBy, serverTimestamp } from 'firebase/firestore';
import Login from './Login';

export default function App() {
  // --- ESTADO DE AUTENTICACIÓN ---
  const [usuario, setUsuario] = useState(null);
  const [verificandoSesion, setVerificandoSesion] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUsuario(user);
      setVerificandoSesion(false);
    });
    return () => unsubscribe();
  }, []);

  const [vistaActual, setVistaActual] = useState('cotizador');
  const [cargandoGuardado, setCargandoGuardado] = useState(false);
  const [cargandoHistorial, setCargandoHistorial] = useState(false);
  const [historialCotizaciones, setHistorialCotizaciones] = useState([]);

  // --- DATOS DEL EMISOR Y PAGO ---
  const [cotizacion, setCotizacion] = useState({
    numeroCotizacion: `COT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    cedula: '3-101-000000',
    telefono: '+506 8888-8888',
    correo: 'contacto@cotiobracr.com',
    validez: '15 días',
    cuentaIBAN: 'CR05015202001023456789',
    banco: 'Banco de Costa Rica (BCR)',
    elaboradoPor: 'Ing. Harold Rodríguez'
  });

  // --- DATOS DEL CLIENTE Y PROYECTO ---
  const [cliente, setCliente] = useState({
    nombre: '',
    empresa: '',
    correo: '',
    telefono: '',
    proyecto: '',
    ubicacion: 'San José, Costa Rica',
    fechaInicio: ''
  });

  // --- TABLAS DINÁMICAS ---
  const [materiales, setMateriales] = useState([
    { id: 1, descripcion: 'Cemento Holcim 50kg', unidad: 'Saco', cantidad: 10, precioUnitario: 5500, marca: 'Holcim' },
    { id: 2, descripcion: 'Varilla No. 3 (3/8") Grado 60', unidad: 'Varilla', cantidad: 25, precioUnitario: 3200, marca: 'ArcelorMittal' }
  ]);

  const [manoDeObra, setManoDeObra] = useState([
    { id: 1, concepto: 'Oficial de Albañilería', especialidad: 'Estructuras', horasDias: 5, costoUnidad: 25000 },
    { id: 2, concepto: 'Peón de Construcción', especialidad: 'Soporte General', horasDias: 5, costoUnidad: 16000 }
  ]);

  const [equipos, setEquipos] = useState([
    { id: 1, descripcion: 'Mezcladora de concreto 1 saco', tipo: 'Alquiler', dias: 2, costoDia: 15000 }
  ]);

  const [subcontratos, setSubcontratos] = useState([
    { id: 1, servicio: 'Estudio de Suelos', proveedor: 'GeoTec CR', costoTotal: 150000 }
  ]);

  // --- AJUSTES Y TÉRMINOS COMERCIALES ---
  const [porcentajeIva, setPorcentajeIva] = useState(13);
  const [porcentajeUtilidad, setPorcentajeUtilidad] = useState(10);
  const [porcentajeImprevistos, setPorcentajeImprevistos] = useState(5);
  const [condiciones, setCondiciones] = useState({
    adelanto: '50% al firmar / 50% contra entrega',
    tiempoEjecucion: '15 días hábiles',
    garantia: '6 meses sobre mano de obra',
    notas: 'No incluye permisos municipales de construcción salvo solicitud explícita.'
  });

  // --- MANEJO DE FILAS ---
  const agregarFila = (tipo) => {
    const nuevoId = Date.now();
    if (tipo === 'materiales') setMateriales([...materiales, { id: nuevoId, descripcion: '', unidad: 'Unid', cantidad: 1, precioUnitario: 0, marca: '' }]);
    if (tipo === 'manoDeObra') setManoDeObra([...manoDeObra, { id: nuevoId, concepto: '', especialidad: '', horasDias: 1, costoUnidad: 0 }]);
    if (tipo === 'equipos') setEquipos([...equipos, { id: nuevoId, descripcion: '', tipo: 'Alquiler', dias: 1, costoDia: 0 }]);
    if (tipo === 'subcontratos') setSubcontratos([...subcontratos, { id: nuevoId, servicio: '', proveedor: '', costoTotal: 0 }]);
  };

  const eliminarFila = (tipo, id) => {
    if (tipo === 'materiales') setMateriales(materiales.filter(i => i.id !== id));
    if (tipo === 'manoDeObra') setManoDeObra(manoDeObra.filter(i => i.id !== id));
    if (tipo === 'equipos') setEquipos(equipos.filter(i => i.id !== id));
    if (tipo === 'subcontratos') setSubcontratos(subcontratos.filter(i => i.id !== id));
  };

  const actualizarFila = (tipo, id, campo, valor) => {
    const fn = list => list.map(i => (i.id === id ? { ...i, [campo]: valor } : i));
    if (tipo === 'materiales') setMateriales(fn(materiales));
    if (tipo === 'manoDeObra') setManoDeObra(fn(manoDeObra));
    if (tipo === 'equipos') setEquipos(fn(equipos));
    if (tipo === 'subcontratos') setSubcontratos(fn(subcontratos));
  };

  // --- CÁLCULOS MATEMÁTICOS ---
  const subtotalMateriales = materiales.reduce((acc, i) => acc + (Number(i.cantidad) * Number(i.precioUnitario) || 0), 0);
  const subtotalManoDeObra = manoDeObra.reduce((acc, i) => acc + (Number(i.horasDias) * Number(i.costoUnidad) || 0), 0);
  const subtotalEquipos = equipos.reduce((acc, i) => acc + (Number(i.dias) * Number(i.costoDia) || 0), 0);
  const subtotalSubcontratos = subcontratos.reduce((acc, i) => acc + (Number(i.costoTotal) || 0), 0);

  const costoDirectoTotal = subtotalMateriales + subtotalManoDeObra + subtotalEquipos + subtotalSubcontratos;
  const montoImprevistos = costoDirectoTotal * (Number(porcentajeImprevistos) / 100);
  const montoUtilidad = costoDirectoTotal * (Number(porcentajeUtilidad) / 100);
  
  const subtotalNeto = costoDirectoTotal + montoImprevistos + montoUtilidad;
  const montoIva = subtotalNeto * (Number(porcentajeIva) / 100);
  const totalGeneral = subtotalNeto + montoIva;

  const handleLimpiar = () => {
    setCotizacion(prev => ({
      ...prev,
      numeroCotizacion: `COT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`
    }));
    setCliente({ nombre: '', empresa: '', correo: '', telefono: '', proyecto: '', ubicacion: '', fechaInicio: '' });
    setMateriales([]);
    setManoDeObra([]);
    setEquipos([]);
    setSubcontratos([]);
  };

  // --- ACCIÓN 1: CERRAR SESIÓN ---
  const handleCerrarSesion = async () => {
    try {
      if (auth) {
        await signOut(auth);
      }
      alert('Sesión cerrada correctamente.');
      window.location.reload();
    } catch (error) {
      console.error("Error al cerrar sesión:", error);
      alert('Hubo un problema al cerrar la sesión.');
    }
  };

  // --- ACCIÓN 2: GUARDAR EN FIRESTORE ---
  const handleGuardarCotizacion = async () => {
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
          subtotalMateriales,
          subtotalManoDeObra,
          subtotalEquipos,
          subtotalSubcontratos,
          costoDirectoTotal,
          porcentajeImprevistos,
          montoImprevistos,
          porcentajeUtilidad,
          montoUtilidad,
          subtotalNeto,
          porcentajeIva,
          montoIva,
          totalGeneral
        },
        condiciones,
        creadoEn: serverTimestamp()
      };

      await addDoc(collection(db, 'cotizaciones'), datosCotizacion);
      alert('¡Cotización guardada con éxito en la base de datos!');
    } catch (error) {
      console.error("Error guardando en Firestore:", error);
      alert('Ocurrió un error al guardar la cotización. Verifica la configuración de Firebase.');
    } finally {
      setCargandoGuardado(false);
    }
  };

  // --- ACCIÓN 3: CARGAR HISTORIAL DESDE FIRESTORE ---
  const cargarHistorial = async () => {
    try {
      setCargandoHistorial(true);
      const q = query(collection(db, 'cotizaciones'), orderBy('creadoEn', 'desc'));
      const querySnapshot = await getDocs(q);
      const lista = [];
      querySnapshot.forEach((doc) => {
        lista.push({ id: doc.id, ...doc.data() });
      });
      setHistorialCotizaciones(lista);
    } catch (error) {
      console.error("Error cargando historial:", error);
      alert('Error al cargar el historial de cotizaciones.');
    } finally {
      setCargandoHistorial(false);
    }
  };

  const handleCambiarVistaHistorial = () => {
    setVistaActual('historial');
    cargarHistorial();
  };

  const handleCargarCotizacionExistente = (docItem) => {
    if (docItem.cotizacion) setCotizacion(docItem.cotizacion);
    if (docItem.cliente) setCliente(docItem.cliente);
    if (docItem.materiales) setMateriales(docItem.materiales);
    if (docItem.manoDeObra) setManoDeObra(docItem.manoDeObra);
    if (docItem.equipos) setEquipos(docItem.equipos);
    if (docItem.subcontratos) setSubcontratos(docItem.subcontratos);
    if (docItem.condiciones) setCondiciones(docItem.condiciones);
    if (docItem.totales) {
      setPorcentajeIva(docItem.totales.porcentajeIva || 13);
      setPorcentajeUtilidad(docItem.totales.porcentajeUtilidad || 10);
      setPorcentajeImprevistos(docItem.totales.porcentajeImprevistos || 5);
    }
    setVistaActual('cotizador');
    alert(`Cotización ${docItem.cotizacion?.numeroCotizacion || ''} cargada correctamente.`);
  };

  // --- ACCIÓN 4: EXPORTAR A PDF ---
  const handleExportarPDF = () => {
    try {
      // Combina todas las tablas dinámicas en una sola lista de ítems para el PDF
      const itemsMateriales = materiales.map(m => ({
        descripcion: m.descripcion,
        unidad: m.unidad,
        cantidad: m.cantidad,
        precioUnitario: m.precioUnitario,
      }));
      const itemsManoDeObra = manoDeObra.map(m => ({
        descripcion: m.concepto,
        unidad: 'Día(s)',
        cantidad: m.horasDias,
        precioUnitario: m.costoUnidad,
      }));
      const itemsEquipos = equipos.map(e => ({
        descripcion: e.descripcion,
        unidad: 'Día(s)',
        cantidad: e.dias,
        precioUnitario: e.costoDia,
      }));
      const itemsSubcontratos = subcontratos.map(s => ({
        descripcion: s.servicio,
        unidad: 'Global',
        cantidad: 1,
        precioUnitario: s.costoTotal,
      }));

      const todosLosItems = [...itemsMateriales, ...itemsManoDeObra, ...itemsEquipos, ...itemsSubcontratos];

      descargarProforma({
        numProforma: cotizacion.numeroCotizacion,
        fecha: new Date().toLocaleDateString(),
        validez: cotizacion.validez || '15 días hábiles',
        cedulaEmisor: cotizacion.cedula,
        telefonoEmisor: cotizacion.telefono,
        correoEmisor: cotizacion.correo,
        cliente: cliente.nombre || 'Cliente General',
        empresaCliente: cliente.empresa,
        proyecto: cliente.proyecto || 'Proyecto / Obra General',
        ubicacion: cliente.ubicacion,
        items: todosLosItems.length > 0 ? todosLosItems : [
          { descripcion: 'Mano de Obra y Servicios', cantidad: 1, precioUnitario: 50000 }
        ],
        porcentajeIva: porcentajeIva,
        adelanto: condiciones.adelanto,
        tiempoEjecucion: condiciones.tiempoEjecucion,
        garantia: condiciones.garantia,
        cuentaIBAN: cotizacion.cuentaIBAN,
        banco: cotizacion.banco,
        notas: condiciones.notas,
      });
    } catch (error) {
      console.error("Error al exportar PDF:", error);
      alert("Hubo un error al generar el PDF. Revisa la consola.");
    }
  };

  // --- CONTROL DE ACCESO: mientras se verifica la sesión ---
  if (verificandoSesion) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-300">
        Verificando sesión...
      </div>
    );
  }

  // --- CONTROL DE ACCESO: si no hay usuario autenticado, muestra el login ---
  if (!usuario) {
    return <Login />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 md:p-8">
      {/* HEADER PRINCIPAL */}
      <header className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6 shadow-md">
        <div className="flex items-center gap-3">
          <span className="text-2xl">👷</span>
          <div>
            <h1 className="text-xl font-bold tracking-wide text-white">CotiObra CR</h1>
            <p className="text-xs text-slate-400">Control de Costos y Cotizaciones Profesionales</p>
          </div>
        </div>
        <nav className="flex items-center gap-2">
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
            onClick={handleCambiarVistaHistorial}
            className={`flex items-center gap-2 font-medium text-sm px-4 py-2 rounded-lg transition-colors ${
              vistaActual === 'historial' 
                ? 'bg-blue-600 text-white' 
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
            }`}
          >
            <span>📋</span> Historial
          </button>
          <button 
            type="button"
            onClick={handleCerrarSesion}
            title="Cerrar Sesión"
            className="flex items-center gap-2 bg-slate-800 hover:bg-red-900/50 hover:text-red-300 text-slate-300 font-medium text-sm px-3 py-2 rounded-lg border border-slate-700 transition-colors"
          >
            <span>🚪</span>
          </button>
        </nav>
      </header>

      {/* PANEL PRINCIPAL */}
      <main className="max-w-6xl mx-auto bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-8">
        {vistaActual === 'cotizador' ? (
          <div id="area-cotizacion" className="space-y-8 p-2">
            {/* BARRA DE BOTONES DE ACCIÓN */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
              <div className="flex items-center gap-3">
                <span className="text-3xl">📄</span>
                <div>
                  <h2 className="text-2xl font-extrabold text-white">Generador de Cotización</h2>
                  <span className="text-xs text-blue-400 font-mono font-semibold">{cotizacion.numeroCotizacion}</span>
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
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-sm px-3 py-2 rounded-lg border border-slate-700 transition-colors"
                >
                  <span>💾</span> {cargandoGuardado ? 'Guardando...' : 'Guardar'}
                </button>
                <button 
                  type="button" 
                  onClick={handleExportarPDF} 
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm px-4 py-2 rounded-lg transition-colors shadow-md"
                >
                  <span>📥</span> Exportar PDF
                </button>
              </div>
            </div>

            {/* SECCIÓN DATOS EMISOR */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-800/50 p-4 rounded-xl border border-slate-800">
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/60 rounded-lg px-3 py-2">
                <span className="text-slate-400">🆔</span>
                <input type="text" value={cotizacion.cedula} onChange={(e) => setCotizacion({ ...cotizacion, cedula: e.target.value })} className="bg-transparent text-sm text-slate-200 outline-none w-full" placeholder="Cédula Jurídica" />
              </div>
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/60 rounded-lg px-3 py-2">
                <span className="text-slate-400">📞</span>
                <input type="text" value={cotizacion.telefono} onChange={(e) => setCotizacion({ ...cotizacion, telefono: e.target.value })} className="bg-transparent text-sm text-slate-200 outline-none w-full" placeholder="Teléfono" />
              </div>
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/60 rounded-lg px-3 py-2">
                <span className="text-slate-400">✉️</span>
                <input type="email" value={cotizacion.correo} onChange={(e) => setCotizacion({ ...cotizacion, correo: e.target.value })} className="bg-transparent text-sm text-slate-200 outline-none w-full" placeholder="Correo Emisor" />
              </div>
              <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/60 rounded-lg px-3 py-2">
                <span className="text-slate-400 text-xs font-bold uppercase">Validez:</span>
                <input type="text" value={cotizacion.validez} onChange={(e) => setCotizacion({ ...cotizacion, validez: e.target.value })} className="bg-transparent text-sm text-slate-200 outline-none w-full" placeholder="Días de Oferta" />
              </div>
            </div>

            {/* SECCIÓN INFORMACIÓN CLIENTE Y PROYECTO */}
            <section className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-5 shadow-md">
              <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2 border-b border-slate-700 pb-3">
                <span>👤</span> Información del Cliente y Proyecto
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-300 uppercase">Nombre del Cliente</label>
                  <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2">
                    <span className="text-slate-500">👤</span>
                    <input type="text" placeholder="Ej. Juan Pérez" value={cliente.nombre} onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })} className="bg-transparent text-sm text-white placeholder-slate-500 outline-none w-full" />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-300 uppercase">Empresa del Cliente</label>
                  <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2">
                    <span className="text-slate-500">🏢</span>
                    <input type="text" placeholder="Ej. Constructora Del Valle S.A." value={cliente.empresa} onChange={(e) => setCliente({ ...cliente, empresa: e.target.value })} className="bg-transparent text-sm text-white placeholder-slate-500 outline-none w-full" />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-300 uppercase">Correo Electrónico</label>
                  <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2">
                    <span className="text-slate-500">✉️</span>
                    <input type="email" placeholder="cliente@ejemplo.com" value={cliente.correo} onChange={(e) => setCliente({ ...cliente, correo: e.target.value })} className="bg-transparent text-sm text-white placeholder-slate-500 outline-none w-full" />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-300 uppercase">Nombre del Proyecto / Obra</label>
                  <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2">
                    <span className="text-slate-500">💼</span>
                    <input type="text" placeholder="Ej. Remodelación Casa" value={cliente.proyecto} onChange={(e) => setCliente({ ...cliente, proyecto: e.target.value })} className="bg-transparent text-sm text-white placeholder-slate-500 outline-none w-full" />
                  </div>
                </div>
              </div>
            </section>

            {/* TABLA 1: MATERIALES E INSUMOS */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>🧱</span> 1. Materiales e Insumos
                </h3>
                <button type="button" onClick={() => agregarFila('materiales')} className="bg-blue-600/80 hover:bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg border border-blue-500 transition-colors">
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
                    {materiales.map((item) => (
                      <tr key={item.id}>
                        <td className="p-2">
                          <input type="text" value={item.descripcion} onChange={(e) => actualizarFila('materiales', item.id, 'descripcion', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 outline-none" placeholder="Nombre de insumo" />
                        </td>
                        <td className="p-2">
                          <input type="text" value={item.marca} onChange={(e) => actualizarFila('materiales', item.id, 'marca', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 outline-none text-xs" placeholder="Opcional" />
                        </td>
                        <td className="p-2">
                          <input type="text" value={item.unidad} onChange={(e) => actualizarFila('materiales', item.id, 'unidad', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-center text-slate-200 outline-none text-xs" />
                        </td>
                        <td className="p-2">
                          <input type="number" value={item.cantidad} onChange={(e) => actualizarFila('materiales', item.id, 'cantidad', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-center text-slate-200 outline-none" />
                        </td>
                        <td className="p-2">
                          <input type="number" value={item.precioUnitario} onChange={(e) => actualizarFila('materiales', item.id, 'precioUnitario', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-right text-slate-200 outline-none" />
                        </td>
                        <td className="p-2 text-right font-medium text-slate-200">
                          ₡{(Number(item.cantidad) * Number(item.precioUnitario) || 0).toLocaleString()}
                        </td>
                        <td className="p-2 text-center">
                          <button type="button" onClick={() => eliminarFila('materiales', item.id)} className="text-red-400 hover:text-red-300 font-bold px-1">✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* TABLA 2: MANO DE OBRA */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>🔨</span> 2. Mano de Obra
                </h3>
                <button type="button" onClick={() => agregarFila('manoDeObra')} className="bg-blue-600/80 hover:bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg border border-blue-500 transition-colors">
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
                    {manoDeObra.map((item) => (
                      <tr key={item.id}>
                        <td className="p-2">
                          <input type="text" value={item.concepto} onChange={(e) => actualizarFila('manoDeObra', item.id, 'concepto', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 outline-none" placeholder="Puesto u oficio" />
                        </td>
                        <td className="p-2">
                          <input type="text" value={item.especialidad} onChange={(e) => actualizarFila('manoDeObra', item.id, 'especialidad', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 outline-none text-xs" placeholder="Espec. trabajo" />
                        </td>
                        <td className="p-2">
                          <input type="number" value={item.horasDias} onChange={(e) => actualizarFila('manoDeObra', item.id, 'horasDias', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-center text-slate-200 outline-none" />
                        </td>
                        <td className="p-2">
                          <input type="number" value={item.costoUnidad} onChange={(e) => actualizarFila('manoDeObra', item.id, 'costoUnidad', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-right text-slate-200 outline-none" />
                        </td>
                        <td className="p-2 text-right font-medium text-slate-200">
                          ₡{(Number(item.horasDias) * Number(item.costoUnidad) || 0).toLocaleString()}
                        </td>
                        <td className="p-2 text-center">
                          <button type="button" onClick={() => eliminarFila('manoDeObra', item.id)} className="text-red-400 hover:text-red-300 font-bold px-1">✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* TABLA 3: EQUIPOS Y HERRAMIENTAS */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>🚜</span> 3. Equipos, Maquinaria y Alquileres
                </h3>
                <button type="button" onClick={() => agregarFila('equipos')} className="bg-blue-600/80 hover:bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg border border-blue-500 transition-colors">
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
                      <th className="p-3 w-32 text-right">Costo Dete. (₡)</th>
                      <th className="p-3 w-36 text-right">Subtotal (₡)</th>
                      <th className="p-3 w-10 text-center"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 bg-slate-900/60">
                    {equipos.map((item) => (
                      <tr key={item.id}>
                        <td className="p-2">
                          <input type="text" value={item.descripcion} onChange={(e) => actualizarFila('equipos', item.id, 'descripcion', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 outline-none" placeholder="Nombre equipo" />
                        </td>
                        <td className="p-2">
                          <input type="text" value={item.tipo} onChange={(e) => actualizarFila('equipos', item.id, 'tipo', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 outline-none text-xs" placeholder="Ej. Propio / Renta" />
                        </td>
                        <td className="p-2">
                          <input type="number" value={item.dias} onChange={(e) => actualizarFila('equipos', item.id, 'dias', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-center text-slate-200 outline-none" />
                        </td>
                        <td className="p-2">
                          <input type="number" value={item.costoDia} onChange={(e) => actualizarFila('equipos', item.id, 'costoDia', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-right text-slate-200 outline-none" />
                        </td>
                        <td className="p-2 text-right font-medium text-slate-200">
                          ₡{(Number(item.dias) * Number(item.costoDia) || 0).toLocaleString()}
                        </td>
                        <td className="p-2 text-center">
                          <button type="button" onClick={() => eliminarFila('equipos', item.id)} className="text-red-400 hover:text-red-300 font-bold px-1">✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* TABLA 4: SUBCONTRATOS Y SERVICIOS */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>📋</span> 4. Subcontratos y Servicios Especiales
                </h3>
                <button type="button" onClick={() => agregarFila('subcontratos')} className="bg-blue-600/80 hover:bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg border border-blue-500 transition-colors">
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
                    {subcontratos.map((item) => (
                      <tr key={item.id}>
                        <td className="p-2">
                          <input type="text" value={item.servicio} onChange={(e) => actualizarFila('subcontratos', item.id, 'servicio', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 outline-none" placeholder="Descripción servicio" />
                        </td>
                        <td className="p-2">
                          <input type="text" value={item.proveedor} onChange={(e) => actualizarFila('subcontratos', item.id, 'proveedor', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 outline-none text-xs" placeholder="Nombre empresa" />
                        </td>
                        <td className="p-2">
                          <input type="number" value={item.costoTotal} onChange={(e) => actualizarFila('subcontratos', item.id, 'costoTotal', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-right text-slate-200 outline-none font-medium" />
                        </td>
                        <td className="p-2 text-center">
                          <button type="button" onClick={() => eliminarFila('subcontratos', item.id)} className="text-red-400 hover:text-red-300 font-bold px-1">✕</button>
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
                  <label className="text-xs text-slate-400 font-medium">Forma de Pago / Adelanto:</label>
                  <input type="text" value={condiciones.adelanto} onChange={(e) => setCondiciones({ ...condiciones, adelanto: e.target.value })} className="bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 outline-none" />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400 font-medium">Tiempo de Ejecución Estimado:</label>
                  <input type="text" value={condiciones.tiempoEjecucion} onChange={(e) => setCondiciones({ ...condiciones, tiempoEjecucion: e.target.value })} className="bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 outline-none" />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400 font-medium">Garantía Ofrecida:</label>
                  <input type="text" value={condiciones.garantia} onChange={(e) => setCondiciones({ ...condiciones, garantia: e.target.value })} className="bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 outline-none" />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400 font-medium">Notas / Exclusiones:</label>
                  <textarea rows={2} value={condiciones.notas} onChange={(e) => setCondiciones({ ...condiciones, notas: e.target.value })} className="bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 outline-none resize-none" />
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
                    <span className="font-mono">₡{subtotalMateriales.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Mano de Obra:</span>
                    <span className="font-mono">₡{subtotalManoDeObra.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Equipos y Alquileres:</span>
                    <span className="font-mono">₡{subtotalEquipos.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Subcontratos:</span>
                    <span className="font-mono">₡{subtotalSubcontratos.toLocaleString()}</span>
                  </div>
                  
                  <div className="flex justify-between text-slate-200 font-semibold border-t border-slate-800 pt-2">
                    <span>Total Costo Directo:</span>
                    <span className="font-mono text-blue-400">₡{costoDirectoTotal.toLocaleString()}</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80">
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Imprevistos (%):</label>
                      <input type="number" value={porcentajeImprevistos} onChange={(e) => setPorcentajeImprevistos(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-right text-xs outline-none text-slate-300 font-mono" />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 block mb-0.5">Utilidad (%):</label>
                      <input type="number" value={porcentajeUtilidad} onChange={(e) => setPorcentajeUtilidad(e.target.value)} className="w-full bg-slate-900 border border-slate-800 rounded px-2 py-1 text-right text-xs outline-none text-blue-400 font-bold font-mono" />
                    </div>
                  </div>

                  <div className="flex justify-between text-slate-300 pt-2">
                    <span>Subtotal Neto:</span>
                    <span className="font-mono">₡{subtotalNeto.toLocaleString()}</span>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-slate-400">I.V.A. Aplicado (%):</span>
                    <input type="number" value={porcentajeIva} onChange={(e) => setPorcentajeIva(e.target.value)} className="w-16 bg-slate-900 border border-slate-800 rounded px-2 py-0.5 text-right text-xs outline-none text-slate-300 font-mono" />
                  </div>

                  <div className="flex justify-between text-slate-400">
                    <span>Monto I.V.A. ({porcentajeIva}%):</span>
                    <span className="font-mono">₡{montoIva.toLocaleString()}</span>
                  </div>

                  <div className="flex justify-between items-center text-base font-extrabold text-emerald-400 bg-slate-900 p-3 rounded-lg border border-slate-800 mt-4">
                    <span>TOTAL GENERAL:</span>
                    <span className="font-mono text-xl">₡{totalGeneral.toLocaleString()}</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        ) : (
          /* VISTA HISTORIAL DE FIRESTORE */
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <span>📋</span> Historial de Cotizaciones
                </h2>
                <p className="text-xs text-slate-400">Cotizaciones registradas en Firestore</p>
              </div>
              <button 
                type="button"
                onClick={cargarHistorial}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-3 py-1.5 rounded-lg border border-slate-700 transition-colors"
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
                {historialCotizaciones.map((docItem) => (
                  <div key={docItem.id} className="bg-slate-800/60 border border-slate-700 rounded-xl p-4 flex flex-col justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-bold text-blue-400">{docItem.cotizacion?.numeroCotizacion || 'COT-SIN-CODIGO'}</span>
                        <span className="text-[10px] text-slate-400">
                          {docItem.creadoEn?.toDate ? docItem.creadoEn.toDate().toLocaleDateString() : 'Reciente'}
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-white">{docItem.cliente?.proyecto || 'Proyecto sin nombre'}</h4>
                      <p className="text-xs text-slate-300"><strong>Cliente:</strong> {docItem.cliente?.nombre || 'No especificado'}</p>
                      <p className="text-xs text-slate-400"><strong>Empresa:</strong> {docItem.cliente?.empresa || 'N/A'}</p>
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-700/80 pt-3">
                      <div>
                        <span className="text-[10px] text-slate-400 uppercase block">Total Cotizado</span>
                        <span className="text-base font-mono font-bold text-emerald-400">
                          ₡{(docItem.totales?.totalGeneral || 0).toLocaleString()}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCargarCotizacionExistente(docItem)}
                        className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                      >
                         Cargar Cotización
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}