import { BadRequestException, ValidationError } from '@nestjs/common';
import { validationExceptionFactory } from './validation-exception.factory';

describe('validationExceptionFactory', () => {
  it('flattens top-level and nested validation errors into readable messages and field details', () => {
    const errors: ValidationError[] = [
      {
        property: 'phone',
        constraints: {
          matches:
            'Phone number must contain 7 to 15 digits and may only include numbers, spaces, +, -, (, ), and .',
        },
        children: [],
      },
      {
        property: 'steps',
        children: [
          {
            property: '0',
            children: [
              {
                property: 'description',
                constraints: {
                  isNotEmpty: 'Recipe step details cannot be empty',
                },
                children: [],
              },
            ],
          },
        ],
      },
    ];

    const exception = validationExceptionFactory(errors);
    expect(exception).toBeInstanceOf(BadRequestException);

    const response = exception.getResponse() as {
      statusCode: number;
      message: string[];
      error: string;
      details: Array<{ field: string; constraints: Record<string, string> }>;
    };

    expect(response.statusCode).toBe(400);
    expect(response.error).toBe('Bad Request');
    expect(response.message).toEqual([
      'Phone number must contain 7 to 15 digits and may only include numbers, spaces, +, -, (, ), and .',
      'Recipe step details cannot be empty',
    ]);
    expect(response.details).toEqual([
      {
        field: 'phone',
        constraints: {
          matches:
            'Phone number must contain 7 to 15 digits and may only include numbers, spaces, +, -, (, ), and .',
        },
      },
      {
        field: 'steps.0.description',
        constraints: {
          isNotEmpty: 'Recipe step details cannot be empty',
        },
      },
    ]);
  });

  it('provides a fallback message when no constraint messages are present', () => {
    const exception = validationExceptionFactory([]);
    const response = exception.getResponse() as {
      message: string[];
      details: unknown[];
    };
    expect(response.message).toEqual(['Validation failed']);
    expect(response.details).toEqual([]);
  });
});
