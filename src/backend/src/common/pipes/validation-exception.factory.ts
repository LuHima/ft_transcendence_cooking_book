import { BadRequestException, ValidationError } from '@nestjs/common';

export interface ValidationFieldErrorDetail {
  field: string;
  constraints: Record<string, string>;
}

function collectValidationDetails(
  errors: ValidationError[],
  parentPath = '',
): { messages: string[]; details: ValidationFieldErrorDetail[] } {
  const messages: string[] = [];
  const details: ValidationFieldErrorDetail[] = [];

  for (const error of errors) {
    const fieldPath = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;

    if (error.constraints && Object.keys(error.constraints).length > 0) {
      details.push({
        field: fieldPath,
        constraints: { ...error.constraints },
      });
      messages.push(...Object.values(error.constraints));
    }

    if (error.children && error.children.length > 0) {
      const nested = collectValidationDetails(error.children, fieldPath);
      messages.push(...nested.messages);
      details.push(...nested.details);
    }
  }

  return { messages, details };
}

/**
 * Formats class-validator errors into a standardized BadRequestException containing
 * both user-facing `message` strings and structured field-level `details`.
 */
export function validationExceptionFactory(
  errors: ValidationError[],
): BadRequestException {
  const { messages, details } = collectValidationDetails(errors);
  return new BadRequestException({
    statusCode: 400,
    message: messages.length > 0 ? messages : ['Validation failed'],
    error: 'Bad Request',
    details,
  });
}
