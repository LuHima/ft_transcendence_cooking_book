import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { AppService } from './app.service';

/**
 * Controller for system diagnostic and connectivity testing.
 */
@ApiTags('System')
@Controller('test')
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Health check and connectivity greeting test.
   */
  @ApiOperation({
    summary: 'System health check probe',
    description: 'Returns a simple greeting confirmation indicating that the backend application is alive and responding.',
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


