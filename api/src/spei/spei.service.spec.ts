import { SpeiService } from './spei.service';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.validation';

const makeConfig = (vals: Record<string, string>) =>
  ({ get: (k: string) => vals[k] ?? '' }) as unknown as ConfigService<Env, true>;

describe('SpeiService', () => {
  it('stub mode devuelve success con clave rastreo simulada', async () => {
    const svc = new SpeiService(makeConfig({}));
    svc.onModuleInit();
    expect(svc.isConfigured).toBe(false);
    const r = await svc.order({ clabeDestino: '012345678901234567', nombreBeneficiario: 'Test', monto: 1000, concepto: 'Pago', referenciaNumerica: 1234567 });
    expect(r.success).toBe(true);
    expect(r.mode).toBe('stub');
    expect(r.claveRastreo).toMatch(/^RYL/);
  });

  it('getStatus stub devuelve LIQUIDATED', async () => {
    const svc = new SpeiService(makeConfig({}));
    svc.onModuleInit();
    const r = await svc.getStatus('RYLTEST001');
    expect(r.status).toBe('LIQUIDATED');
  });

  it('rechaza CLABE con longitud incorrecta', async () => {
    const svc = new SpeiService(makeConfig({}));
    svc.onModuleInit();
    await expect(svc.order({ clabeDestino: '12345', nombreBeneficiario: 'T', monto: 100, concepto: 'T', referenciaNumerica: 1234567 })).rejects.toThrow('CLABE');
  });

  it('isConfigured true con API key y CLABE', () => {
    const svc = new SpeiService(makeConfig({ SPEI_API_KEY: 'key_test', SPEI_CLABE_ORIGEN: '012345678901234567' }));
    svc.onModuleInit();
    expect(svc.isConfigured).toBe(true);
  });
});
