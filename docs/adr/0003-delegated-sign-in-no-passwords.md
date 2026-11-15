# Sign-in delegated to Better Auth, Google and GitHub only, no passwords

Cliplink stores no passwords. Better Auth handles sign-in through Google and GitHub as an OAuth client (Authorization Code with PKCE and state) and keeps database sessions in HttpOnly cookies. The email and password plugin is not enabled. This replaces the hand-rolled JWT, bcrypt, password reset, and OAuth code from cliplink-rest, which had no OAuth state check and accepted refresh tokens as access tokens.

A sign-in from a second Provider with the same verified email joins the existing User, via Better Auth's trusted providers. Better Auth warns that trusted providers raise account-takeover risk. We accept it because Google and GitHub both verify emails, and unverified GitHub emails are never linked.

## Considered Options

- **Auth.js**: its Astro support is a community package (auth-astro).
- **One User per Provider, never linked** (the old behaviour): simpler, but the same person ends up with two separate lists of Links.
