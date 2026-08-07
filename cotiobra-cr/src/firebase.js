import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAbKzbf4OprYAgdsvdPHpeL_JdywgQ9a04",
  authDomain: "app-cotizador-obra.firebaseapp.com",
  databaseURL: "https://app-cotizador-obra-default-rtdb.firebaseio.com",
  projectId: "app-cotizador-obra",
  storageBucket: "app-cotizador-obra.firebasestorage.app",
  messagingSenderId: "693930533918",
  appId: "1:693930533918:web:e0ae8201440e1279853a0f",
  measurementId: "G-1HYEPR1WG5"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);

// Exporta las instancias de Auth y Firestore para usarlas en App.jsx y Login.jsx
export const auth = getAuth(app);
export const db = getFirestore(app);