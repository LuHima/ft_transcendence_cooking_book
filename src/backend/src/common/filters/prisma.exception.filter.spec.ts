import { PrismaExceptionFilter } from './prisma.exception.filter';
import { Prisma } from '@prisma/client';
import { ArgumentsHost } from '@nestjs/common';

describe('PrismaExceptionFilter', () => {
  let filter: PrismaExceptionFilter;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new PrismaExceptionFilter();
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    mockHost = {
      switchToHttp: () => ({
        getResponse: () => ({ status: mockStatus }),
        getRequest: () => ({ url: '/api/recipes', method: 'POST' }),
      }),
    } as any;
  });

  it('formats P2003 error with honest field or foreign key message rather than parent model name', () => {
    const error = new Prisma.PrismaClientKnownRequestError(
      'Foreign key constraint failed',
      {
        code: 'P2003',
        clientVersion: '5.19.0',
        meta: {
          modelName: 'Recipe',
          field_name: 'recipe_ingredients_ingredient_id_fkey',
        },
      },
    );

    filter.catch(error, mockHost);

    expect(mockStatus).toHaveBeenCalledWith(400);
    expect(mockJson).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('ingredient_id'),
      }),
    );
    expect(mockJson).not.toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'The Recipe key is not valid',
      }),
    );
  });
});
