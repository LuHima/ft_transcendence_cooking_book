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
    retryTranslation: jest.fn(),
    updateRecipe: jest.fn(),
    deleteRecipe: jest.fn(),
    uploadCoverImage: jest.fn(),
    uploadStepImage: jest.fn(),
    uploadGalleryMedia: jest.fn(),
    uploadVideo: jest.fn(),
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

  describe('getRecipeById', () => {
    it('delegates to service.getRecipeById with id and lang query parameter', async () => {
      const mockResult = { id: 1, title: 'Carbonara' };
      mockRecipeService.getRecipeById.mockResolvedValueOnce(mockResult);

      const result = await controller.getRecipeById(1, 'it');

      expect(service.getRecipeById).toHaveBeenCalledWith(1, 'it');
      expect(result).toEqual(mockResult);
    });
  });

  describe('retryTranslation', () => {
    it('delegates to service.retryTranslation with id and user id', async () => {
      const mockResult = { id: 1, translation_status: 'completed' };
      mockRecipeService.retryTranslation.mockResolvedValueOnce(mockResult);

      const result = await controller.retryTranslation(1, 42);

      expect(service.retryTranslation).toHaveBeenCalledWith(1, 42);
      expect(result).toEqual(mockResult);
    });
  });

  describe('updateRecipe', () => {
    it('delegates to service.updateRecipe with user id, recipe id, dto, and retranslate flag', async () => {
      const mockResult = { id: 1, title: 'Updated' };
      mockRecipeService.updateRecipe.mockResolvedValueOnce(mockResult);

      const updateDto = { title: 'Updated Title' };
      const result = await controller.updateRecipe(1, updateDto, 42, 'true');

      expect(service.updateRecipe).toHaveBeenCalledWith(
        42,
        1,
        updateDto,
        true,
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('uploadCoverImage', () => {
    it('delegates to service.uploadCoverImage with id, user id, and file', async () => {
      const mockResult = { cover_image_url: '/uploads/recipes/cover.jpg' };
      mockRecipeService.uploadCoverImage.mockResolvedValueOnce(mockResult);

      const mockFile = { filename: 'cover.jpg' } as any;
      const result = await controller.uploadCoverImage(1, 42, mockFile);

      expect(service.uploadCoverImage).toHaveBeenCalledWith(1, 42, mockFile);
      expect(result).toEqual(mockResult);
    });
  });

  describe('uploadStepImage', () => {
    it('delegates to service.uploadStepImage with id, stepNumber, user id, and file', async () => {
      const mockResult = {
        step_number: 2,
        image_url: '/uploads/recipes/step-2.jpg',
      };
      mockRecipeService.uploadStepImage.mockResolvedValueOnce(mockResult);

      const mockFile = { filename: 'step-2.jpg' } as any;
      const result = await controller.uploadStepImage(1, 2, 42, mockFile);

      expect(service.uploadStepImage).toHaveBeenCalledWith(1, 2, 42, mockFile);
      expect(result).toEqual(mockResult);
    });
  });

  describe('uploadGalleryMedia', () => {
    it('delegates to service.uploadGalleryMedia with id, user id, and files', async () => {
      const mockResult = [{ id: 1, url: '/uploads/recipes/g1.jpg' }];
      mockRecipeService.uploadGalleryMedia.mockResolvedValueOnce(mockResult);

      const mockFiles = [{ filename: 'g1.jpg' }] as any[];
      const result = await controller.uploadGalleryMedia(1, 42, mockFiles);

      expect(service.uploadGalleryMedia).toHaveBeenCalledWith(
        1,
        42,
        mockFiles,
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe('uploadVideo', () => {
    it('delegates to service.uploadVideo with id, user id, and file', async () => {
      const mockResult = { video_url: '/uploads/recipes/video.mp4' };
      mockRecipeService.uploadVideo.mockResolvedValueOnce(mockResult);

      const mockFile = { filename: 'video.mp4' } as any;
      const result = await controller.uploadVideo(1, 42, mockFile);

      expect(service.uploadVideo).toHaveBeenCalledWith(1, 42, mockFile);
      expect(result).toEqual(mockResult);
    });
  });
});
