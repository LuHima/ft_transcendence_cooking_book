import { Controller, Get } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiInternalServerErrorResponse,
} from '@nestjs/swagger';
import { AppService } from './app.service';
import { ApiInternalServerErrorResponseDto } from './common/dto/api-error-response.dto';

/**
 * Controller for system diagnostic and connectivity testing.
 */
@ApiTags('System')
@ApiInternalServerErrorResponse({
  type: ApiInternalServerErrorResponseDto,
  description: 'Internal server error',
})
@Controller('test')
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Health check and connectivity greeting test.
   */
  @ApiOperation({
    summary: 'System health check probe',
    description:
      'Returns a simple greeting confirmation indicating that the backend application is alive and responding.',
  })
  @ApiOkResponse({
    description: 'Service greeting message',
    schema: {
      type: 'string',
      example: 'Hello World!',
    },
  })
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
