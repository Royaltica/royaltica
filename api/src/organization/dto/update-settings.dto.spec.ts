import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateSettingsDto } from './update-settings.dto';

const validationOptions = { whitelist: true, forbidNonWhitelisted: true };

describe('Configuración de cobranza (DTO)', () => {
  it('acepta parches parciales de seguridad y reglas', async () => {
    const dto = plainToInstance(UpdateSettingsDto, { collectionSecurity: { dosPasos: true }, collectionRules: { descuentoMax: 10, aprueba: 'supervisor' } });
    expect(await validate(dto, validationOptions)).toEqual([]);
  });

  it.each([
    { collectionSecurity: { dosPasos: 'sí' } },
    { collectionRules: { descuentoMax: 31 } },
    { collectionRules: { aprueba: 'agente' } },
    { collectionRules: { dias: [true] } },
    { collectionRules: { maxSemana: 4 } },
    { collectionRules: { hora: '10:00' } },
  ])('rechaza valores inválidos o campos que pertenecen a la política (%j)', async (patch) => {
    expect(await validate(plainToInstance(UpdateSettingsDto, patch), validationOptions)).not.toHaveLength(0);
  });
});
