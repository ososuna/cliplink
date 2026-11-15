# One Astro app at the root, not a workspace monorepo

Cliplink merged its UI repo (Astro) and API repo (Express) into one repo. Only the UI ever called the API, so the API became Astro server endpoints and Actions inside the same app, giving one deployable on one host. With one deployable there is nothing to share between packages, so the repo is a single app at the root with no pnpm workspace or Turborepo. Convert to a workspace when a second deployable appears (a CLI, a browser extension, a worker).

## Consequences

- The Redirect and the app share a host, so session cookies are same-site and there is no CORS.
- The old public REST API is gone. Nothing outside the UI used it.
- Cliplink runs on Vercel Hobby, which allows personal, non-commercial use only. Adding ads, a paid tier, or any revenue means moving to Vercel Pro first.
