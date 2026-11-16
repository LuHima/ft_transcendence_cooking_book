import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import {
  IsIngredientNotes,
  normalizeIngredientNotes,
} from './recipe-ingredient-notes.validator';

class TestIngredientNotesDto {
  @IsOptional()
  @Transform(normalizeIngredientNotes)
  @IsIngredientNotes()
  notes?: Record<string, string> | string | null;
}

describe('IsIngredientNotes & normalizeIngredientNotes', () => {
  it('accepts valid string notes and trims whitespace', async () => {
    const dto = plainToInstance(TestIngredientNotesDto, {
      notes: '  tritato finemente  ',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.notes).toBe('tritato finemente');
  });

  it('resolves blank string notes or empty-only locale dictionaries to null', async () => {
    const blankStr = plainToInstance(TestIngredientNotesDto, { notes: '   ' });
    expect(await validate(blankStr)).toHaveLength(0);
    expect(blankStr.notes).toBeNull();

    const blankDict = plainToInstance(TestIngredientNotesDto, {
      notes: { it: '  ', en: '' },
    });
    expect(await validate(blankDict)).toHaveLength(0);
    expect(blankDict.notes).toBeNull();
  });

  it('accepts valid locale dictionary with it/en/fr keys and trims values', async () => {
    const dto = plainToInstance(TestIngredientNotesDto, {
      notes: { it: '  tritato  ', en: 'chopped', fr: 'haché' },
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.notes).toEqual({ it: 'tritato', en: 'chopped', fr: 'haché' });
  });

  it('rejects empty objects, unsupported locale keys, non-string values, arrays, and numbers', async () => {
    for (const invalid of [
      {},
      123,
      true,
      ['chopped'],
      { de: 'gehackt' },
      { it: 123 },
      { it: { nested: 'value' } },
      'x'.repeat(256),
      { it: 'x'.repeat(256) },
    ]) {
      const dto = plainToInstance(TestIngredientNotesDto, { notes: invalid });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('notes');
    }
  });
});
