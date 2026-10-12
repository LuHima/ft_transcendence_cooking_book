import { ProductionConfig } from './production.config';

describe('ProductionConfig', () => {
  const originalValue = process.env.PRODUCTION_FLAG;

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env.PRODUCTION_FLAG;
    } else {
      process.env.PRODUCTION_FLAG = originalValue;
    }
  });

  it('defaults to false when PRODUCTION_FLAG is missing', () => {
    delete process.env.PRODUCTION_FLAG;

    expect(new ProductionConfig().isProduction()).toBe(false);
  });

  it.each(['true', '1', ' TRUE ', '1'])('returns true for "%s"', (value) => {
    process.env.PRODUCTION_FLAG = value;

    expect(new ProductionConfig().isProduction()).toBe(true);
  });

  it.each(['false', '0', ' FALSE ', '0'])('returns false for "%s"', (value) => {
    process.env.PRODUCTION_FLAG = value;

    expect(new ProductionConfig().isProduction()).toBe(false);
  });

  it('rejects unsupported values', () => {
    process.env.PRODUCTION_FLAG = 'yes';

    expect(() => new ProductionConfig()).toThrow(
      'PRODUCTION_FLAG must be one of: true, 1, false, or 0',
    );
  });
});
