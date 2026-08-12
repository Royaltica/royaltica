import { afterEach, describe, expect, it } from 'vitest';
import { clearToken, getToken, isRealId, setToken } from './apiClient';

describe('isRealId', () => {
  it('acepta un UUID real del backend', () => {
    expect(isRealId('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(true);
  });

  it('rechaza los ids de mock tipo "FAC-01-P1"', () => {
    expect(isRealId('FAC-01-P1')).toBe(false);
  });

  it('rechaza strings vacíos o basura', () => {
    expect(isRealId('')).toBe(false);
    expect(isRealId('no-es-un-uuid')).toBe(false);
  });
});

describe('sesión (JWT en localStorage)', () => {
  afterEach(() => {
    clearToken();
  });

  it('guarda y recupera el token', () => {
    setToken('un-jwt-de-prueba');
    expect(getToken()).toBe('un-jwt-de-prueba');
  });

  it('clearToken borra la sesión', () => {
    setToken('un-jwt-de-prueba');
    clearToken();
    expect(getToken()).toBeNull();
  });
});
