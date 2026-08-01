import { useEffect, useState } from 'react';
import { api } from '../services/apiClient';

/**
 * White label (Tradespace): marca efectiva del tenant actual, con fallback
 * al look por defecto de Royáltica cuando la org no configuró branding
 * propio (brandDisplayName/brandLogoUrl/brandPrimaryColor/brandAccentColor
 * nulos).
 */
export interface OrgBranding {
  /** "Royáltica" salvo que la org tenga brandDisplayName propio. */
  displayName: string;
  /** null = usa el logo/wordmark por defecto de Royáltica. */
  logoUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  /** true una vez que se resolvió la llamada (éxito o fallback). */
  loaded: boolean;
}

const DEFAULT_DISPLAY_NAME = 'Royáltica';

const DEFAULT_BRANDING: OrgBranding = {
  displayName: DEFAULT_DISPLAY_NAME,
  logoUrl: null,
  primaryColor: null,
  accentColor: null,
  loaded: false,
};

/**
 * Lee el branding del tenant reutilizando GET /organization/settings (no
 * agrega un round-trip nuevo: varias pantallas ya llaman api.getSettings()
 * para locale/currency). Aplica los colores de marca como CSS custom
 * properties en `document.documentElement` para que las clases Tailwind
 * existentes (`bg-brand-gold`, `text-brand-ink`, etc.) los recojan sin
 * tener que tocar componente por componente: Tailwind v4 define la paleta
 * con `@theme` en :root (ver index.css), y una propiedad inline en
 * documentElement tiene mayor especificidad que esa regla de hoja de
 * estilo, así que el override funciona en runtime sin rebuild.
 */
export function useOrgBranding(): OrgBranding {
  const [branding, setBranding] = useState<OrgBranding>(DEFAULT_BRANDING);

  useEffect(() => {
    let cancelled = false;
    api.getSettings()
      .then(s => {
        if (cancelled) return;
        const next: OrgBranding = {
          displayName: s.brandDisplayName?.trim() || DEFAULT_DISPLAY_NAME,
          logoUrl: s.brandLogoUrl ?? null,
          primaryColor: s.brandPrimaryColor ?? null,
          accentColor: s.brandAccentColor ?? null,
          loaded: true,
        };
        setBranding(next);
        applyBrandColors(next);
      })
      .catch(() => {
        if (!cancelled) setBranding({ ...DEFAULT_BRANDING, loaded: true });
      });
    return () => { cancelled = true; };
  }, []);

  return branding;
}

/** Sobreescribe las variables de tema de marca en :root (solo si vienen). */
function applyBrandColors(branding: OrgBranding): void {
  const root = document.documentElement.style;
  if (branding.primaryColor) root.setProperty('--color-brand-ink', branding.primaryColor);
  if (branding.accentColor) root.setProperty('--color-brand-gold', branding.accentColor);
}
