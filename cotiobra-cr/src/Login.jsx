import { useState } from 'react';
import {
  browserLocalPersistence,
  browserSessionPersistence,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { auth } from './firebase.js';

const MENSAJES_ERROR = {
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/invalid-email': 'El correo electrónico no es válido.',
  'auth/user-disabled': 'Esta cuenta está deshabilitada.',
  'auth/user-not-found': 'No existe una cuenta con ese correo.',
  'auth/wrong-password': 'La contraseña es incorrecta.',
  'auth/too-many-requests': 'Demasiados intentos fallidos. Espera unos minutos e inténtalo de nuevo.',
  'auth/network-request-failed': 'Sin conexión. Revisa tu internet e inténtalo otra vez.',
  'auth/operation-not-allowed': 'El inicio de sesión con correo y contraseña está deshabilitado en Firebase.',
};

const mensajeDeError = (error) =>
  MENSAJES_ERROR[error?.code] ?? `No se pudo iniciar sesión (${error?.code ?? 'error desconocido'}).`;

const estiloCampo = {
  width: '100%',
  padding: '10px',
  borderRadius: '6px',
  border: '1px solid #475569',
  background: '#0f172a',
  color: '#fff',
  boxSizing: 'border-box',
};

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [recordarme, setRecordarme] = useState(false);
  const [verPassword, setVerPassword] = useState(false);
  const [error, setError] = useState('');
  const [informacion, setInformacion] = useState('');
  const [cargando, setCargando] = useState(false);

  const handleLogin = async (evento) => {
    evento.preventDefault();
    setError('');
    setInformacion('');
    setCargando(true);

    try {
      // La sesión se recuerda solo si el usuario lo pide explícitamente.
      await setPersistence(auth, recordarme ? browserLocalPersistence : browserSessionPersistence);
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // Al cambiar el estado de autenticación, App muestra el cotizador.
    } catch (err) {
      console.error('Error de Firebase Authentication:', err);
      setError(mensajeDeError(err));
    } finally {
      setCargando(false);
    }
  };

  const handleRecuperarContrasena = async () => {
    setError('');
    setInformacion('');

    if (!email.trim()) {
      setError('Escribe tu correo electrónico para enviarte el enlace de recuperación.');
      return;
    }

    try {
      setCargando(true);
      await sendPasswordResetEmail(auth, email.trim());
      setInformacion('Te enviamos un correo con las instrucciones para restablecer la contraseña.');
    } catch (err) {
      console.error('Error enviando el correo de recuperación:', err);
      setError(mensajeDeError(err));
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', padding: '16px', backgroundColor: '#0f172a', color: '#fff' }}>
      <form onSubmit={handleLogin} style={{ background: '#1e293b', padding: '30px', borderRadius: '10px', width: '100%', maxWidth: '360px', boxShadow: '0 10px 25px rgba(0,0,0,0.35)' }}>
        <h1 style={{ margin: '0 0 6px', textAlign: 'center', fontSize: '20px' }}>👷 CotiObra CR</h1>
        <p style={{ margin: '0 0 20px', textAlign: 'center', fontSize: '13px', color: '#94a3b8' }}>
          Inicia sesión para gestionar tus cotizaciones
        </p>

        {error && (
          <p role="alert" style={{ color: '#fca5a5', fontSize: '13px', margin: '0 0 15px', background: 'rgba(239, 68, 68, 0.12)', padding: '10px', borderRadius: '6px', wordBreak: 'break-word', border: '1px solid rgba(239, 68, 68, 0.35)' }}>
            {error}
          </p>
        )}

        {informacion && (
          <p role="status" style={{ color: '#86efac', fontSize: '13px', margin: '0 0 15px', background: 'rgba(34, 197, 94, 0.12)', padding: '10px', borderRadius: '6px', wordBreak: 'break-word', border: '1px solid rgba(34, 197, 94, 0.35)' }}>
            {informacion}
          </p>
        )}

        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="login-email" style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#94a3b8' }}>
            Correo electrónico
          </label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(evento) => setEmail(evento.target.value)}
            required
            autoComplete="username"
            placeholder="correo@ejemplo.com"
            style={estiloCampo}
          />
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label htmlFor="login-password" style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#94a3b8' }}>
            Contraseña
          </label>
          <div style={{ position: 'relative' }}>
            <input
              id="login-password"
              type={verPassword ? 'text' : 'password'}
              value={password}
              onChange={(evento) => setPassword(evento.target.value)}
              required
              autoComplete="current-password"
              placeholder="••••••••"
              style={{ ...estiloCampo, paddingRight: '58px' }}
            />
            <button
              type="button"
              onClick={() => setVerPassword((valor) => !valor)}
              style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: '#93c5fd', fontSize: '12px', cursor: 'pointer', padding: '6px' }}
            >
              {verPassword ? 'Ocultar' : 'Ver'}
            </button>
          </div>
        </div>

        <label htmlFor="login-recordarme" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', fontSize: '13px', color: '#cbd5e1', cursor: 'pointer' }}>
          <input
            id="login-recordarme"
            type="checkbox"
            checked={recordarme}
            onChange={(evento) => setRecordarme(evento.target.checked)}
            style={{ width: '16px', height: '16px', accentColor: '#2563eb' }}
          />
          Mantener la sesión en este dispositivo
        </label>

        <button
          type="submit"
          disabled={cargando}
          style={{ width: '100%', padding: '11px', background: cargando ? '#64748b' : '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: cargando ? 'not-allowed' : 'pointer' }}
        >
          {cargando ? 'Ingresando...' : 'Iniciar Sesión'}
        </button>

        <button
          type="button"
          onClick={handleRecuperarContrasena}
          disabled={cargando}
          style={{ width: '100%', marginTop: '12px', background: 'transparent', border: 'none', color: '#93c5fd', fontSize: '12px', cursor: cargando ? 'not-allowed' : 'pointer' }}
        >
          ¿Olvidaste tu contraseña?
        </button>
      </form>
    </div>
  );
}
