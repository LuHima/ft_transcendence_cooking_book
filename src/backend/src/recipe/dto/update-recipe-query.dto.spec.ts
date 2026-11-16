import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateRecipeQueryDto } from './update-recipe-query.dto';

describe('UpdateRecipeQueryDto', () => {
  it('accepts true, false, or omitted retranslate', async () => {
    expect(
      (await validate(plainToInstance(UpdateRecipeQueryDto, {}))).length,
    ).toBe(0);

    const t = plainToInstance(UpdateRecipeQueryDto, { retranslate: 'true' });
    expect(await validate(t)).toHaveLength(0);
    expect(t.retranslate).toBe(true);

    const f = plainToInstance(UpdateRecipeQueryDto, { retranslate: 'false' });
    expect(await validate(f)).toHaveLength(0);
    expect(f.retranslate).toBe(false);
  });

  it('rejects invalid non-boolean retranslate values', async () => {
    const invalid = plainToInstance(UpdateRecipeQueryDto, {
      retranslate: 'maybe',
    });
    const errors = await validate(invalid);
    expect(errors.some((e) => e.property === 'retranslate')).toBe(true);
  });
});
