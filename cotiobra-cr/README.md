# CotiObra CR

Cotizador de obra (Costa Rica) hecho con React + Vite + Tailwind y Firebase
(Authentication + Firestore). Permite armar una cotización con materiales,
mano de obra, equipos y subcontratos, calcular imprevistos, utilidad e IVA,
guardar el historial en Firestore y exportar la proforma en PDF.

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

## Configuración de Firebase

La configuración web está en `src/firebase.js`. Para desplegar las reglas de
Firestore (solo usuarios autenticados pueden leer/escribir `cotizaciones`):

```bash
firebase login
firebase deploy --only firestore:rules
firebase deploy --only hosting
```

`firebase.json` publica la carpeta `dist/` de esta app y ejecuta `npm run build`
antes de cada deploy. Recuerda crear los usuarios en **Authentication → Users**:
la app no permite registro público, solo inicio de sesión.

## Estructura

```
src/
  App.jsx             Pantalla principal: cotizador e historial
  Login.jsx           Inicio de sesión, "recordarme" y recuperar contraseña
  firebase.js         Inicialización de Firebase (auth y firestore)
  calculos.js         Subtotal, imprevistos, utilidad, IVA y armado de ítems
  formato.js          Formato de montos (₡1.234.567) y fechas (dd/mm/aaaa)
  generarProforma.js  Proforma en PDF con jsPDF + autoTable
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
