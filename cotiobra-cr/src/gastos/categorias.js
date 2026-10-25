// Catálogo de categorías de gasto real de una obra.
// Las clases de Tailwind van escritas completas (no interpoladas) para que el
// compilador las incluya sin necesidad de safelist.

export const CATEGORIA_OTROS = {
  id: 'otros',
  nombre: 'Otros gastos',
  icono: '📎',
  chip: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
  barra: 'bg-slate-400',
  pdf: [148, 163, 184],
};

export const CATEGORIAS = [
  {
    id: 'combustible',
    nombre: 'Combustible',
    icono: '⛽',
    chip: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    barra: 'bg-amber-400',
    pdf: [245, 158, 11],
  },
  {
    id: 'material',
    nombre: 'Compra de material',
    icono: '🧱',
    chip: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
    barra: 'bg-orange-400',
    pdf: [234, 88, 12],
  },
  {
    id: 'herramientas',
    nombre: 'Herramientas',
    icono: '🛠️',
    chip: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    barra: 'bg-sky-400',
    pdf: [14, 165, 233],
  },
  {
    id: 'viaticos',
    nombre: 'Viáticos',
    icono: '🍽️',
    chip: 'bg-lime-500/15 text-lime-300 border-lime-500/30',
    barra: 'bg-lime-400',
    pdf: [132, 204, 22],
  },
  {
    id: 'reparacion',
    nombre: 'Reparación de equipo',
    icono: '🔧',
    chip: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
    barra: 'bg-violet-400',
    pdf: [139, 92, 246],
  },
  {
    id: 'limpieza',
    nombre: 'Limpieza de materiales y escombros',
    icono: '🧹',
    chip: 'bg-teal-500/15 text-teal-300 border-teal-500/30',
    barra: 'bg-teal-400',
    pdf: [20, 184, 166],
  },
  {
    id: 'alquiler-maquinaria',
    nombre: 'Alquiler de maquinaria',
    icono: '🚜',
    chip: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
    barra: 'bg-yellow-400',
    pdf: [202, 138, 4],
  },
  {
    id: 'alquiler-transporte',
    nombre: 'Alquiler de medio de transporte',
    icono: '🚛',
    chip: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    barra: 'bg-indigo-400',
    pdf: [99, 102, 241],
  },
  CATEGORIA_OTROS,
];

export const categoriaPorId = (id) => CATEGORIAS.find((categoria) => categoria.id === id) ?? CATEGORIA_OTROS;

export const METODOS_PAGO = ['Efectivo', 'Transferencia', 'SINPE Móvil', 'Tarjeta', 'Crédito', 'Otro'];
