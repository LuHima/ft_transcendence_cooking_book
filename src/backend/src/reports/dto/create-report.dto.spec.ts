import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ReportReason, ReportSubject } from '@prisma/client';
import { CreateReportDto } from './create-report.dto';

describe('CreateReportDto', () => {
  const validBasePayload = {
    subject: ReportSubject.recipe,
    target_id: 1,
    description: 'Detailed description',
  };

  const canonicalReasons = [
    ReportReason.spam_scam,
    ReportReason.harassment_bullying,
    ReportReason.hate_speech,
    ReportReason.sexual_content,
    ReportReason.violence_threats,
    ReportReason.copyright_infringement,
    ReportReason.impersonation_misinformation,
    ReportReason.other,
  ];

  it.each(canonicalReasons)(
    'validates successfully with canonical reason: %s',
    async (reason) => {
      const dto = plainToInstance(CreateReportDto, {
        ...validBasePayload,
        reason,
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    },
  );

  it('fails validation when legacy or invalid reason is passed', async () => {
    const dto = plainToInstance(CreateReportDto, {
      ...validBasePayload,
      reason: 'invalid_reason_code',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('reason');
  });

  it('fails validation when legacy reason "spam" is passed', async () => {
    const dto = plainToInstance(CreateReportDto, {
      ...validBasePayload,
      reason: 'spam',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('reason');
  });

  it('resolves blank description to null and rejects out-of-range target_id', async () => {
    const blank = plainToInstance(CreateReportDto, {
      ...validBasePayload,
      reason: ReportReason.other,
      description: '   ',
    });
    expect(await validate(blank)).toHaveLength(0);
    expect(blank.description).toBeNull();

    const badId = plainToInstance(CreateReportDto, {
      ...validBasePayload,
      reason: ReportReason.other,
      target_id: 2147483648,
    });
    const errors = await validate(badId);
    expect(errors.some((e) => e.property === 'target_id')).toBe(true);
  });
});
