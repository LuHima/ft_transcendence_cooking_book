import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ReportStatus, ReportSubject } from '@prisma/client';
import { ReportQueryDto } from './report-query.dto';

describe('ReportQueryDto', () => {
  it('allows subject and status without target_id', async () => {
    const dto = plainToInstance(ReportQueryDto, {
      subject: ReportSubject.recipe,
      status: ReportStatus.pending,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('allows target_id when subject is also provided and transforms numeric strings', async () => {
    const dto = plainToInstance(ReportQueryDto, {
      subject: ReportSubject.recipe,
      target_id: '42',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.target_id).toBe(42);
  });

  it('fails validation when target_id is provided without subject', async () => {
    const dto = plainToInstance(ReportQueryDto, {
      target_id: '42',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'target_id')).toBe(true);
  });

  it('fails validation when target_id is less than 1 or non-integer', async () => {
    const zeroDto = plainToInstance(ReportQueryDto, {
      subject: ReportSubject.recipe,
      target_id: '0',
    });
    expect(await validate(zeroDto)).not.toHaveLength(0);

    const invalidDto = plainToInstance(ReportQueryDto, {
      subject: ReportSubject.recipe,
      target_id: 'abc',
    });
    expect(await validate(invalidDto)).not.toHaveLength(0);
  });
});
