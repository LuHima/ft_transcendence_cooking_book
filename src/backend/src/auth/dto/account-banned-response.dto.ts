import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReportReason } from '@prisma/client';

export class BannedDetailsDto {
  @ApiProperty({
    enum: ReportReason,
    enumName: 'ReportReason',
    description: 'Policy violation reason category',
    example: ReportReason.harassment_bullying,
  })
  reason: ReportReason;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'User-facing explanation of the infraction',
    example:
      'Your account was suspended due to repeated abusive comments on community recipes.',
  })
  description: string | null;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Scheduled ban expiration timestamp (null if permanent)',
    example: '2026-12-04T12:00:00.000Z',
  })
  banned_until: string | null;

  @ApiProperty({
    description: 'Indicates whether the disciplinary ban is permanent',
    example: false,
  })
  is_permanent: boolean;
}

export class AccountBannedResponseDto {
  @ApiProperty({ example: 403, description: 'HTTP status code' })
  statusCode: number;

  @ApiProperty({ example: 'Forbidden', description: 'HTTP error category' })
  error: string;

  @ApiProperty({
    example: 'ACCOUNT_BANNED',
    description: 'Machine-readable ban error code',
  })
  code: string;

  @ApiProperty({
    example:
      'Your account has been suspended for violating community guidelines.',
    description: 'User-facing suspension message',
  })
  message: string;

  @ApiProperty({
    type: BannedDetailsDto,
    description: 'Structured details of the disciplinary sanction',
  })
  details: BannedDetailsDto;

  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    example: '2026-11-04T12:00:00.000Z',
    description: 'Timestamp when the response was generated',
  })
  timestamp?: string;

  @ApiPropertyOptional({
    example: '/api/auth/signin',
    description: 'Request path',
  })
  path?: string;
}
