// Catálogo de categorías de gasto real de una obra.
// Las clases de Tailwind van escritas completas (no interpoladas) para que el
// compilador las incluya sin necesidad de safelist.
// Los `id` son estables: se guardan en Firestore, así que no se deben renombrar.

export const CATEGORIA_OTROS = {
  id: 'otros',
  nombre: 'Otros gastos',
  grupo: 'Otros',
  icono: '📎',
  chip: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  barra: 'bg-slate-400',
  pdf: [148, 163, 184],
};

export const GRUPOS = [
  'Construcción',
  'Eléctrico y electrónico',
  'Herramientas y equipo',
  'Operación y transporte',
  'Personal y administración',
  'Otros',
];

export const CATEGORIAS = [
  // --- Construcción ---
  {
    id: 'material-construccion',
    nombre: 'Material de construcción',
    grupo: 'Construcción',
    icono: '🧱',
    chip: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
    barra: 'bg-orange-400',
    pdf: [234, 88, 12],
  },
  {
    id: 'material',
    nombre: 'Material (otros)',
    grupo: 'Construcción',
    icono: '📦',
    chip: 'bg-stone-500/15 text-stone-300 border-stone-500/30',
    barra: 'bg-stone-400',
    pdf: [120, 113, 108],
  },
  {
    id: 'block-cemento',
    nombre: 'Block, cemento y agregados',
    grupo: 'Construcción',
    icono: '🏗️',
    chip: 'bg-amber-700/15 text-amber-400 border-amber-700/30',
    barra: 'bg-amber-600',
    pdf: [180, 83, 9],
  },
  {
    id: 'hierro',
    nombre: 'Hierro y soldadura',
    grupo: 'Construcción',
    icono: '⚙️',
    chip: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
    barra: 'bg-zinc-400',
    pdf: [113, 113, 122],
  },
  {
    id: 'madera',
    nombre: 'Madera y formaleta',
    grupo: 'Construcción',
    icono: '🪵',
    chip: 'bg-yellow-700/15 text-yellow-500 border-yellow-700/30',
    barra: 'bg-yellow-600',
    pdf: [161, 98, 7],
  },
  {
    id: 'pintura',
    nombre: 'Pintura y acabados',
    grupo: 'Construcción',
    icono: '🎨',
    chip: 'bg-pink-500/15 text-pink-300 border-pink-500/30',
    barra: 'bg-pink-400',
    pdf: [236, 72, 153],
  },
  {
    id: 'ceramica',
    nombre: 'Cerámica y porcelanato',
    grupo: 'Construcción',
    icono: '🧿',
    chip: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    barra: 'bg-blue-400',
    pdf: [59, 130, 246],
  },
  {
    id: 'plomeria',
    nombre: 'Plomería y sanitarios',
    grupo: 'Construcción',
    icono: '🚿',
    chip: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    barra: 'bg-cyan-400',
    pdf: [6, 182, 212],
  },

  // --- Eléctrico y electrónico ---
  {
    id: 'material-electrico',
    nombre: 'Material eléctrico',
    grupo: 'Eléctrico y electrónico',
    icono: '⚡',
    chip: 'bg-yellow-400/15 text-yellow-200 border-yellow-400/30',
    barra: 'bg-yellow-300',
    pdf: [250, 204, 21],
  },
  {
    id: 'material-electronico',
    nombre: 'Material electrónico',
    grupo: 'Eléctrico y electrónico',
    icono: '🔌',
    chip: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30',
    barra: 'bg-fuchsia-400',
    pdf: [217, 70, 239],
  },
  {
    id: 'iluminacion',
    nombre: 'Iluminación',
    grupo: 'Eléctrico y electrónico',
    icono: '💡',
    chip: 'bg-amber-300/15 text-amber-100 border-amber-300/30',
    barra: 'bg-amber-200',
    pdf: [252, 211, 77],
  },
  {
    id: 'herramientas-electricas',
    nombre: 'Herramientas eléctricas',
    grupo: 'Eléctrico y electrónico',
    icono: '🔋',
    chip: 'bg-sky-400/15 text-sky-200 border-sky-400/30',
    barra: 'bg-sky-300',
    pdf: [56, 189, 248],
  },

  // --- Herramientas y equipo ---
  {
    id: 'herramientas',
    nombre: 'Herramientas',
    grupo: 'Herramientas y equipo',
    icono: '🛠️',
    chip: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    barra: 'bg-sky-400',
    pdf: [14, 165, 233],
  },
  {
    id: 'herramienta-menor',
    nombre: 'Herramienta menor y consumibles',
    grupo: 'Herramientas y equipo',
    icono: '🔩',
    chip: 'bg-slate-400/15 text-slate-200 border-slate-400/30',
    barra: 'bg-slate-300',
    pdf: [148, 163, 184],
  },
  {
    id: 'reparacion',
    nombre: 'Reparación de equipo',
    grupo: 'Herramientas y equipo',
    icono: '🔧',
    chip: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    barra: 'bg-violet-400',
    pdf: [139, 92, 246],
  },
  {
    id: 'alquiler-maquinaria',
    nombre: 'Alquiler de maquinaria',
    grupo: 'Herramientas y equipo',
    icono: '🚜',
    chip: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
    barra: 'bg-yellow-400',
    pdf: [202, 138, 4],
  },
  {
    id: 'seguridad',
    nombre: 'Seguridad y equipo de protección',
    grupo: 'Herramientas y equipo',
    icono: '🦺',
    chip: 'bg-orange-400/15 text-orange-200 border-orange-400/30',
    barra: 'bg-orange-300',
    pdf: [251, 146, 60],
  },

  // --- Operación y transporte ---
  {
    id: 'combustible',
    nombre: 'Combustible',
    grupo: 'Operación y transporte',
    icono: '⛽',
    chip: 'bg-red-500/15 text-red-300 border-red-500/30',
    barra: 'bg-red-400',
    pdf: [239, 68, 68],
  },
  {
    id: 'alquiler-transporte',
    nombre: 'Alquiler de medio de transporte',
    grupo: 'Operación y transporte',
    icono: '🚛',
    chip: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    barra: 'bg-indigo-400',
    pdf: [99, 102, 241],
  },
  {
    id: 'flete',
    nombre: 'Transporte de materiales',
    grupo: 'Operación y transporte',
    icono: '🚚',
    chip: 'bg-lime-600/15 text-lime-300 border-lime-600/30',
    barra: 'bg-lime-500',
    pdf: [101, 163, 13],
  },
  {
    id: 'peajes',
    nombre: 'Peajes y parqueos',
    grupo: 'Operación y transporte',
    icono: '🛣️',
    chip: 'bg-emerald-600/15 text-emerald-300 border-emerald-600/30',
    barra: 'bg-emerald-500',
    pdf: [5, 150, 105],
  },
  {
    id: 'viaticos',
    nombre: 'Viáticos',
    grupo: 'Operación y transporte',
    icono: '🍽️',
    chip: 'bg-lime-500/15 text-lime-300 border-lime-500/30',
    barra: 'bg-lime-400',
    pdf: [132, 204, 22],
  },
  {
    id: 'limpieza',
    nombre: 'Limpieza de materiales y escombros',
    grupo: 'Operación y transporte',
    icono: '🧹',
    chip: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
    barra: 'bg-teal-400',
    pdf: [20, 184, 166],
  },
  {
    id: 'servicios-publicos',
    nombre: 'Servicios públicos de obra',
    grupo: 'Operación y transporte',
    icono: '💧',
    chip: 'bg-cyan-400/15 text-cyan-200 border-cyan-400/30',
    barra: 'bg-cyan-300',
    pdf: [34, 211, 238],
  },

  // --- Personal y administración ---
  {
    id: 'planilla',
    nombre: 'Planilla y jornales',
    grupo: 'Personal y administración',
    icono: '👷',
    chip: 'bg-green-500/15 text-green-300 border-green-500/30',
    barra: 'bg-green-400',
    pdf: [34, 197, 94],
  },
  {
    id: 'subcontrato',
    nombre: 'Subcontratos y servicios',
    grupo: 'Personal y administración',
    icono: '🤝',
    chip: 'bg-teal-400/15 text-teal-200 border-teal-400/30',
    barra: 'bg-teal-300',
    pdf: [45, 212, 191],
  },
  {
    id: 'servicios',
    nombre: 'Servicios profesionales',
    grupo: 'Personal y administración',
    icono: '📐',
    chip: 'bg-blue-400/15 text-blue-200 border-blue-400/30',
    barra: 'bg-blue-300',
    pdf: [96, 165, 250],
  },
  {
    id: 'permisos',
    nombre: 'Permisos y trámites',
    grupo: 'Personal y administración',
    icono: '📄',
    chip: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    barra: 'bg-purple-400',
    pdf: [168, 85, 247],
  },
  {
    id: 'seguros',
    nombre: 'Seguros y pólizas',
    grupo: 'Personal y administración',
    icono: '🛡️',
    chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    barra: 'bg-emerald-400',
    pdf: [16, 185, 129],
  },
  {
    id: 'oficina',
    nombre: 'Oficina y papelería',
    grupo: 'Personal y administración',
    icono: '🗂️',
    chip: 'bg-slate-300/15 text-slate-200 border-slate-300/30',
    barra: 'bg-slate-200',
    pdf: [203, 213, 225],
  },

  CATEGORIA_OTROS,
];

/** Categorías agrupadas para pintar el selector del formulario. */
export const CATEGORIAS_POR_GRUPO = GRUPOS
  .map((grupo) => ({
    grupo,
    categorias: CATEGORIAS.filter((categoria) => categoria.grupo === grupo),
  }))
  .filter((bloque) => bloque.categorias.length > 0);

export const categoriaPorId = (id) => CATEGORIAS.find((categoria) => categoria.id === id) ?? CATEGORIA_OTROS;

export const METODOS_PAGO = ['Efectivo', 'Transferencia', 'SINPE Móvil', 'Tarjeta', 'Crédito', 'Otro'];

/** Tipos de cuenta/caja con los que se paga un gasto. */
export const TIPOS_CUENTA = [
  { id: 'efectivo', nombre: 'Efectivo / caja chica', icono: '💵' },
  { id: 'banco', nombre: 'Cuenta bancaria', icono: '🏦' },
  { id: 'tarjeta', nombre: 'Tarjeta', icono: '💳' },
  { id: 'personal', nombre: 'Cuenta personal (se reembolsa)', icono: '👤' },
  { id: 'otro', nombre: 'Otra', icono: '📁' },
];

export const tipoCuentaPorId = (id) => TIPOS_CUENTA.find((tipo) => tipo.id === id) ?? TIPOS_CUENTA[4];
