import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ReportAction, ReportStatus } from '@prisma/client';
import { UpdateReportDto } from './update-report.dto';

describe('UpdateReportDto validation', () => {
  it('passes validation for single actions', async () => {
    for (const action of [
      ReportAction.warn,
      ReportAction.ban,
      ReportAction.delete_content,
      ReportAction.dismiss,
    ]) {
      const dto = plainToInstance(UpdateReportDto, { actions: [action] });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    }
  });

  it('passes validation for valid composite actions [warn, delete_content] and [ban, delete_content]', async () => {
    const validPairs = [
      [ReportAction.warn, ReportAction.delete_content],
      [ReportAction.delete_content, ReportAction.warn],
      [ReportAction.ban, ReportAction.delete_content],
      [ReportAction.delete_content, ReportAction.ban],
    ];

    for (const actions of validPairs) {
      const dto = plainToInstance(UpdateReportDto, { actions });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    }
  });

  it('fails validation when warn and ban are combined', async () => {
    const dto = plainToInstance(UpdateReportDto, {
      actions: [ReportAction.warn, ReportAction.ban],
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('actions');
  });

  it('fails validation when dismiss is combined with delete_content or warn', async () => {
    const invalidCombos = [
      [ReportAction.dismiss, ReportAction.delete_content],
      [ReportAction.dismiss, ReportAction.warn],
      [ReportAction.dismiss, ReportAction.ban],
    ];

    for (const actions of invalidCombos) {
      const dto = plainToInstance(UpdateReportDto, { actions });
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe('actions');
    }
  });

  it('fails validation when status is action_taken and actions array is empty', async () => {
    const dto = plainToInstance(UpdateReportDto, {
      status: ReportStatus.action_taken,
      actions: [],
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('actions');
  });

  it('rejects excessive ban_duration_days and resolves blank descriptions/notes to null', async () => {
    const badDays = plainToInstance(UpdateReportDto, {
      ban_duration_days: 36501,
    });
    expect(
      (await validate(badDays)).some((e) => e.property === 'ban_duration_days'),
    ).toBe(true);

    const cleared = plainToInstance(UpdateReportDto, {
      resolution_description: '   ',
      resolution_notes: '',
    });
    expect(await validate(cleared)).toHaveLength(0);
    expect(cleared.resolution_description).toBeNull();
    expect(cleared.resolution_notes).toBeNull();
  });
});
