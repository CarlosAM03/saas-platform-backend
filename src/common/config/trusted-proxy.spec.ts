import { trustedProxies } from './trusted-proxy';
describe('restricted proxy configuration', () => {
  it('trusts nobody by default', () =>
    expect(trustedProxies(undefined)).toBe(false));
  it('accepts explicit network identities', () =>
    expect(trustedProxies('127.0.0.1/32, 2001:db8::/64')).toEqual([
      '127.0.0.1/32',
      '2001:db8::/64',
    ]));
  it.each([
    'true',
    '1',
    'loopback',
    '0.0.0.0/0',
    '::/0',
    '192.0.2.1/99',
    '127.0.0.1,',
    'bad',
    true,
  ])('rejects broad or invalid trust %s', (value) =>
    expect(() => trustedProxies(value)).toThrow(),
  );
});
