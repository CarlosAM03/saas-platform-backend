import { ProspectCsvParser } from './prospect-csv.parser';

describe('ProspectCsvParser', () => {
  const parser = new ProspectCsvParser();
  const read = (csv: string) => parser.parse(Buffer.from(csv));

  it('accepts a single name column', () => {
    expect(read('name\nAlice')[0].values).toEqual({ name: 'Alice' });
  });
  it('supports BOM, semicolon, quotes, newlines and phone strings', () => {
    const rows = read(
      '\uFEFFname;address;phone\n"Alice; Smith";"line1\nline2";00123',
    );
    expect(rows[0]).toMatchObject({
      record: 1,
      errors: [],
      values: { name: 'Alice; Smith', address: 'line1\nline2', phone: '00123' },
    });
  });
  it('preserves absence and converts nullable blanks', () => {
    const row = read('name,email\nAlice,')[0];
    expect(row.values.email).toBeNull();
    expect(row.values).not.toHaveProperty('phone');
  });
  it.each([
    'name,name\na,b',
    'name,tenantId\na,b',
    'email\na',
    'name\n"unclosed',
    '',
  ])('rejects invalid structure: %s', (csv) => {
    expect(() => read(csv)).toThrow();
  });
  it('rejects invalid fields and blank status', () => {
    const rows = read('name,email,website,status\nAlice,wrong,example.com,');
    expect(rows[0].errors.map((e) => e.field)).toEqual([
      'email',
      'website',
      'status',
    ]);
  });
  it('marks every repeated normalized name and preserves accents', () => {
    const rows = read('name\n Alice  Smith \nalice smith\nÁlice Smith');
    expect(rows.map((r) => r.errors.length)).toEqual([1, 1, 0]);
  });
  it('ignores empty records while retaining logical numbers', () => {
    expect(read('name,email\n,\nAlice,')[0].record).toBe(2);
  });
  it('rejects invalid UTF8, binary and excessive records', () => {
    expect(() => parser.parse(Buffer.from([0xff]))).toThrow();
    expect(() => read('name\nA\0')).toThrow();
    expect(() =>
      read(
        'name\n' + Array.from({ length: 1001 }, (_, i) => `A${i}`).join('\n'),
      ),
    ).toThrow();
  });
});
