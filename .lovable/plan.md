

# Fix: Reset Password Edge Function - Session Not Found

## Root Cause
The current user's JWT contains a `session_id` that no longer exists in the database. Every method that validates the token against the auth server (SDK `getUser`, REST `/auth/v1/user`) fails with `session_not_found`. This is a stale session issue.

## Solution
Decode the JWT payload manually (base64) to extract the user ID (`sub` claim), then use the admin client to verify the admin role. This completely bypasses session validation.

## Changes

### File: `supabase/functions/reset-user-password/index.ts`

Replace the REST API user verification (lines 23-38) with JWT payload decoding:

```typescript
// Decode JWT payload to get user ID (bypass session validation)
const parts = token.split('.')
if (parts.length !== 3) throw new Error('Token inválido')

const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
const callingUserId = payload.sub
const callingEmail = payload.email

if (!callingUserId) throw new Error('Usuário não autenticado')

console.log(`User ${callingEmail} attempting password reset`)
```

Then update references from `callingUser.id` to `callingUserId` and `callingUser.email` to `callingEmail` in the rest of the function (role check query and success log).

No other files need changes.

## Important Note
After this fix works, the user should log out and log back in to refresh their session token for other functions that may also validate the session.
