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
  });
});
