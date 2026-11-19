import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { DEFAULT_COLLECTION_COMPANY, DEFAULT_COLLECTION_NOTIFICATIONS } from '../../settings/collection-workspace';
import { UpdateSettingsDto } from './update-settings.dto';

const validationOptions = { whitelist: true, forbidNonWhitelisted: true };

describe('Configuración de cobranza (DTO)', () => {
  it('valida empresa y preferencias completas y conserva el contenido con whitelist', async () => {
    const dto = plainToInstance(UpdateSettingsDto, { collectionCompany: DEFAULT_COLLECTION_COMPANY, collectionNotifications: DEFAULT_COLLECTION_NOTIFICATIONS });
    expect(await validate(dto, validationOptions)).toEqual([]);
    expect(dto.collectionNotifications).toEqual(DEFAULT_COLLECTION_NOTIFICATIONS);
  });

  it('acepta parches parciales de seguridad y reglas', async () => {
    const dto = plainToInstance(UpdateSettingsDto, { collectionSecurity: { dosPasos: true }, collectionRules: { descuentoMax: 10, aprueba: 'supervisor' } });
    expect(await validate(dto, validationOptions)).toEqual([]);
  });

  it.each([
    { collectionSecurity: { dosPasos: 'sí' } },
    { collectionCompany: { ...DEFAULT_COLLECTION_COMPANY, clabe: '123' } },
    { collectionNotifications: { ...DEFAULT_COLLECTION_NOTIFICATIONS, resumenHora: '99:99' } },
    { collectionNotifications: { ...DEFAULT_COLLECTION_NOTIFICATIONS, desconocido: true } },
    { collectionUserState: {} },
    { collectionRules: { descuentoMax: 31 } },
    { collectionRules: { aprueba: 'agente' } },
    { collectionRules: { dias: [true] } },
    { collectionRules: { maxSemana: 4 } },
    { collectionRules: { hora: '10:00' } },
  ])('rechaza valores inválidos o campos que pertenecen a la política (%j)', async (patch) => {
    expect(await validate(plainToInstance(UpdateSettingsDto, patch), validationOptions)).not.toHaveLength(0);
  });
});
