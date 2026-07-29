import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldCheck, Loader2, Smartphone } from 'lucide-react';

const DEMO_2FA_CODE = '260626';

export function TwoFactorScreen({ onVerified, onCancel, userName, verifyCode }: { onVerified: () => void, onCancel: () => void, userName: string, verifyCode?: (code: string) => Promise<boolean> }) {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  // Si la cuenta tiene 2FA TOTP activo, el código se valida contra el backend;
  // si no, se acepta el código demo (hasta que el usuario active su 2FA real).
  const attempt = async (codeStr: string) => {
    const ok = verifyCode ? await verifyCode(codeStr) : await new Promise<boolean>(r => setTimeout(() => r(codeStr === DEMO_2FA_CODE), 600));
    if (ok) {
      onVerified();
    } else {
      setError('Código incorrecto. Intenta de nuevo.');
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      setIsVerifying(false);
    }
  };

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    setError('');
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
    if (newCode.every(d => d !== '') && newCode.join('').length === 6) {
      setIsVerifying(true);
      void attempt(newCode.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      const newCode = pasted.split('');
      setCode(newCode);
      inputRefs.current[5]?.focus();
      setIsVerifying(true);
      void attempt(pasted);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bone flex flex-col items-center justify-center p-8">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="max-w-sm w-full text-center space-y-8">
        <motion.div
          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="w-20 h-20 mx-auto bg-brand-ink rounded-full flex items-center justify-center shadow-2xl shadow-brand-ink/30"
        >
          <Smartphone size={32} className="text-brand-gold" />
        </motion.div>

        <div className="space-y-2">
          <h2 className="text-3xl text-brand-ink font-serif">Verificación 2FA</h2>
          <p className="text-sm text-brand-ink/50">Hola {userName.split(' ')[0]}, ingresa el código de 6 dígitos de tu app de autenticación</p>
        </div>

        <div className="editorial-card !bg-brand-cream shadow-2xl shadow-brand-sand/50 space-y-6">
          <div className="flex justify-center gap-3" onPaste={handlePaste}>
            {code.map((digit, i) => (
              <input
                key={i}
                ref={el => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                disabled={isVerifying}
                className={`w-12 h-14 text-center text-2xl font-serif bg-white border-2 rounded-xl focus:outline-none transition-all disabled:opacity-50 ${
                  error ? 'border-red-300 text-red-500' : digit ? 'border-brand-gold text-brand-ink' : 'border-brand-sand focus:border-brand-gold text-brand-ink'
                }`}
              />
            ))}
          </div>

          <AnimatePresence>
            {error && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[10px] text-red-500 font-bold uppercase tracking-widest">
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          {isVerifying && (
            <div className="flex items-center justify-center gap-2 text-brand-gold">
              <Loader2 size={16} className="animate-spin" />
              <span className="text-[10px] uppercase font-bold tracking-widest">Verificando...</span>
            </div>
          )}

          <div className="pt-4 border-t border-brand-sand space-y-3">
            <p className="text-[9px] text-brand-ink/40">
              <ShieldCheck size={10} className="inline mr-1 text-green-600" />
              Protegido con autenticación de dos factores (TOTP)
            </p>
            <button onClick={onCancel} className="text-[10px] text-brand-ink/40 hover:text-brand-ink font-bold uppercase tracking-widest transition-colors cursor-pointer">
              Cancelar y volver al login
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
