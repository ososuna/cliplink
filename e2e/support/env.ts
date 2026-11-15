/** The environment the e2e server runs with. The session helper signs cookies with the same secret. */
export const e2eEnv = {
  DATABASE_URL:
    process.env.DATABASE_URL ??
    'postgres://postgres:postgres@localhost:5433/cliplink',
  BETTER_AUTH_URL: 'http://localhost:4321',
  BETTER_AUTH_SECRET: 'e2e-secret-only-for-playwright-not-for-real-use',
  // Placeholders: no e2e test completes a real OAuth round trip.
  GOOGLE_CLIENT_ID: 'e2e-google-client',
  GOOGLE_CLIENT_SECRET: 'e2e-google-secret',
  GITHUB_CLIENT_ID: 'e2e-github-client',
  GITHUB_CLIENT_SECRET: 'e2e-github-secret',
};
