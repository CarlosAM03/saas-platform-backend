import { JobMemoryService } from './job-memory.service';

describe('Temporary job memory', () => {
  afterEach(() => jest.restoreAllMocks());
  it('expires results after TTL and returns isolated copies', () => {
    const memory = new JobMemoryService();
    const time = jest.spyOn(Date, 'now').mockReturnValue(1000);
    memory.set('a', {
      sequence: 1,
      eventId: 'event',
      results: [],
      progress: null,
    });
    memory.get('a')!.sequence = 99;
    expect(memory.get('a')!.sequence).toBe(1);
    time.mockReturnValue(1000 + memory.ttlMs);
    expect(memory.get('a')).toBeUndefined();
  });
  it('bounds retained jobs without discarding the newest', () => {
    const memory = new JobMemoryService();
    for (let i = 0; i <= memory.capacity; i++)
      memory.set(String(i), {
        sequence: i,
        eventId: null,
        results: [],
        progress: null,
      });
    expect(memory.get('0')).toBeUndefined();
    expect(memory.get(String(memory.capacity))?.results).toEqual([]);
  });
  it('serializes operations and releases a lock after failure', async () => {
    const memory = new JobMemoryService();
    const order: number[] = [];
    await Promise.allSettled([
      memory.exclusive('a', async () => {
        await Promise.resolve();
        order.push(1);
        throw new Error('test');
      }),
      memory.exclusive('a', () => {
        order.push(2);
        return Promise.resolve();
      }),
    ]);
    expect(order).toEqual([1, 2]);
    await expect(
      memory.exclusive('a', () => Promise.resolve('released')),
    ).resolves.toBe('released');
  });
});
