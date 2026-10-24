import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { RecipeController } from './recipe.controller';
import { RecipeService } from './recipe.service';
import { CatalogService } from '../catalog/catalog.service';
import { AuthGuard } from '../common/guards/auth.guard';
import { OptionalAuthGuard } from '../common/guards/optional-auth.guard';
import {
  Course,
  RecipeDifficulty,
  TranslationStatus,
  UnitOfMeasure,
} from '@prisma/client';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { FilterRecipeDto } from './dto/filter-recipe.dto';
import { CreateCommentDto } from './dto/create-comment.dto';

describe('RecipeController', () => {
  let controller: RecipeController;
  let service: RecipeService;
  let catalogService: CatalogService;

  const mockCatalogService = {
    getMetadata: jest.fn(),
  };

  const mockRecipeService = {
    createRecipe: jest.fn(),
    getAllRecipe: jest.fn(),
    getRecipeById: jest.fn(),
    retryTranslation: jest.fn(),
    updateRecipe: jest.fn(),
    deleteRecipe: jest.fn(),
    uploadCoverImage: jest.fn(),
    uploadStepImage: jest.fn(),
    uploadGalleryMedia: jest.fn(),
    uploadVideo: jest.fn(),
    deleteCoverImage: jest.fn(),
    deleteVideo: jest.fn(),
    deleteStepImage: jest.fn(),
    deleteGalleryMedia: jest.fn(),
    likeRecipe: jest.fn(),
    unlikeRecipe: jest.fn(),
    createComment: jest.fn(),
    getComments: jest.fn(),
    deleteComment: jest.fn(),
    updateComment: jest.fn(),
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
        {
          provide: CatalogService,
          useValue: mockCatalogService,
        },
        {
          provide: JwtService,
          useValue: {
            verifyAsync: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(OptionalAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<RecipeController>(RecipeController);
    service = module.get<RecipeService>(RecipeService);
    catalogService = module.get<CatalogService>(CatalogService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getRecipes', () => {
    const mockPaginatedResult = {
      items: [
        {
          id: 1,
          title: 'Carbonara',
          description: 'Classica',
          course: Course.first_course,
          difficulty: RecipeDifficulty.medium,
          prep_time: 15,
          cook_time: 10,
          total_time: 25,
          servings: 4,
          source_lang: 'it',
          translation_status: TranslationStatus.completed,
          cover_image_url: null,
          video_url: null,
          created_at: new Date('2026-10-09T18:00:00.000Z'),
          updated_at: null,
          author: { id: 1, username: 'chef_mario', avatar_url: null },
          tags: [],
          likes_count: 5,
          comments_count: 2,
          is_liked: false,
          resolved_lang: 'it',
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
      total_pages: 1,
      has_next_page: false,
      has_prev_page: false,
    };

    it('delegates to service.getAllRecipe with optional lang query parameter', async () => {
      mockRecipeService.getAllRecipe.mockResolvedValueOnce(mockPaginatedResult);

      const result = await controller.getRecipes({ lang: 'it' });

      expect(service.getAllRecipe).toHaveBeenCalledWith(
        { lang: 'it' },
        undefined,
      );
      expect(result).toEqual(mockPaginatedResult);
    });

    it('delegates to service.getAllRecipe with multi-criteria filters and pagination', async () => {
      mockRecipeService.getAllRecipe.mockResolvedValueOnce(mockPaginatedResult);

      const filterDto: FilterRecipeDto = {
        page: 2,
        limit: 10,
        course: Course.main_course,
        difficulty: RecipeDifficulty.easy,
        search: 'pasta',
        max_time: 30,
        author_id: 1,
        tag_ids: [1, 2],
        lang: 'it',
      };

      const result = await controller.getRecipes(filterDto);

      expect(service.getAllRecipe).toHaveBeenCalledWith(filterDto, undefined);
      expect(result).toEqual(mockPaginatedResult);
    });

    it('delegates to service.getAllRecipe with filter options and current user id when authenticated', async () => {
      mockRecipeService.getAllRecipe.mockResolvedValueOnce(mockPaginatedResult);

      const result = await controller.getRecipes({}, 42);

      expect(service.getAllRecipe).toHaveBeenCalledWith({}, 42);
      expect(result).toEqual(mockPaginatedResult);
    });
  });

  describe('getMetadata', () => {
    it('delegates to catalogService.getMetadata', () => {
      const mockMeta = {
        courses: ['first_course'],
        difficulties: ['easy'],
        units: ['g'],
        categories: ['produce'],
      };
      mockCatalogService.getMetadata.mockReturnValueOnce(mockMeta);

      const result = controller.getMetadata();

      expect(catalogService.getMetadata).toHaveBeenCalled();
      expect(result).toEqual(mockMeta);
    });
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

      const result = await controller.getRecipeById(1, { lang: 'it' });

      expect(service.getRecipeById).toHaveBeenCalledWith(1, 'it', undefined);
      expect(result).toEqual(mockResult);
    });

    it('delegates to service.getRecipeById with id, lang, and current user id when authenticated', async () => {
      const mockResult = {
        id: 1,
        title: 'Carbonara',
        likes_count: 10,
        comments_count: 3,
        is_liked: true,
      };
      mockRecipeService.getRecipeById.mockResolvedValueOnce(mockResult);

      const result = await controller.getRecipeById(1, { lang: 'it' }, 42);

      expect(service.getRecipeById).toHaveBeenCalledWith(1, 'it', 42);
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

      expect(service.updateRecipe).toHaveBeenCalledWith(42, 1, updateDto, true);
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

      expect(service.uploadGalleryMedia).toHaveBeenCalledWith(1, 42, mockFiles);
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

  describe('deleteCoverImage', () => {
    it('delegates to service.deleteCoverImage with recipeId and userId', async () => {
      const mockResult = { message: 'Cover image deleted successfully' };
      mockRecipeService.deleteCoverImage.mockResolvedValueOnce(mockResult);

      const result = await controller.deleteCoverImage(1, 42);

      expect(service.deleteCoverImage).toHaveBeenCalledWith(1, 42);
      expect(result).toEqual(mockResult);
    });
  });

  describe('deleteVideo', () => {
    it('delegates to service.deleteVideo with recipeId and userId', async () => {
      const mockResult = { message: 'Recipe video deleted successfully' };
      mockRecipeService.deleteVideo.mockResolvedValueOnce(mockResult);

      const result = await controller.deleteVideo(1, 42);

      expect(service.deleteVideo).toHaveBeenCalledWith(1, 42);
      expect(result).toEqual(mockResult);
    });
  });

  describe('deleteStepImage', () => {
    it('delegates to service.deleteStepImage with recipeId, stepNumber, and userId', async () => {
      const mockResult = { message: 'Step image deleted successfully' };
      mockRecipeService.deleteStepImage.mockResolvedValueOnce(mockResult);

      const result = await controller.deleteStepImage(1, 2, 42);

      expect(service.deleteStepImage).toHaveBeenCalledWith(1, 2, 42);
      expect(result).toEqual(mockResult);
    });
  });

  describe('deleteGalleryMedia', () => {
    it('delegates to service.deleteGalleryMedia with recipeId, mediaId, and userId', async () => {
      const mockResult = { message: 'Gallery media deleted successfully' };
      mockRecipeService.deleteGalleryMedia.mockResolvedValueOnce(mockResult);

      const result = await controller.deleteGalleryMedia(1, 10, 42);

      expect(service.deleteGalleryMedia).toHaveBeenCalledWith(1, 10, 42);
      expect(result).toEqual(mockResult);
    });
  });

  describe('likeRecipe', () => {
    it('delegates to service.likeRecipe with recipeId and userId', async () => {
      const mockResult = { message: 'Recipe liked successfully', liked: true };
      mockRecipeService.likeRecipe.mockResolvedValueOnce(mockResult);

      const result = await controller.likeRecipe(1, 42);

      expect(service.likeRecipe).toHaveBeenCalledWith(1, 42);
      expect(result).toEqual(mockResult);
    });
  });

  describe('unlikeRecipe', () => {
    it('delegates to service.unlikeRecipe with recipeId and userId', async () => {
      const mockResult = {
        message: 'Recipe unliked successfully',
        liked: false,
      };
      mockRecipeService.unlikeRecipe.mockResolvedValueOnce(mockResult);

      const result = await controller.unlikeRecipe(1, 42);

      expect(service.unlikeRecipe).toHaveBeenCalledWith(1, 42);
      expect(result).toEqual(mockResult);
    });
  });

  describe('createComment', () => {
    it('delegates to service.createComment with recipeId, userId, and commentDto', async () => {
      const mockCommentDto: CreateCommentDto = {
        content: 'Buonissima ricetta!',
        parent_id: 1,
      };
      const mockResult = {
        id: 10,
        recipe_id: 1,
        user_id: 42,
        parent_id: 1,
        content: 'Buonissima ricetta!',
        is_active: true,
        created_at: new Date(),
        user: { id: 42, username: 'mario', avatar_url: null },
      };
      mockRecipeService.createComment.mockResolvedValueOnce(mockResult);

      const result = await controller.createComment(1, 42, mockCommentDto);

      expect(service.createComment).toHaveBeenCalledWith(1, 42, mockCommentDto);
      expect(result).toEqual(mockResult);
    });
  });

  describe('getComments', () => {
    it('delegates to service.getComments with recipeId', async () => {
      const mockResult = [
        {
          id: 1,
          recipe_id: 1,
          user_id: 10,
          parent_id: null,
          content: 'Parent comment',
          is_active: true,
          created_at: new Date(),
          user: { id: 10, username: 'marco', avatar_url: null },
          replies: [],
        },
      ];
      mockRecipeService.getComments.mockResolvedValueOnce(mockResult);

      const result = await controller.getComments(1);

      expect(service.getComments).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockResult);
    });
  });

  describe('deleteComment', () => {
    it('delegates to service.deleteComment with recipeId, commentId, and userId', async () => {
      const mockResult = { message: 'Comment deactivated successfully' };
      mockRecipeService.deleteComment.mockResolvedValueOnce(mockResult);

      const result = await controller.deleteComment(1, 10, 42);

      expect(service.deleteComment).toHaveBeenCalledWith(1, 10, 42);
      expect(result).toEqual(mockResult);
    });
  });

  describe('updateComment', () => {
    it('delegates to service.updateComment with recipeId, commentId, userId, and updateCommentDto', async () => {
      const mockResult = {
        id: 10,
        recipe_id: 1,
        user_id: 42,
        parent_id: null,
        content: 'Updated content',
        is_active: true,
        is_edited: true,
        created_at: new Date(),
        updated_at: new Date(),
        user: { id: 42, username: 'chef_mario', avatar_url: null },
      };
      mockRecipeService.updateComment.mockResolvedValueOnce(mockResult);

      const updateDto = { content: 'Updated content' };
      const result = await controller.updateComment(1, 10, 42, updateDto);

      expect(service.updateComment).toHaveBeenCalledWith(1, 10, 42, updateDto);
      expect(result).toEqual(mockResult);
    });
  });
});
