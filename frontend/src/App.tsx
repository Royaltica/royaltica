import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { motion } from 'motion/react';
import { onAuthStateChanged, User as FirebaseUser, signOut } from 'firebase/auth';
import { auth, signInWithEmail, signInWithGoogle } from './lib/firebase.ts';
import { type Supplier } from './types.ts';
import { api } from './services/apiClient.ts';
import type { Role } from './utils/role.ts';
import { useInactivityLock } from './hooks/useInactivityLock.ts';
import { LandingPage } from './pages/LandingPage.tsx';
import { TwoFactorScreen } from './pages/auth/TwoFactorScreen.tsx';
import { LockScreen } from './pages/auth/LockScreen.tsx';
import { AdminDashboard } from './pages/admin/AdminDashboard.tsx';
import { CorporateDashboard } from './pages/corporate/CorporateDashboard.tsx';
import { ProviderDashboard } from './pages/provider/ProviderDashboard.tsx';
import { CustomerPortalPage } from './pages/customer-portal/CustomerPortalPage.tsx';

/**
 * Ruta pública SIN AUTH para el portal de autoservicio de clientes deudores
 * (Tradespace): tiene prioridad absoluta y bypassa por completo la lógica
 * interna de la app (auth, roles, 2FA, etc.), que sigue viviendo intacta en
 * `LegacyApp` como ruta catch-all "*". No se toca esa lógica.
 */
export default function App() {
  return (
    <Routes>
      <Route path="/portal-cliente/:token" element={<CustomerPortalPage />} />
      <Route path="*" element={<LegacyApp />} />
    </Routes>
  );
}

function LegacyApp() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<Role>(null);
  const [providerSupplier, setProviderSupplier] = useState<Supplier | null>(null);
  const [needs2FA, setNeeds2FA] = useState(false);
  // Token temporal del backend cuando la cuenta tiene 2FA TOTP activo.
  const [pendingTempToken, setPendingTempToken] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);
  const [sessionStartedAt] = useState(() => new Date());
  // Permisos/rol reales del JWT (para filtrar pestañas del portal corporativo).
  const [apiPermissions, setApiPermissions] = useState<string[]>([]);
  const [apiRole, setApiRole] = useState<string>('');

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const handleLock = React.useCallback(() => {
    if (user) setIsLocked(true);
  }, [user]);

  useInactivityLock(!!user && !isLocked && !needs2FA, handleLock);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-brand-paper">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
          className="w-12 h-12 border-2 border-brand-sand border-t-brand-ink rounded-full"
        />
      </div>
    );
  }

  // Login ÚNICO + ruteo por rol: Firebase valida la identidad (correo+contraseña
  // o Google), el backend canjea ese ID token por la sesión propia
  // (POST /auth/verify-token) y devuelve el ROL de la cuenta; la app manda al
  // portal correcto. El admin no se elige, se deduce de la cuenta (queda oculto
  // para los demás). Lanza si la cuenta no existe en el backend (invitation-only:
  // un correo real de Google que no esté invitado igual queda fuera), para que
  // la pantalla de login muestre el error.
  const finishLogin = async (idToken: string) => {
    const login = await api.verifyToken(idToken);
    const apiUser = login.user;
    // 2FA real: si la cuenta lo tiene activo, el backend NO emite sesión
    // hasta validar el código TOTP (pantalla de verificación).
    setPendingTempToken(login.twoFactorRequired ? login.tempToken : null);
    setApiPermissions(apiUser.permissions ?? []);
    setApiRole(apiUser.role);
    setUser({
      uid: apiUser.id,
      displayName: apiUser.name,
      email: apiUser.email,
      photoURL:
        apiUser.avatarUrl ||
        'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
    } as FirebaseUser);

    if (apiUser.role === 'PROVIDER') {
      // El proveedor entra directo a su portal (sin 2FA). Carga su perfil real.
      try {
        const supplier = await api.getProviderProfile();
        setProviderSupplier(supplier);
      } catch {
        /* si el perfil falla, el portal cae a datos de ejemplo */
      }
      setNeeds2FA(false);
      setRole('provider');
    } else if (apiUser.role === 'SUPERADMIN') {
      setRole('admin');
      // Solo se pide el segundo factor si la cuenta tiene 2FA TOTP activo.
      // Si no lo tiene, la sesión ya quedó emitida en devLogin y entra directo
      // (antes se mostraba siempre la pantalla y caía al código demo, lo que
      // hacía fallar el código real de la app autenticadora).
      setNeeds2FA(login.twoFactorRequired);
    } else {
      setRole('corporate');
      setNeeds2FA(login.twoFactorRequired);
    }
  };

  const handleLogin = async (email: string, password: string) => {
    const idToken = await signInWithEmail(email, password);
    await finishLogin(idToken);
  };

  // Alternativa a correo+contraseña: la identidad la confirma la cuenta real
  // de Google de la persona (sin contraseña propia que administrar o filtrar).
  // El filtro de acceso sigue siendo el mismo: si el correo de Google no está
  // invitado en el backend, finishLogin lanza igual que con contraseña.
  const handleGoogleLogin = async () => {
    const credential = await signInWithGoogle();
    const idToken = await credential.user.getIdToken();
    await finishLogin(idToken);
  };

  const handleUnlock = () => setIsLocked(false);

  // Cierra sesión y vuelve a la pantalla de login (ya no hay selección de rol).
  const handleLogout = () => {
    api.logout();
    signOut(auth);
    setUser(null);
    setRole(null);
    setProviderSupplier(null);
    setNeeds2FA(false);
    setIsLocked(false);
  };

  if (!user) {
    return <LandingPage onLogin={handleLogin} onGoogleLogin={handleGoogleLogin} />;
  }

  if (needs2FA) {
    return <TwoFactorScreen
      onVerified={() => { setNeeds2FA(false); setPendingTempToken(null); }}
      onCancel={handleLogout}
      userName={user.displayName || ''}
      verifyCode={pendingTempToken ? async (code: string) => {
        try { await api.complete2fa(pendingTempToken, code); return true; } catch { return false; }
      } : undefined}
    />;
  }

  if (isLocked) {
    return <LockScreen user={user} onUnlock={handleUnlock} onLogout={handleLogout} />;
  }

  if (role === 'provider' && providerSupplier) {
    return <ProviderDashboard user={user} supplier={providerSupplier} onLogout={handleLogout} onBackToRole={handleLogout} />;
  }

  if (role === 'admin') {
    return <AdminDashboard user={user} onLogout={handleLogout} onBackToRole={handleLogout} />;
  }

  if (role === 'corporate') {
    return <CorporateDashboard user={user} onLogout={handleLogout} onBackToRole={handleLogout} sessionStartedAt={sessionStartedAt} permissions={apiPermissions} role={apiRole} />;
  }

  // Fallback de seguridad: sin rol resuelto, de vuelta al login.
  return <LandingPage onLogin={handleLogin} onGoogleLogin={handleGoogleLogin} />;
}
