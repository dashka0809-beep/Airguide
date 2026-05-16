/**
 * schemas/auth.js — Auth endpoint-уудын Zod validation
 */

import { z } from 'zod';

/** POST /auth/login */
export const loginBodySchema = z.object({
  username: z.string().trim().min(1).max(50),
  password: z.string().min(1).max(200)
});

/** POST /auth/refresh */
export const refreshBodySchema = z.object({
  refresh_token: z.string().min(10)
});
