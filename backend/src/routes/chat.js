/**
 * routes/chat.js
 *
 * POST /chat   AI туслахтай ярих (нээлттэй, rate-limit-тэй)
 * GET  /chat/health   Chat идэвхтэй эсэх
 */

import { chatBodySchema } from '../schemas/chat.js';
import { chat } from '../services/chat.js';
import { config } from '../config.js';

export default async function chatRoutes(fastify) {
  fastify.get('/chat/health', async () => ({
    enabled: config.chat.enabled,
    model: config.chat.enabled ? config.chat.model : null
  }));

  fastify.post('/chat', async (req, reply) => {
    const { messages } = chatBodySchema.parse(req.body);
    try {
      const { reply: text, usage } = await chat(messages);
      return {
        data: {
          reply: text,
          usage: usage ? {
            input: usage.input_tokens,
            output: usage.output_tokens,
            cache_read: usage.cache_read_input_tokens ?? 0,
            cache_write: usage.cache_creation_input_tokens ?? 0
          } : null
        }
      };
    } catch (err) {
      if (err.code === 'CHAT_DISABLED') {
        reply.code(503);
        return { error: { code: 'CHAT_DISABLED', message: err.message } };
      }
      req.log.error(err, 'chat failed');
      reply.code(502);
      return { error: { code: 'CHAT_ERROR', message: 'AI туслах түр ажиллахгүй байна' } };
    }
  });
}
