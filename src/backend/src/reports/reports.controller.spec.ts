import { Test, TestingModule } from '@nestjs/testing';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { ReportReason, ReportStatus, ReportSubject } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';

describe('ReportsController', () => {
  let controller: ReportsController;

  const mockReportsService = {
    createReport: jest.fn(),
    getReports: jest.fn(),
    updateReport: jest.fn(),
  };

  const mockJwtService = {
    verifyAsync: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        {
          provide: ReportsService,
          useValue: mockReportsService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    controller = module.get<ReportsController>(ReportsController);
    jest.clearAllMocks();
  });

  describe('createReport', () => {
    it('delegates report submission to reportsService.createReport', async () => {
      const dto = {
        subject: ReportSubject.recipe,
        target_id: 10,
        reason: ReportReason.harassment_bullying,
        description: 'Abusive content',
      };
      const expectedResult = {
        id: 1,
        reporter_id: 5,
        ...dto,
        status: ReportStatus.pending,
        resolution_notes: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockReportsService.createReport.mockResolvedValueOnce(expectedResult);

      const result = await controller.createReport(5, dto);

      expect(mockReportsService.createReport).toHaveBeenCalledWith(5, dto);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getReports', () => {
    it('delegates queue listing to reportsService.getReports with lang parameter forwarding', async () => {
      const query = {
        page: 1,
        limit: 20,
        status: ReportStatus.pending,
        lang: 'it' as const,
      };
      const expectedEnvelope = {
        items: [],
        total: 0,
        page: 1,
        limit: 20,
        total_pages: 0,
        has_next_page: false,
        has_prev_page: false,
      };
      mockReportsService.getReports.mockResolvedValueOnce(expectedEnvelope);

      const result = await controller.getReports(query);

      expect(mockReportsService.getReports).toHaveBeenCalledWith(query);
      expect(result).toEqual(expectedEnvelope);
    });
  });

  describe('updateReport', () => {
    it('delegates report status modification to reportsService.updateReport', async () => {
      const dto = {
        status: ReportStatus.reviewed,
        resolution_notes: 'Reviewed and closed',
      };
      const caller = { id: 2, role: 'moderator' as any };
      const expectedResult = {
        id: 1,
        reporter_id: 5,
        subject: ReportSubject.recipe,
        target_id: 10,
        reason: ReportReason.harassment_bullying,
        description: null,
        status: ReportStatus.reviewed,
        resolution_notes: 'Reviewed and closed',
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockReportsService.updateReport.mockResolvedValueOnce(expectedResult);

      const result = await controller.updateReport(1, dto, caller);

      expect(mockReportsService.updateReport).toHaveBeenCalledWith(
        1,
        dto,
        caller,
      );
      expect(result).toEqual(expectedResult);
    });
  });
});
