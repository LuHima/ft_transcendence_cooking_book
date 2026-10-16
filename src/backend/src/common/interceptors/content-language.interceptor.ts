import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Global response interceptor that inspects localized response payloads
 * and attaches the RFC 9110 `Content-Language: <resolved_lang>` response header.
 */
@Injectable()
export class ContentLanguageInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();

    return next.handle().pipe(
      tap((data) => {
        let lang: string | undefined;

        // 1. Inspect data payload for resolved_lang
        if (data && typeof data === 'object') {
          if ('resolved_lang' in data && typeof data.resolved_lang === 'string') {
            lang = data.resolved_lang;
          } else if (
            Array.isArray(data) &&
            data.length > 0 &&
            data[0]?.resolved_lang &&
            typeof data[0].resolved_lang === 'string'
          ) {
            lang = data[0].resolved_lang;
          } else if (
            Array.isArray(data?.items) &&
            data.items.length > 0 &&
            data.items[0]?.resolved_lang &&
            typeof data.items[0].resolved_lang === 'string'
          ) {
            lang = data.items[0].resolved_lang;
          }
        }

        // 2. Fallback to valid query parameter if present
        if (!lang && req?.query?.lang) {
          const qLang = req.query.lang;
          if (qLang === 'it' || qLang === 'en' || qLang === 'fr') {
            lang = qLang;
          }
        }

        // 3. Attach standard RFC 9110 Content-Language response header
        if (lang && res && typeof res.setHeader === 'function') {
          res.setHeader('Content-Language', lang);
        }
      }),
    );
  }
}
