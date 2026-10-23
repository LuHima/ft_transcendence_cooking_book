# 7. Consolidated Global Exception Filtering Strategy

We decided to implement a single, consolidated `GlobalExceptionFilter` using the Dispatcher Pattern to handle HTTP exceptions, Prisma database errors, and unexpected server failures in one centralized place, eliminating NestJS filter registration order risks.

## Context
Previously, error handling was split across `HttpExceptionFilter` and `PrismaExceptionFilter`. With the requirement to ensure 100% of uncaught errors return a consistent `ApiErrorResponseDto` envelope (`{ statusCode, timestamp, path, message }`), we needed a catch-all mechanism.

In NestJS, multiple global filters registered in `app.useGlobalFilters(...)` execute in **reverse registration order (LIFO)**. A three-filter approach (`AllExceptionsFilter`, `HttpExceptionFilter`, `PrismaExceptionFilter`) introduces a subtle ordering trap: if developers reorder the filters in `main.ts`, an unbound catch-all filter can accidentally intercept and mask specific Prisma errors before the specialized Prisma filter runs. Furthermore, having `PrismaExceptionFilter` manually instantiate and delegate to `HttpExceptionFilter` introduced tight coupling and bypassed the NestJS filter pipeline.

## Decision
We replace the separate/coupled filters with a single, unified `GlobalExceptionFilter` registered globally via `app.useGlobalFilters(new GlobalExceptionFilter())`:

1. **Catch-All Entrypoint (`@Catch()`)**:
   - The filter intercepts all exceptions thrown across controllers, services, guards, and interceptors.

2. **Explicit Type-Based Dispatching**:
   - **Prisma Client Known Request Errors (`PrismaClientKnownRequestError`)**:
     - `P2002` (Unique constraint violation) $\rightarrow$ Returns `400 Bad Request` or `409 Conflict` with clear field name indication.
     - `P2003` (Foreign key violation) $\rightarrow$ Returns `400 Bad Request` indicating the invalid foreign key.
     - `P2025` (Record not found) $\rightarrow$ Returns `404 Not Found`.
     - Other Prisma known request codes $\rightarrow$ Return `500 Internal Server Error` with server-side diagnostic logging.
   - **Prisma Infrastructure Errors (`PrismaClientInitializationError`, `PrismaClientRustPanicError`)**:
     - Database connection drops and engine initialization failures log database diagnostics server-side and return `500 Internal Server Error` without leaking database credentials or hostnames.
   - **Standard NestJS HTTP Exceptions (`HttpException`)**:
     - Statuses `< 500`: Logged as warnings with method and URL; client validation error arrays and messages are passed through faithfully.
     - Statuses $\ge 500$: Logged as errors with full stack trace; client message is strictly masked with `"Internal server error"`.
   - **Unhandled Generic Errors (`Error`, syntax errors, unknown exceptions)**:
     - Return `500 Internal Server Error` with generic `"Internal server error"` message.
     - Full stack trace logged to server console via NestJS `Logger.error`.

3. **Single Source of Truth for JSON Envelope**:
   - The uniform error envelope:
     ```json
     {
       "statusCode": 500,
       "timestamp": "2026-10-15T18:00:00.000Z",
       "path": "/api/recipes",
       "message": "Internal server error"
     }
     ```
     is formatted in exactly one place.

## Consequences
- **Zero Registration Ordering Traps**: Impossible for misordered array definitions in `main.ts` to break Prisma or HTTP error handling.
- **Single Source of Truth**: Guaranteed 100% consistency for all error responses across the entire application.
- **Database Security**: Technical database errors, schema details, and credentials are never exposed to API consumers.
- **Maintainability & Testability**: A single, comprehensive unit test suite verifies all error branches (HTTP 4xx, DTO arrays, Prisma codes, DB connection drops, and generic 500s).
