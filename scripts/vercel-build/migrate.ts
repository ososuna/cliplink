// vercel.json runs this before `pnpm build`. Run with Node 24 (it strips the types).
import { execFileSync } from 'node:child_process';
import { shouldMigrate } from './should-migrate.ts';

const { migrate, reason } = shouldMigrate(process.env);
console.log(reason);
if (migrate) execFileSync('pnpm', ['db:migrate'], { stdio: 'inherit' });
