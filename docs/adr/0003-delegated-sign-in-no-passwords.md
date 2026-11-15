# Sign-in delegated to Better Auth, Google and GitHub only, no passwords

Cliplink stores no passwords. Better Auth handles sign-in through Google and GitHub as an OAuth client (Authorization Code with PKCE and state) and keeps database sessions in HttpOnly cookies. The email and password plugin is not enabled. This replaces the hand-rolled JWT, bcrypt, password reset, and OAuth code from cliplink-rest, which had no OAuth state check and accepted refresh tokens as access tokens.

A sign-in from a second Provider with the same verified email joins the existing User.

## Amendments

**2026-11-15: link by the Provider's verification, not trusted providers.** Better Auth 1.7 links a sign-in from a trusted provider even when that Provider reports the email as unverified, so listing Google and GitHub in `trustedProviders` would let an unverified GitHub email take over an existing User. Cliplink leaves `trustedProviders` unset. Better Auth then links only when the Provider says the email is verified and the existing User's email is verified too. Because emails are unique per User, an unverified same-email sign-in does not become a second User either: Better Auth refuses it with `account_not_linked`, and the sign-in page explains why.

**2026-11-15: no password column.** Better Auth's generated schema always includes `account.password`, even with email and password sign-in off. Cliplink removes it from the schema and migrations. Better Auth's startup schema check expects that column, so it is turned off (`advanced.database.validateSchema: false`), and a Vitest test that signs in through Better Auth against the real migrations takes its place. Remove the column again whenever the schema is regenerated.

## Considered Options

- **Auth.js**: its Astro support is a community package (auth-astro).
- **One User per Provider, never linked** (the old behaviour): simpler, but the same person ends up with two separate lists of Links.
