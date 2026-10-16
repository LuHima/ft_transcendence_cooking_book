import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { ContentLanguageInterceptor } from './content-language.interceptor';

describe('ContentLanguageInterceptor', () => {
  let interceptor: ContentLanguageInterceptor;
  let mockResponse: { setHeader: jest.Mock };
  let mockRequest: { query: Record<string, any> };
  let mockContext: ExecutionContext;

  beforeEach(() => {
    interceptor = new ContentLanguageInterceptor();
    mockResponse = {
      setHeader: jest.fn(),
    };
    mockRequest = {
      query: {},
    };
    mockContext = {
      switchToHttp: () => ({
        getRequest: () => mockRequest,
        getResponse: () => mockResponse,
      }),
    } as unknown as ExecutionContext;
  });

  it('sets Content-Language header from resolved_lang property on an object response', (done) => {
    const data = { id: 1, title: 'Carbonara', resolved_lang: 'it' };
    const callHandler: CallHandler = {
      handle: () => of(data),
    };

    interceptor.intercept(mockContext, callHandler).subscribe({
      next: (val) => {
        expect(val).toEqual(data);
        expect(mockResponse.setHeader).toHaveBeenCalledWith(
          'Content-Language',
          'it',
        );
        done();
      },
    });
  });

  it('sets Content-Language header from resolved_lang of items in an array response', (done) => {
    const data = [
      { id: 1, name: 'Tradizionale', resolved_lang: 'it' },
      { id: 2, name: 'Veloce', resolved_lang: 'it' },
    ];
    const callHandler: CallHandler = {
      handle: () => of(data),
    };

    interceptor.intercept(mockContext, callHandler).subscribe({
      next: (val) => {
        expect(val).toEqual(data);
        expect(mockResponse.setHeader).toHaveBeenCalledWith(
          'Content-Language',
          'it',
        );
        done();
      },
    });
  });

  it('sets Content-Language header from items[0].resolved_lang in a paginated envelope response', (done) => {
    const data = {
      items: [{ id: 42, title: 'Soupe', resolved_lang: 'fr' }],
      total: 1,
      page: 1,
      limit: 20,
    };
    const callHandler: CallHandler = {
      handle: () => of(data),
    };

    interceptor.intercept(mockContext, callHandler).subscribe({
      next: (val) => {
        expect(val).toEqual(data);
        expect(mockResponse.setHeader).toHaveBeenCalledWith(
          'Content-Language',
          'fr',
        );
        done();
      },
    });
  });

  it('falls back to req.query.lang when the response array is empty', (done) => {
    mockRequest.query = { lang: 'fr', search: 'nonexistent' };
    const data: any[] = [];
    const callHandler: CallHandler = {
      handle: () => of(data),
    };

    interceptor.intercept(mockContext, callHandler).subscribe({
      next: (val) => {
        expect(val).toEqual(data);
        expect(mockResponse.setHeader).toHaveBeenCalledWith(
          'Content-Language',
          'fr',
        );
        done();
      },
    });
  });

  it('does not set Content-Language header when no resolved_lang or query lang is present', (done) => {
    const data = { id: 1, username: 'chef_mario' };
    const callHandler: CallHandler = {
      handle: () => of(data),
    };

    interceptor.intercept(mockContext, callHandler).subscribe({
      next: (val) => {
        expect(val).toEqual(data);
        expect(mockResponse.setHeader).not.toHaveBeenCalled();
        done();
      },
    });
  });
});
