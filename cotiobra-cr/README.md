# CotiObra CR

Cotizador de obra (Costa Rica) hecho con React + Vite + Tailwind y Firebase
(Authentication + Firestore). Incluye dos módulos:

1. **Cotizador**: arma la oferta con materiales, mano de obra, equipos y
   subcontratos, calcula imprevistos, utilidad e IVA, guarda el historial en
   Firestore y exporta la proforma en PDF.
2. **Facturero de gastos reales**: registra las facturas de cada obra por
   proyecto, las clasifica (combustible, material, herramientas, viáticos,
   reparación de equipo, limpieza de escombros, alquiler de maquinaria y de
   transporte), controla el IVA del 13% de Hacienda y exporta CSV y PDF.

## Requisitos

- Node.js 20 o superior
- Un proyecto de Firebase con **Authentication (correo/contraseña)** y
  **Firestore** habilitados (`app-cotizador-obra`).

## Desarrollo

```bash
npm install        # instala dependencias
npm run dev        # servidor en http://localhost:5173
npm run lint       # ESLint
npm run build      # build de producción en dist/
npm run preview    # sirve el build en http://localhost:4173
```

## Publicar en Firebase Hosting

El `firebase.json` de la **raíz del repo** publica `cotiobra-cr/dist`, ejecuta el
build automáticamente antes de subir (predeploy) y apunta las reglas a
`firestore.rules`. El proyecto destino está en `.firebaserc`
(`app-cotizador-obra`).

### Primera vez

```bash
# 1) dependencias de la app (una sola vez)
npm --prefix cotiobra-cr install

# 2) instalar la CLI de Firebase (una sola vez)
npm install -g firebase-tools      # alternativa sin instalar: usar npx firebase-tools

# 3) iniciar sesión con la cuenta dueña del proyecto
firebase login
```

### Publicar

Desde la **raíz del repo** (donde está este `firebase.json`):

```bash
npm run deploy:hosting     # compila y publica la app
npm run deploy:rules       # publica las reglas de Firestore
npm run deploy:todo        # ambas cosas
npm run deploy             # todo lo configurado en firebase.json
```

Al terminar, la app queda en:

- https://app-cotizador-obra.web.app
- https://app-cotizador-obra.firebaseapp.com

> Si ejecutas `firebase deploy` desde `cotiobra-cr/` (la carpeta de la app) se
> usa el `firebase.json` interno, que publica su propio `dist/` pero **no**
> despliega reglas de Firestore.

### Despliegue desde GitHub (opcional)

Existe el workflow `.github/workflows/deploy-firebase.yml` (solo ejecución
manual). Para usarlo:

1. Genera una cuenta de servicio: consola de Firebase → **Configuración del
   proyecto → Cuentas de servicio → Generar nueva clave privada** (JSON).
2. En GitHub → **Settings → Secrets and variables → Actions → New repository
   secret**, nombre `FIREBASE_SERVICE_ACCOUNT`, valor: el JSON completo.
3. Pestaña **Actions → Deploy a Firebase → Run workflow**.

### Cuentas de usuario

La app no permite registro público: crea los usuarios en
**Authentication → Users** y habilita el método **Correo electrónico/contraseña**.

## Estructura

```
src/
  App.jsx             Pantalla principal: cotizador, gastos e historial
  Login.jsx           Inicio de sesión, "recordarme" y recuperar contraseña
  firebase.js         Inicialización de Firebase (auth y firestore)
  calculos.js         Subtotal, imprevistos, utilidad, IVA y armado de ítems
  formato.js          Montos (₡1.234.567), fechas (dd/mm/aaaa) y descargas
  generarProforma.js  Proforma en PDF con jsPDF + autoTable
  gastos/
    Gastos.jsx          Facturero: proyectos, tarjetas, IVA, tabla y filtros
    FormularioFactura.jsx  Alta/edición de facturas con IVA automático
    categorias.js       Catálogo de clasificaciones de gasto
    resumen.js          Normalización, validación, orden, filtros y totales
    reporteGastos.js    Reporte de gastos en PDF (jsPDF + autoTable)
firestore.rules       Reglas de seguridad de Firestore
```

### Notas de cálculo

- Costo directo = materiales + mano de obra + equipos + subcontratos.
- Imprevistos y utilidad se aplican sobre el costo directo.
- El IVA se aplica sobre el subtotal neto (costo directo + imprevistos + utilidad).
- La pantalla y el PDF usan la misma función (`calcularTotales`) para que las
  cifras nunca difieran.
- En el PDF los montos se muestran como `CRC 1.234.567`: la fuente estándar de
  jsPDF no incluye el glifo `₡`.

## Facturero de gastos reales

Cada obra (la construcción principal, la villa donde está el otro equipo, etc.)
es un **proyecto**. Cada factura se imputa a un proyecto, así los gastos y el
IVA quedan separados.

### Cómo se usa

1. Pestaña **Gastos** → **Nuevo proyecto** (nombre, ubicación, encargado).
2. **+ Registrar factura**: proyecto, fecha, número de factura, proveedor,
   clasificación, subtotal, IVA y total. El IVA y el total se calculan solos
   (13% por defecto) y se pueden ajustar a mano; con el botón
   *Aplicar 13% de Hacienda* se recalculan.
3. La tabla se puede ordenar por fecha, número, proveedor, clasificación,
   IVA o total, en orden ascendente o descendente (clic en el encabezado o con
   el selector *↑ Asc / ↓ Desc*), y filtrar por texto, clasificación y rango
   de fechas.
4. **Control de IVA para Hacienda**: desglose por tasa (13%, 0% u otras) con
   base imponible, IVA y total, más un aviso de facturas sin IVA registrado.
5. **Gasto por clasificación**: barras con el porcentaje de cada rubro.
6. **Comparativo por proyecto**: totales e IVA de todas las obras juntas.
7. Exportaciones: **CSV/Excel** (separador `;` y BOM UTF-8, listo para Excel en
   español) y **Reporte PDF** con resumen, IVA, clasificación y detalle.

### Datos en Firestore

- `proyectos/{id}`: `nombre`, `ubicacion`, `responsable`, `activo`, `creadoEn`.
- `facturas/{id}`: `proyectoId`, `fecha` (aaaa-mm-dd), `numeroFactura`,
  `proveedor`, `categoria`, `subtotal`, `tasaIva`, `impuesto`, `total`,
  `metodoPago`, `notas`, `creadoEn`/`actualizadoEn` y el correo del usuario.

Los importes se guardan en colones enteros (CRC no usa decimales en la
práctica). Recuerda publicar las reglas para que el facturero tenga permisos:

```bash
firebase deploy --only firestore:rules
```

### Clasificaciones disponibles

Combustible · Compra de material · Herramientas · Viáticos · Reparación de
equipo · Limpieza de materiales y escombros · Alquiler de maquinaria · Alquiler
de medio de transporte · Otros gastos.
