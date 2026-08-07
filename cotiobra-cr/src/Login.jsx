import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);

    try {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    } catch (err) {
      console.error("Error de Firebase Authentication:", err);
      // Muestra el código de error exacto de Firebase para diagnosticar si falla
      setError(`Error (${err.code}): ${err.message}`);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#0f172a', color: '#fff' }}>
      <form onSubmit={handleLogin} style={{ background: '#1e293b', padding: '30px', borderRadius: '8px', width: '320px', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}>
        <h2 style={{ marginBottom: '20px', textAlign: 'center', fontSize: '20px' }}>Acceso a CotiObra CR</h2>
        
        {error && (
          <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '15px', background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '4px', wordBreak: 'break-word', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            {error}
          </p>
        )}

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#94a3b8' }}>Correo electrónico</label>
          <input 
            type="email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required 
            placeholder="correo@ejemplo.com"
            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #475569', background: '#0f172a', color: '#fff', boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#94a3b8' }}>Contraseña</label>
          <input 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required 
            placeholder="••••••••"
            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #475569', background: '#0f172a', color: '#fff', boxSizing: 'border-box' }}
          />
        </div>

        <button 
          type="submit" 
          disabled={cargando}
          style={{ width: '100%', padding: '11px', background: cargando ? '#64748b' : '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: cargando ? 'not-allowed' : 'pointer' }}
        >
          {cargando ? 'Ingresando...' : 'Iniciar Sesión'}
        </button>
      </form>
    </div>
  );
}