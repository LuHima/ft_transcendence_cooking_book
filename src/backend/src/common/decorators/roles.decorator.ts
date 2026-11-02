import { SetMetadata, applyDecorators, UseGuards } from '@nestjs/common';
import { ApiForbiddenResponse } from '@nestjs/swagger';
import { RolesGuard } from '../guards/roles.guard';
import { ApiForbiddenResponseDto } from '../dto/api-error-response.dto';

export const ROLES_KEY = 'roles';

/**
 * Enforces role-based authorization for the route and attaches Swagger documentation.
 *
 * @param roles Allowed roles (e.g. 'admin', 'moderator')
 */
export const Roles = (...roles: string[]) =>
  applyDecorators(
    SetMetadata(ROLES_KEY, roles),
    UseGuards(RolesGuard),
    ApiForbiddenResponse({
      description: 'Forbidden: Insufficient privileges to access this resource',
      type: ApiForbiddenResponseDto,
    }),
  );
