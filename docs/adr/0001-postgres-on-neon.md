# Postgres on Neon instead of MongoDB

Cliplink moved from MongoDB Atlas to Postgres on Neon's free plan, connected through the Vercel Marketplace. The move does not save money: both Atlas M0 and Neon Free cost $0 at Cliplink's traffic. We moved because the data is relational (Users own Links, Names are unique per Owner, and Better Auth needs user, account, and session tables), and because Neon gives each Vercel preview deploy its own database branch.

## Considered Options

- **Stay on MongoDB Atlas M0**: free, but ownership and per-Owner uniqueness are relational constraints that Mongo can't enforce well, and Better Auth's Mongo adapter is less common than its SQL adapters.
- **Supabase Free**: Postgres too, but free projects pause after 7 days without activity, which would break every Redirect.

## Consequences

- Neon scales to zero, so the first Redirect after an idle period pays a cold start of a few hundred milliseconds.
- Free plan limits (checked November 2026): 100 CU-hours of compute per month and 1 GB of storage per project. Writes fail when storage is full; Neon doesn't bill overages on Free. Upgrade when either limit gets close.
