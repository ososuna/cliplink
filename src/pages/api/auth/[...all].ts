import type { APIRoute } from 'astro';
import { auth } from '@/app';

export const ALL: APIRoute = ({ request }) => auth.handler(request);
