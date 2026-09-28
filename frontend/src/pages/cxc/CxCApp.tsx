import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { onAuthStateChanged, User as FirebaseUser, signOut } from 'firebase/auth';
import { auth, signInWithEmail, signInWithGoogle } from '../../lib/firebase.ts';
import { api } from '../../services/apiClient.ts';
import { useInactivityLock } from '../../hooks/useInactivityLock.ts';
import { LandingPage } from '../LandingPage.tsx';
import { TwoFactorScreen } from '../auth/TwoFactorScreen.tsx';
import { LockScreen } from '../auth/LockScreen.tsx';
import { CxCDashboard } from './CxCDashboard.tsx';

/**
 * Entrada propia del producto de Cobranza IA (montada en /cxc — ver App.tsx).
 * Comparte el mismo Firebase Auth + backend (POST /auth/verify-token, 2FA)
 * que el resto de la app, pero SIN el switch de roles de `LegacyApp`: aquí no
 * hay "corporativo / proveedor / admin" ni lectura de permisos para decidir
 * a dónde mandar a alguien. Quien entra por /cxc, al autenticarse, ve
 * directo CxCDashboard (única vista: Cobranza IA). No es un redirect
 * post-login — es el único destino que existe en esta rama de la app.
 */
export function CxCApp() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [needs2FA, setNeeds2FA] = useState(false);
  const [pendingTempToken, setPendingTempToken] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  // Evita que el listener de Firebase (que también se dispara DESPUÉS de
  // handleLogin/handleGoogleLogin) vuelva a canjear el token una segunda vez:
  // solo hace el canje automático la primera vez que corre, es decir, cuando
  // detecta una sesión de Firebase ya persistida de una visita anterior.
  const didInitialCheck = useRef(false);

  // Mismo canje de identidad que el login normal (Firebase → backend →
  // sesión propia). Si la cuenta no existe en el backend, lanza igual que en
  // LegacyApp y la pantalla de login muestra el error.
  const finishLogin = React.useCallback(async (idToken: string) => {
    const login = await api.verifyToken(idToken);
    const apiUser = login.user;
    setPendingTempToken(login.twoFactorRequired ? login.tempToken : null);
    setNeeds2FA(login.twoFactorRequired);
    setUser({
      uid: apiUser.id,
      displayName: apiUser.name,
      email: apiUser.email,
      photoURL:
        apiUser.avatarUrl ||
        'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
    } as FirebaseUser);
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      if (didInitialCheck.current) return;
      didInitialCheck.current = true;

      if (!u) {
        setLoading(false);
        return;
      }
      // BUG que reportó Paolo ("no puedo entrar"): si ya había una sesión de
      // Firebase persistida (por ejemplo, de haber entrado antes a la app
      // normal en este mismo navegador), este listener la detectaba y
      // mostraba el dashboard directo, SIN canjearla contra el backend — es
      // decir, sin JWT propio de Royáltica y sin pasar por 2FA si la cuenta
      // lo tiene activo. El resultado era una pantalla que no podía cargar
      // ningún dato (y un hueco de seguridad: 2FA saltado). Ahora siempre se
      // hace el canje real antes de mostrar nada.
      try {
        const idToken = await u.getIdToken();
        await finishLogin(idToken);
      } catch {
        // Sesión de Firebase inválida o cuenta no invitada en el backend:
        // se cierra por completo para no dejar un estado a medias.
        await signOut(auth).catch(() => {});
      }
      setLoading(false);
    });
  }, [finishLogin]);

  const handleLock = React.useCallback(() => {
    if (user) setIsLocked(true);
  }, [user]);

  useInactivityLock(!!user && !isLocked && !needs2FA, handleLock);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-brand-paper">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
          className="w-12 h-12 border-2 border-brand-sand border-t-brand-ink rounded-full"
        />
      </div>
    );
  }

  const handleLogin = async (email: string, password: string) => {
    const idToken = await signInWithEmail(email, password);
    await finishLogin(idToken);
  };

  const handleGoogleLogin = async () => {
    const credential = await signInWithGoogle();
    const idToken = await credential.user.getIdToken();
    await finishLogin(idToken);
  };

  const handleUnlock = () => setIsLocked(false);

  const handleLogout = () => {
    api.logout();
    signOut(auth);
    setUser(null);
    setNeeds2FA(false);
    setIsLocked(false);
  };

  if (!user) {
    return <LandingPage onLogin={handleLogin} onGoogleLogin={handleGoogleLogin} />;
  }

  if (needs2FA) {
    return (
      <TwoFactorScreen
        onVerified={() => { setNeeds2FA(false); setPendingTempToken(null); }}
        onCancel={handleLogout}
        userName={user.displayName || ''}
        verifyCode={pendingTempToken ? async (code: string) => {
          try { await api.complete2fa(pendingTempToken, code); return true; } catch { return false; }
        } : undefined}
      />
    );
  }

  if (isLocked) {
    return <LockScreen user={user} onUnlock={handleUnlock} onLogout={handleLogout} />;
  }

  return <CxCDashboard user={user} onLogout={handleLogout} onBackToRole={handleLogout} />;
}
