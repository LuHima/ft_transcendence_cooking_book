import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateRecipeDto } from './create-recipe.dto';
import { UpdateRecipeDto } from './update-recipe.dto';
import { RecipePrivacy, Course, RecipeDifficulty } from '@prisma/client';

describe('Recipe Privacy DTO Validation', () => {
  describe('CreateRecipeDto', () => {
    const validBaseRecipe = {
      title: 'Pasta al Limone',
      description: 'Una deliziosa pasta al limone e basilico fresco.',
      course: Course.first_course,
      difficulty: RecipeDifficulty.easy,
      prep_time: 10,
      cook_time: 15,
      servings: 2,
      source_lang: 'it',
      steps: [
        {
          step_number: 1,
          description: 'Lessare la pasta in abbondante acqua salata.',
        },
      ],
      ingredients: [
        {
          ingredient_id: 1,
          quantity: 200,
          unit: 'g',
        },
      ],
    };

    it('should validate valid RecipePrivacy enums', async () => {
      for (const privacy of [
        RecipePrivacy.public,
        RecipePrivacy.friends_only,
        RecipePrivacy.private,
      ]) {
        const dto = plainToInstance(CreateRecipeDto, {
          ...validBaseRecipe,
          privacy,
        });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
        expect(dto.privacy).toBe(privacy);
      }
    });

    it('should reject invalid RecipePrivacy value', async () => {
      const dto = plainToInstance(CreateRecipeDto, {
        ...validBaseRecipe,
        privacy: 'invalid_privacy' as any,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const privacyError = errors.find((e) => e.property === 'privacy');
      expect(privacyError).toBeDefined();
      expect(privacyError?.constraints).toHaveProperty('isEnum');
    });

    it('rejects whitespace-only title, description, and step description', async () => {
      const dto = plainToInstance(CreateRecipeDto, {
        ...validBaseRecipe,
        title: '   ',
        description: '          ',
        steps: [{ step_number: 1, description: '   ' }],
      });
      const errors = await validate(dto);
      expect(errors.some((e) => e.property === 'title')).toBe(true);
      expect(errors.some((e) => e.property === 'description')).toBe(true);
      expect(errors.some((e) => e.property === 'steps')).toBe(true);
    });

    it('resolves empty preservation, tips, step title, and ingredient notes to null and enforces max lengths', async () => {
      const clearedDto = plainToInstance(CreateRecipeDto, {
        ...validBaseRecipe,
        preservation: '   ',
        tips: '',
        steps: [
          { step_number: 1, title: '  ', description: 'Lessare la pasta.' },
        ],
        ingredients: [
          { ingredient_id: 1, quantity: 100, unit: 'g', notes: '  ' },
        ],
      });
      expect(await validate(clearedDto)).toHaveLength(0);
      expect(clearedDto.preservation).toBeNull();
      expect(clearedDto.tips).toBeNull();
      expect(clearedDto.steps[0].title).toBeNull();
      expect(clearedDto.ingredients[0].notes).toBeNull();

      const tooLongDto = plainToInstance(CreateRecipeDto, {
        ...validBaseRecipe,
        preservation: 'a'.repeat(1001),
        tips: 'b'.repeat(1001),
        steps: [{ step_number: 1, description: 'c'.repeat(2001) }],
      });
      const errors = await validate(tooLongDto);
      expect(errors.some((e) => e.property === 'preservation')).toBe(true);
      expect(errors.some((e) => e.property === 'tips')).toBe(true);
      expect(errors.some((e) => e.property === 'steps')).toBe(true);
    });

    it('enforces quantity bounds (0.01 to 99999999.99) and integer upper bounds', async () => {
      const invalidDto = plainToInstance(CreateRecipeDto, {
        ...validBaseRecipe,
        prep_time: 8761,
        cook_time: 8761,
        servings: 1001,
        tag_ids: [0, 2147483648],
        steps: [
          {
            step_number: 101,
            description: 'Step troppo lungo nel numero.',
            duration: 8761,
          },
        ],
        ingredients: [
          { ingredient_id: 0, quantity: 0, unit: 'g', notes: { es: 'bad' } },
        ],
      });
      const errors = await validate(invalidDto);
      const props = errors.map((e) => e.property);
      expect(props).toContain('prep_time');
      expect(props).toContain('cook_time');
      expect(props).toContain('servings');
      expect(props).toContain('tag_ids');
      expect(props).toContain('steps');
      expect(props).toContain('ingredients');

      const overMaxQty = plainToInstance(CreateRecipeDto, {
        ...validBaseRecipe,
        ingredients: [{ ingredient_id: 1, quantity: 100000000, unit: 'g' }],
      });
      expect(
        (await validate(overMaxQty)).some((e) => e.property === 'ingredients'),
      ).toBe(true);

      const minValidQty = plainToInstance(CreateRecipeDto, {
        ...validBaseRecipe,
        prep_time: 8760,
        cook_time: 8760,
        servings: 1000,
        ingredients: [{ ingredient_id: 1, quantity: 0.01, unit: 'g' }],
      });
      expect(await validate(minValidQty)).toHaveLength(0);
    });
  });

  describe('UpdateRecipeDto', () => {
    it('should allow valid RecipePrivacy in UpdateRecipeDto', async () => {
      for (const privacy of [
        RecipePrivacy.public,
        RecipePrivacy.friends_only,
        RecipePrivacy.private,
      ]) {
        const dto = plainToInstance(UpdateRecipeDto, { privacy });
        const errors = await validate(dto);
        expect(errors.length).toBe(0);
        expect(dto.privacy).toBe(privacy);
      }
    });

    it('should reject invalid RecipePrivacy in UpdateRecipeDto', async () => {
      const dto = plainToInstance(UpdateRecipeDto, {
        privacy: 'invalid_tier' as any,
      });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const privacyError = errors.find((e) => e.property === 'privacy');
      expect(privacyError).toBeDefined();
      expect(privacyError?.constraints).toHaveProperty('isEnum');
    });

    it('inherits trim-to-null and bounds on partial updates', async () => {
      const dto = plainToInstance(UpdateRecipeDto, {
        preservation: '   ',
        tips: '',
      });
      expect(await validate(dto)).toHaveLength(0);
      expect(dto.preservation).toBeNull();
      expect(dto.tips).toBeNull();
    });
  });
});
