import { Test, TestingModule } from '@nestjs/testing';
import { RecipeController } from './recipe.controller';
import { RecipeService } from './recipe.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/role.guard';
import { Course, RecipeDifficulty, UnitOfMeasure } from '@prisma/client';
import { CreateRecipeDto } from './dto/create-recipe.dto';

describe('RecipeController', () => {
  let controller: RecipeController;
  let service: RecipeService;

  const mockRecipeService = {
    createRecipe: jest.fn(),
    getAllRecipe: jest.fn(),
    getRecipeStack: jest.fn(),
    getRecipesByName: jest.fn(),
    getRecipeById: jest.fn(),
    updateRecipe: jest.fn(),
    deleteRecipe: jest.fn(),
  };

  const sampleDto: CreateRecipeDto = {
    title: 'Pasta al Pesto Fresco Genovese',
    description: 'Un piatto tipico ligure profumato al basilico fresco.',
    preservation: 'Conservare in frigo per 2 giorni.',
    tips: 'Non scaldare mai il pesto direttamente.',
    course: Course.first_course,
    difficulty: RecipeDifficulty.easy,
    prep_time: 15,
    cook_time: 10,
    servings: 4,
    source_lang: 'it',
    steps: [
      {
        step_number: 1,
        title: 'Pestare il basilico',
        description: 'Pesta il basilico con pinoli, aglio e olio extravergine.',
        duration: 10,
      },
    ],
    ingredients: [
      {
        ingredient_id: 1,
        quantity: 350,
        unit: UnitOfMeasure.g,
      },
    ],
    tag_ids: [1],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RecipeController],
      providers: [
        {
          provide: RecipeService,
          useValue: mockRecipeService,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<RecipeController>(RecipeController);
    service = module.get<RecipeService>(RecipeService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('addRecipe', () => {
    it('delegates recipe creation to RecipeService with user id', async () => {
      const mockResult = { id: 1, ...sampleDto };
      mockRecipeService.createRecipe.mockResolvedValueOnce(mockResult);

      const result = await controller.addRecipe(sampleDto, 42);

      expect(service.createRecipe).toHaveBeenCalledWith(sampleDto, 42);
      expect(result).toEqual(mockResult);
    });
  });
});
