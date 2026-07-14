import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import type { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

const makeContext = (user: Partial<AuthenticatedUser> | undefined) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  }) as unknown as ExecutionContext;

describe('PermissionsGuard', () => {
  let reflector: Reflector;
  let guard: PermissionsGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new PermissionsGuard(reflector);
  });

  const mockRequired = (areas: string[] | undefined) =>
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(areas);

  it('deja pasar si el endpoint no exige áreas', () => {
    mockRequired(undefined);
    expect(guard.canActivate(makeContext({ permissions: [] }))).toBe(true);
  });

  it('deja pasar a un admin (wildcard *)', () => {
    mockRequired(['factoraje']);
    const ctx = makeContext({ permissions: ['*'] });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('deja pasar si el usuario tiene todas las áreas requeridas', () => {
    mockRequired(['finanzas', 'pagos']);
    const ctx = makeContext({ permissions: ['finanzas', 'pagos', 'estados'] });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('bloquea si le falta alguna área requerida', () => {
    mockRequired(['finanzas', 'factoraje']);
    const ctx = makeContext({ permissions: ['finanzas'] });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('bloquea si no hay usuario en el request', () => {
    mockRequired(['finanzas']);
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
