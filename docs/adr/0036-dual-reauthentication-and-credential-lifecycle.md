# 0036: Dual Re-authentication, Self-Service Password Lifecycle, and 2FA Session Eviction

---
status: accepted
---

We decided to introduce **Dual Re-authentication** (local password or fresh Google OpenID Connect ID token) for sensitive account security operations (`POST /api/auth/twofactor/enable`, `POST /api/auth/twofactor/disable`, and `PATCH /api/auth/password`), expose `is_two_factor_enabled`, `has_password`, and `is_google_linked` on `GET /api/users/me`, revoke other active `JwtSession`s on password updates and 2FA disablement, and keep credentials append-only.

## Context

1. **Passwordless OAuth Accounts Blocked from 2FA**: Users provisioned via `POST /api/auth/signin/google` have `password_hash = null`. Previously, `POST /api/auth/twofactor/enable` and `POST /api/auth/twofactor/disable` required a non-empty `password` in `ConfirmPasswordDto` and unconditionally passed `password_hash` to `bcrypt.compare`, blocking **Passwordless OAuth Accounts** from managing 2FA.
2. **Missing Self-Service Password Lifecycle**: Regular users had no endpoint to set a local password on a **Passwordless OAuth Account** or rotate an existing password.
3. **Hybrid Account Flexibility**: Users who link Google to an existing email/password account—or set a password on a Google-provisioned account—become **Hybrid Accounts** and should be able to confirm sensitive actions with whichever credential they prefer.

## Decision

1. **Dual Re-authentication (`ConfirmPasswordDto`, `ChangePasswordDto`, `AuthService.assertReauthenticated`)**:
   - `POST /api/auth/twofactor/enable`, `POST /api/auth/twofactor/disable`, and `PATCH /api/auth/password` all require fresh re-authentication:
     - If `password` / `currentPassword` is supplied, it is verified against `user.password_hash` via `bcrypt.compare`.
     - If `idToken` is supplied, it is verified via `AuthService.verifyGoogleIdToken` (audience, signature, `email_verified === true`) and its `sub` claim must match `user.id_google`.
     - If neither is supplied, the request is rejected with `401 Unauthorized`.
   - Keeping `{ password }` or `{ idToken }` non-empty also preserves compatibility with `GlobalNotEmptyBodyPipe` without adding route exceptions.
2. **Session Eviction Policy (`JwtSession`)**:
   - `PATCH /api/auth/password` and `POST /api/auth/twofactor/disable` revoke all other active `JwtSession` rows (`id_user = id AND id_session != currentSessionId`), preserving only the caller's current session so compromised or stale refresh tokens cannot persist after credential/2FA weakening.
   - `POST /api/auth/twofactor/enable` leaves existing sessions intact so other devices are not unexpectedly logged out during TOTP setup.
3. **Append-Only Credentials Invariant**:
   - Credentials (`password_hash` and `id_google`) are append-only once set or linked. There is intentionally no self-service "remove password" or "unlink Google" endpoint, preventing accidental account lockout.
4. **Profile Capability Flags (`GET /api/users/me`)**:
   - `UserProfileResponseDto` exposes `is_two_factor_enabled`, `has_password` (`Boolean(password_hash)`), and `is_google_linked` (`Boolean(id_google)`) without ever exposing `password_hash` or `id_google`.

## Considered Options

- **Allow empty body on 2FA endpoints for Google-only users**: Rejected because it weakens re-authentication on an unlocked session and would require bypassing `GlobalNotEmptyBodyPipe`.
- **Force Google-only users to set a password before enabling 2FA**: Rejected because it forces unwanted password creation and expands the credential attack surface for users who chose OAuth.
- **Revoke all sessions including the current one on password change / 2FA disable**: Rejected to avoid logging out the user's active browser tab immediately after a legitimate settings update.

## Consequences

- **Positive**: **Passwordless OAuth Accounts** can enable/disable 2FA and set a local password using Google confirmation; **Hybrid Accounts** can choose either password or Google confirmation; disabling 2FA or changing passwords immediately evicts other refresh sessions.
- **Downstream**: Frontend profile/2FA flows must consume `has_password` and `is_google_linked` from `GET /api/users/me` and send `idToken` on `PATCH /api/auth/password` when `has_password === false` (or when the user chooses Google confirmation).
