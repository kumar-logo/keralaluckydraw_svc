import { buildOrderNo } from './order-no.generator';

describe('buildOrderNo (uk_order_no collision fix)', () => {
  it('produces unique ids for a whole bet built inside one millisecond', () => {
    const now = Date.now();
    const spy = jest.spyOn(Date, 'now').mockReturnValue(now);
    try {
      const ids = new Set<string>();
      const total = 200000;
      for (let i = 0; i < total; i += 1) ids.add(buildOrderNo('P3O'));
      expect(ids.size).toBe(total);
    } finally {
      spy.mockRestore();
    }
  });

  it('keeps the prefix and stays inside order_no varchar(64)', () => {
    const id = buildOrderNo('P3O');
    expect(id.startsWith('P3O')).toBe(true);
    expect(id.length).toBeLessThanOrEqual(64);
  });

  it('never emits a variable-width suffix that could alias another id', () => {
    const now = Date.now();
    const spy = jest.spyOn(Date, 'now').mockReturnValue(now);
    try {
      const lengths = new Set<number>();
      for (let i = 0; i < 5000; i += 1) lengths.add(buildOrderNo('P3O').length);
      expect(lengths.size).toBe(1);
    } finally {
      spy.mockRestore();
    }
  });
});
