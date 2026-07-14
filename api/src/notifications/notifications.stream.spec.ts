import { firstValueFrom } from 'rxjs';
import { filter, take } from 'rxjs/operators';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../common/prisma/prisma.service';

describe('NotificationsService — stream SSE', () => {
  let service: NotificationsService;
  let prisma: { notification: { create: jest.Mock } };

  beforeEach(() => {
    prisma = {
      notification: {
        create: jest.fn((args: { data: { userId: string } }) =>
          Promise.resolve({ id: 'n-1', ...args.data }),
        ),
      },
    };
    service = new NotificationsService(prisma as unknown as PrismaService);
  });

  it('streamFor emite la notificación creada para ESE usuario', async () => {
    // Nos suscribimos al stream del usuario y filtramos el heartbeat.
    const received = firstValueFrom(
      service
        .streamFor('user-1')
        .pipe(filter((e) => e.type === 'notification'), take(1)),
    );

    await service.create({
      userId: 'user-1',
      type: 'TEST',
      title: 'Hola',
      body: 'cuerpo',
    });

    const event = await received;
    expect(event.type).toBe('notification');
    expect((event.data as { userId: string }).userId).toBe('user-1');
  });

  it('un usuario NO recibe notificaciones de otro usuario', async () => {
    const events: unknown[] = [];
    const sub = service
      .streamFor('user-1')
      .pipe(filter((e) => e.type === 'notification'))
      .subscribe((e) => events.push(e));

    await service.create({
      userId: 'user-2',
      type: 'TEST',
      title: 'Para otro',
      body: 'x',
    });

    // Da una vuelta del event loop para que cualquier emisión llegue.
    await new Promise((r) => setImmediate(r));
    sub.unsubscribe();
    expect(events).toHaveLength(0);
  });
});
