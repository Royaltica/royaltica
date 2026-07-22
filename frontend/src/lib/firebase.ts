import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  type AuthError,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);

/**
 * Login real de Royáltica: correo + contraseña contra Firebase Auth.
 * Devuelve el ID token que el backend valida en POST /auth/verify-token.
 * Traduce los códigos de error de Firebase a mensajes en español para la UI.
 */
export async function signInWithEmail(
  email: string,
  password: string,
): Promise<string> {
  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    return await credential.user.getIdToken();
  } catch (err) {
    const code = (err as AuthError)?.code;
    if (
      code === 'auth/invalid-credential' ||
      code === 'auth/wrong-password' ||
      code === 'auth/user-not-found'
    ) {
      throw new Error('Correo o contraseña incorrectos.');
    }
    if (code === 'auth/too-many-requests') {
      throw new Error('Demasiados intentos. Espera un momento y vuelve a intentar.');
    }
    if (code === 'auth/user-disabled') {
      throw new Error('Esta cuenta está deshabilitada. Contacta al administrador.');
    }
    throw new Error('No se pudo iniciar sesión. Intenta de nuevo.');
  }
}
