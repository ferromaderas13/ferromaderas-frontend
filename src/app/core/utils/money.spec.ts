import { exactPrice, lineAmount, formatQuetzales } from './money';

describe('exactPrice', () => {
  it('normaliza 99.99 a 100', () => {
    expect(exactPrice(99.99)).toBe(100);
  });

  it('deja enteros intactos', () => {
    expect(exactPrice(100)).toBe(100);
    expect(exactPrice(85)).toBe(85);
  });

  it('conserva medios quetzales reales', () => {
    expect(exactPrice(85.5)).toBe(85.5);
  });
});

describe('lineAmount', () => {
  it('3 x Q100 = Q300', () => {
    expect(lineAmount(99.99, 3)).toBe(300);
  });
});

describe('formatQuetzales', () => {
  it('muestra enteros sin céntimos', () => {
    expect(formatQuetzales(99.99)).toBe('Q100');
  });
});
