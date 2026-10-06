import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TranslationService } from './translation.service';

describe('TranslationService', () => {
  let service: TranslationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TranslationService],
    }).compile();

    service = module.get<TranslationService>(TranslationService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('verifySourceLanguage', () => {
    it('resolves without throwing when detected language matches declared source_lang', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => [{ language: 'it', confidence: 0.95 }],
      } as any);

      await expect(
        service.verifySourceLanguage('Pasta al pesto fresco', 'it'),
      ).resolves.toBeUndefined();
    });

    it('throws BadRequestException when detected language differs from declared source_lang with confidence > 85%', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => [{ language: 'en', confidence: 0.95 }],
      } as any);

      await expect(
        service.verifySourceLanguage('This is a delicious recipe written in English', 'it'),
      ).rejects.toThrow(BadRequestException);
    });

    it('resolves without throwing when detected language differs but confidence is <= 85%', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => [{ language: 'en', confidence: 0.75 }],
      } as any);

      await expect(
        service.verifySourceLanguage('Risotto ai funghi porcini e parmigiano', 'it'),
      ).resolves.toBeUndefined();
    });

    it('resolves without throwing when LibreTranslate is offline or returns error', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error: connection refused'));

      await expect(
        service.verifySourceLanguage('Qualsiasi testo', 'it'),
      ).resolves.toBeUndefined();
    });
  });

  describe('translateBatch', () => {
    it('returns translated strings and success: true on successful translation', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          translatedText: ['Spaghetti carbonara', 'A delicious Roman dish'],
        }),
      } as any);

      const result = await service.translateBatch(
        ['Spaghetti alla carbonara', 'Un piatto romano delizioso'],
        'it',
        'en',
      );

      expect(result).toEqual({
        translations: ['Spaghetti carbonara', 'A delicious Roman dish'],
        success: true,
      });
    });

    it('returns empty array and success: true immediately when passed an empty array', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch');

      const result = await service.translateBatch([], 'it', 'en');

      expect(result).toEqual({
        translations: [],
        success: true,
      });
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('returns original texts with success: false when LibreTranslate returns HTTP 500', async () => {
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      } as any);

      const input = ['Tagliatelle al tartufo', 'Piatto raffinato'];
      const result = await service.translateBatch(input, 'it', 'fr');

      expect(result).toEqual({
        translations: input,
        success: false,
      });
    });

    it('returns original texts with success: false when network error or timeout occurs', async () => {
      jest.spyOn(global, 'fetch').mockRejectedValueOnce(
        new Error('Fetch timed out'),
      );

      const input = ['Polenta concia', 'Tipica ricetta valdostana'];
      const result = await service.translateBatch(input, 'it', 'en');

      expect(result).toEqual({
        translations: input,
        success: false,
      });
    });
  });
});
