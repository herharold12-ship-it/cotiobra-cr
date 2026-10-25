// Control de acceso de la empresa.
// Nadie se registra solo: el administrador autoriza correos en `accesos` y,
// cuando esa persona entra por primera vez, se crea su perfil en `usuarios`.
// Las reglas de Firestore validan lo mismo del lado del servidor.

/** Correo del administrador raíz (dueño de la empresa). Siempre tiene acceso. */
export const CORREO_ADMIN_RAIZ = 'rhdrian12@gmail.com';

export const ROLES = [
  {
    id: 'admin',
    nombre: 'Administrador',
    descripcion: 'Todo: proyectos, facturas, planilla, cuentas, usuarios y reportes.',
    icono: '👑',
    chip: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
  {
    id: 'capturista',
    nombre: 'Capturista',
    descripcion: 'Registra facturas y planilla. No administra cuentas ni usuarios.',
    icono: '✍️',
    chip: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  },
  {
    id: 'lectura',
    nombre: 'Solo lectura',
    descripcion: 'Puede ver gastos y reportes, pero no modificar nada.',
    icono: '👀',
    chip: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  },
];

export const rolPorId = (id) => ROLES.find((rol) => rol.id === id) ?? ROLES[2];

export const normalizarEmail = (email = '') => email.toString().trim().toLowerCase();

export const esCorreoValido = (email = '') => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizarEmail(email));

/** Perfil efectivo: el admin raíz siempre es administrador activo. */
export const resolverPerfil = ({ uid, email, perfil, acceso }) => {
  const correo = normalizarEmail(email);

  if (correo === CORREO_ADMIN_RAIZ) {
    return { uid, email: correo, rol: 'admin', activo: true, raiz: true };
  }

  if (perfil) {
    return {
      uid,
      email: correo,
      nombre: perfil.nombre ?? '',
      rol: rolPorId(perfil.rol).id,
      activo: perfil.activo !== false,
      raiz: false,
    };
  }

  if (acceso && acceso.activo !== false) {
    return {
      uid,
      email: correo,
      nombre: acceso.nombre ?? '',
      rol: rolPorId(acceso.rol).id,
      activo: true,
      raiz: false,
      pendienteDeAlta: true,
    };
  }

  return { uid, email: correo, rol: 'lectura', activo: false, raiz: false, sinAcceso: true };
};

export const esAdmin = (perfil) => Boolean(perfil?.activo && perfil?.rol === 'admin');
export const puedeEscribir = (perfil) => Boolean(perfil?.activo && (perfil.rol === 'admin' || perfil.rol === 'capturista'));
