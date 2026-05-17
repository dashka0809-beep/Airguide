/**
 * schemas/chat.js — POST /api/chat-ийн Zod validation
 *
 * Frontend нь ярианы түүхийг бүтнээр илгээнэ (stateless backend).
 * Урт/тоог хязгаарлаж зардал/abuse-аас сэргийлнэ.
 */

import { z } from 'zod';

export const chatBodySchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant']),
      content: z.string().min(1).max(4000)
    })
  ).min(1).max(30)
}).refine(
  m => m.messages[m.messages.length - 1].role === 'user',
  { message: 'Сүүлийн message нь user байх ёстой', path: ['messages'] }
);
