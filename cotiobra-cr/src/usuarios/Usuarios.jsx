import { useEffect, useState } from 'react';
import { collection, deleteDoc, doc, getDocs, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { CORREO_ADMIN_RAIZ, ROLES, esCorreoValido, normalizarEmail, rolPorId } from './acceso.js';
import { formatearFecha } from '../formato.js';

const claseCampo =
  'w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-blue-500 transition-colors';
const claseEtiqueta = 'block text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1';

const mensajeError = (error) => {
  if (!error) return 'Ocurrió un error inesperado.';
  if (error.code === 'permission-denied') return 'Solo el administrador puede administrar usuarios.';
  if (error.code === 'unavailable') return 'Sin conexión con Firestore.';
  return error.message || 'Ocurrió un error inesperado.';
};

/**
 * Administración de accesos: el administrador autoriza correos con un rol.
 * La cuenta de Firebase Authentication debe existir (se crea en la consola de
 * Firebase); aquí se controla quién puede entrar y qué puede hacer.
 */
export default function Usuarios({ perfil, notificar }) {
  const [autorizados, setAutorizados] = useState([]);
  const [perfiles, setPerfiles] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [formulario, setFormulario] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    setError('');
    try {
      const [snapAccesos, snapPerfiles] = await Promise.all([
        getDocs(collection(db, 'accesos')),
        getDocs(collection(db, 'usuarios')),
      ]);
      setAutorizados(
        snapAccesos.docs
          .map((documento) => ({ email: documento.id, ...documento.data() }))
          .sort((a, b) => a.email.localeCompare(b.email, 'es')),
      );
      setPerfiles(snapPerfiles.docs.map((documento) => ({ uid: documento.id, ...documento.data() })));
    } catch (err) {
      console.error('Error cargando usuarios:', err);
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    // Carga inicial de la lista al abrir la pantalla (el botón "Actualizar"
    // vuelve a consultar Firestore a mano).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargar();
  }, []);

  const guardar = async (evento) => {
    evento.preventDefault();
    const email = normalizarEmail(formulario?.email);

    if (!esCorreoValido(email)) {
      notificar('Escribe un correo electrónico válido.', 'error');
      return;
    }

    setGuardando(true);
    try {
      await setDoc(
        doc(db, 'accesos', email),
        {
          email,
          nombre: (formulario?.nombre ?? '').trim(),
          rol: rolPorId(formulario?.rol).id,
          activo: formulario?.activo !== false,
          actualizadoEn: serverTimestamp(),
          actualizadoPor: perfil?.email ?? null,
        },
        { merge: true },
      );

      // Si esa persona ya entró alguna vez, se actualiza su perfil al instante.
      const perfilesCoincidentes = perfiles.filter((item) => normalizarEmail(item.email) === email);
      await Promise.all(
        perfilesCoincidentes.map((item) =>
          updateDoc(doc(db, 'usuarios', item.uid), {
            rol: rolPorId(formulario?.rol).id,
            activo: formulario?.activo !== false,
            nombre: (formulario?.nombre ?? '').trim(),
            actualizadoEn: serverTimestamp(),
          }),
        ),
      );

      notificar(`Acceso de ${email} guardado.`);
      setFormulario(null);
      await cargar();
    } catch (err) {
      console.error('Error guardando acceso:', err);
      notificar(`No se pudo guardar: ${mensajeError(err)}`, 'error');
    } finally {
      setGuardando(false);
    }
  };

  const desactivar = async (autorizado) => {
    if (normalizarEmail(autorizado.email) === CORREO_ADMIN_RAIZ) {
      notificar('El administrador principal no se puede desactivar.', 'error');
      return;
    }
    if (!window.confirm(`¿Quitar el acceso a ${autorizado.email}?`)) return;

    try {
      await deleteDoc(doc(db, 'accesos', autorizado.email));
      const coincidentes = perfiles.filter((item) => normalizarEmail(item.email) === normalizarEmail(autorizado.email));
      await Promise.all(coincidentes.map((item) => updateDoc(doc(db, 'usuarios', item.uid), { activo: false })));
      notificar(`Acceso de ${autorizado.email} eliminado.`);
      await cargar();
    } catch (err) {
      console.error('Error eliminando acceso:', err);
      notificar(`No se pudo eliminar: ${mensajeError(err)}`, 'error');
    }
  };

  const yaEntro = (email) =>
    perfiles.some((item) => normalizarEmail(item.email) === normalizarEmail(email) && item.activo !== false);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>🔐</span> Usuarios de la empresa
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Solo tú autorizas quién entra. Nadie puede registrarse por su cuenta.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setCargando(true);
              cargar();
            }}
            className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium px-3 py-2 rounded-lg border border-slate-700"
          >
            🔄 Actualizar
          </button>
          <button
            type="button"
            onClick={() => setFormulario({ email: '', nombre: '', rol: 'capturista', activo: true })}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-lg"
          >
            + Autorizar correo
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-800 bg-red-950/50 px-4 py-3 text-sm text-red-200">{error}</div>
      )}

      <div className="rounded-xl border border-blue-800/50 bg-blue-950/20 px-4 py-3 text-xs text-blue-100/90 space-y-1">
        <p className="font-semibold">Cómo agregar a una persona (2 pasos)</p>
        <p>1. Crea su cuenta en <strong>Firebase → Authentication → Users → Add user</strong> (correo y contraseña temporal).</p>
        <p>2. Autoriza aquí ese mismo correo con su rol. Al entrar por primera vez, su perfil se crea solo con los permisos correctos.</p>
        <p className="text-blue-200/70">La contraseña la defines tú en Firebase; la app nunca la ve ni la guarda.</p>
      </div>

      <section className="rounded-xl border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/60">
          <h3 className="text-sm font-bold text-white">📋 Correos autorizados ({autorizados.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-800/90 text-slate-300">
              <tr>
                <th className="p-3 text-left text-[11px] uppercase tracking-wide text-slate-400">Correo</th>
                <th className="p-3 text-left text-[11px] uppercase tracking-wide text-slate-400">Nombre</th>
                <th className="p-3 text-left text-[11px] uppercase tracking-wide text-slate-400">Rol</th>
                <th className="p-3 text-left text-[11px] uppercase tracking-wide text-slate-400">Estado</th>
                <th className="p-3 text-left text-[11px] uppercase tracking-wide text-slate-400">Última actualización</th>
                <th className="p-3 text-center text-[11px] uppercase tracking-wide text-slate-400 w-24">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 bg-slate-900/60">
              <tr className="bg-amber-950/10">
                <td className="p-3 font-mono text-xs text-amber-200">{CORREO_ADMIN_RAIZ}</td>
                <td className="p-3 text-slate-300">Administrador principal</td>
                <td className="p-3"><span className="px-2 py-0.5 rounded-full border text-[10px] bg-amber-500/15 text-amber-300 border-amber-500/30">👑 Administrador</span></td>
                <td className="p-3 text-xs text-emerald-300">Siempre activo</td>
                <td className="p-3 text-xs text-slate-500">—</td>
                <td className="p-3 text-center text-xs text-slate-500">—</td>
              </tr>

              {cargando && (
                <tr><td colSpan={6} className="p-6 text-center text-sm text-slate-400">Cargando accesos…</td></tr>
              )}

              {!cargando && autorizados.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-sm text-slate-400">
                    Aún no has autorizado a nadie más. Usa “+ Autorizar correo”.
                  </td>
                </tr>
              )}

              {autorizados.map((autorizado) => {
                const rol = rolPorId(autorizado.rol);
                return (
                  <tr key={autorizado.email} className="hover:bg-slate-800/40">
                    <td className="p-3 font-mono text-xs text-slate-200">{autorizado.email}</td>
                    <td className="p-3 text-slate-300">{autorizado.nombre || '—'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full border text-[10px] ${rol.chip}`}>{rol.icono} {rol.nombre}</span>
                    </td>
                    <td className="p-3 text-xs">
                      {autorizado.activo === false ? (
                        <span className="text-red-300">Desactivado</span>
                      ) : yaEntro(autorizado.email) ? (
                        <span className="text-emerald-300">Activo · ya entró</span>
                      ) : (
                        <span className="text-amber-300">Activo · sin entrar aún</span>
                      )}
                    </td>
                    <td className="p-3 text-xs text-slate-500">
                      {autorizado.actualizadoEn ? formatearFecha(autorizado.actualizadoEn) : '—'}
                    </td>
                    <td className="p-3 text-center whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setFormulario({ ...autorizado })}
                        className="text-slate-400 hover:text-blue-300 px-1"
                        aria-label={`Editar acceso de ${autorizado.email}`}
                        title="Editar rol"
                      >
                        ✏️
                      </button>
                      <button
                        type="button"
                        onClick={() => desactivar(autorizado)}
                        className="text-slate-400 hover:text-red-300 px-1"
                        aria-label={`Quitar acceso a ${autorizado.email}`}
                        title="Quitar acceso"
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <h3 className="text-sm font-bold text-white mb-2">¿Qué puede hacer cada rol?</h3>
        <ul className="space-y-2">
          {ROLES.map((rol) => (
            <li key={rol.id} className="flex items-start gap-2 text-xs">
              <span className={`px-2 py-0.5 rounded-full border text-[10px] shrink-0 ${rol.chip}`}>{rol.icono} {rol.nombre}</span>
              <span className="text-slate-400">{rol.descripcion}</span>
            </li>
          ))}
        </ul>
      </section>

      {formulario && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4" role="dialog" aria-modal="true">
          <form onSubmit={guardar} className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl my-auto">
            <header className="flex items-start justify-between gap-4 border-b border-slate-800 px-5 py-4">
              <div>
                <h2 className="text-base font-bold text-white">Autorizar acceso</h2>
                <p className="text-xs text-slate-400">El correo debe existir en Firebase Authentication.</p>
              </div>
              <button type="button" onClick={() => setFormulario(null)} className="text-slate-400 hover:text-white px-2 py-1 rounded-lg hover:bg-slate-800" aria-label="Cerrar">✕</button>
            </header>

            <div className="px-5 py-4 space-y-3">
              <div>
                <label className={claseEtiqueta} htmlFor="usuario-email">Correo electrónico *</label>
                <input
                  id="usuario-email"
                  type="email"
                  autoFocus
                  required
                  disabled={Boolean(formulario.email && autorizados.some((item) => item.email === formulario.email))}
                  value={formulario.email}
                  onChange={(evento) => setFormulario({ ...formulario, email: evento.target.value })}
                  placeholder="persona@empresa.com"
                  className={`${claseCampo} font-mono disabled:opacity-60`}
                />
              </div>
              <div>
                <label className={claseEtiqueta} htmlFor="usuario-nombre">Nombre</label>
                <input
                  id="usuario-nombre"
                  type="text"
                  value={formulario.nombre ?? ''}
                  onChange={(evento) => setFormulario({ ...formulario, nombre: evento.target.value })}
                  placeholder="Ej. José Ramírez"
                  className={claseCampo}
                />
              </div>
              <div>
                <label className={claseEtiqueta} htmlFor="usuario-rol">Rol</label>
                <select
                  id="usuario-rol"
                  value={formulario.rol}
                  onChange={(evento) => setFormulario({ ...formulario, rol: evento.target.value })}
                  className={claseCampo}
                >
                  {ROLES.map((rol) => (
                    <option key={rol.id} value={rol.id}>{rol.icono} {rol.nombre}</option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">{rolPorId(formulario.rol).descripcion}</p>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={formulario.activo !== false}
                  onChange={(evento) => setFormulario({ ...formulario, activo: evento.target.checked })}
                  className="accent-blue-500"
                />
                Acceso activo
              </label>
            </div>

            <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-800 px-5 py-4">
              <button type="button" onClick={() => setFormulario(null)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm px-4 py-2 rounded-lg border border-slate-700">Cancelar</button>
              <button type="submit" disabled={guardando} className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60">
                {guardando ? 'Guardando…' : 'Guardar acceso'}
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}
