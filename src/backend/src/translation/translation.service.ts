import { BadRequestException, Injectable, Logger } from '@nestjs/common';

export interface LanguageDetectionResult {
  language: string;
  confidence: number;
}

export interface BatchTranslationResult {
  translations: string[];
  success: boolean;
}

@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);
  private readonly baseUrl =
    process.env.LIBRETRANSLATE_URL || 'http://libretranslate:5000';
  private readonly timeoutMs =
    Number(process.env.LIBRETRANSLATE_TIMEOUT_MS) || 5000;

  async detectLanguage(text: string): Promise<LanguageDetectionResult | null> {
    try {
      // API request to LibreTranslate
      const response = await fetch(`${this.baseUrl}/detect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as Array<{
        confidence: number;
        language: string;
      }>;
      if (!Array.isArray(data) || data.length === 0) {
        return null;
      }

      const rawConf = data[0].confidence;
      const confidence = rawConf > 1 ? rawConf / 100 : rawConf;

      return {
        language: data[0].language,
        confidence,
      };
    } catch (error) {
      this.logger.warn(`Language detection failed: ${error}`);
      return null;
    }
  }

  async verifySourceLanguage(
    text: string,
    declaredLang: string,
  ): Promise<void> {
    const detection = await this.detectLanguage(text);
    if (!detection) {
      return;
    }

    if (
      detection.language.toLowerCase() !== declaredLang.toLowerCase() &&
      detection.confidence > 0.85
    ) {
      throw new BadRequestException(
        `Declared language '${declaredLang}' does not match detected language '${detection.language}' (${Math.round(detection.confidence * 100)}% confidence)`,
      );
    }
  }

  async translateBatch(
    texts: string[],
    sourceLang: string,
    targetLang: string,
  ): Promise<BatchTranslationResult> {
    if (texts.length === 0) {
      return { translations: [], success: true };
    }

    // Send only non-empty strings so LibreTranslate cannot drop or collapse
    // empty optional fields and shift subsequent step indices
    const nonEmptyIndices: number[] = [];
    const nonEmptyTexts: string[] = [];
    texts.forEach((text, index) => {
      if (text.trim().length > 0) {
        nonEmptyIndices.push(index);
        nonEmptyTexts.push(text);
      }
    });

    if (nonEmptyTexts.length === 0) {
      return { translations: [...texts], success: true };
    }

    try {
      const response = await fetch(`${this.baseUrl}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: nonEmptyTexts,
          source: sourceLang,
          target: targetLang,
          format: 'text',
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        this.logger.warn(
          `LibreTranslate returned status ${response.status}: ${response.statusText}`,
        );
        return { translations: texts, success: false };
      }

      const data = (await response.json()) as {
        translatedText?: unknown;
      };

      const translatedItems = Array.isArray(data.translatedText)
        ? data.translatedText
        : typeof data.translatedText === 'string' && nonEmptyTexts.length === 1
          ? [data.translatedText]
          : null;

      if (
        !translatedItems ||
        translatedItems.length !== nonEmptyTexts.length ||
        !translatedItems.every((item): item is string => typeof item === 'string')
      ) {
        this.logger.warn(
          `LibreTranslate batch response mismatch: expected ${nonEmptyTexts.length} strings, got ${Array.isArray(data.translatedText) ? data.translatedText.length : typeof data.translatedText}`,
        );
        return { translations: texts, success: false };
      }

      const translations = [...texts];
      nonEmptyIndices.forEach((originalIndex, batchIndex) => {
        translations[originalIndex] = translatedItems[batchIndex];
      });

      return {
        translations,
        success: true,
      };
    } catch (error) {
      this.logger.warn(`Batch translation failed: ${error}`);
      return {
        translations: texts,
        success: false,
      };
    }
  }
}
