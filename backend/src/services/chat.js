/**
 * services/chat.js — Air Guide AI туслах (Claude Messages API + tool use)
 *
 * - Загвар: config.chat.model (default claude-haiku-4-5 — хамгийн хямд)
 * - Tool use: search_airports / search_flights / get_booking → манай DB
 * - Prompt caching: system + tools-д cache_control (тогтвортой prefix)
 * - Гар (manual) agentic loop: stop_reason === 'tool_use' хүртэл давтана
 * - Хоёр хэл: хэрэглэгчийн бичсэн хэлээр (Монгол/Англи) хариулна
 *
 * ⚠️ Caching тэмдэглэл: Haiku 4.5-ийн хамгийн бага cache-лэгдэх prefix
 * нь ~4096 token. System+tools үүнээс богино бол cache_read 0 байж
 * магадгүй (алдаа биш — зүгээр идэвхжихгүй). Яриа уртсах тусам prefix
 * өснө. Sonnet руу солих бол config CHAT_MODEL=claude-sonnet-4-6.
 */

import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config.js';
import { searchAirports, searchFlights } from './search.js';
import { getBookingByCode } from './booking.js';

const client = config.chat.enabled
  ? new Anthropic({ apiKey: config.chat.apiKey })
  : null;

const MAX_TOOL_ITERATIONS = 5;
const MAX_TOKENS = 1500;

const SYSTEM_PROMPT = `Чи бол **Air Guide** нислэгийн тийз захиалгын вэбсайтын AI туслах.

# Хэл / Language
- Хэрэглэгч Монголоор бичвэл Монголоор, Англиар бичвэл Англиар хариул.
- Detect the user's language from their message and reply in that same language.
- Найрсаг, товч, тодорхой бай. Үнийг ₮ (MNT) тэмдэгтээр форматла.

# Чи юу хийж чадах вэ
- Нисэх буудал/хот хайх (search_airports)
- Нислэг хайж үнэ, цаг, суудал харуулах (search_flights)
- Захиалгын кодоор захиалгын төлөв шалгах (get_booking)

# Tool ашиглах дүрэм
- Хэрэглэгч хотын нэр хэлвэл (ж: "Сөүл", "Tokyo") эхлээд search_airports-аар
  IATA код (3 үсэг) олж, дараа нь search_flights дууд.
- Огноо ЗААВАЛ YYYY-MM-DD форматтай. Манай нислэгийн өгөгдөл зөвхөн
  2026-05-20-аас 2026-09-30 хооронд байгаа. Хэрэглэгч "маргааш" гэх мэт
  хэлвэл өнөөдрийн огноо мэдэхгүй тул тодорхой огноо асуу.
- Нислэг олдохгүй бол өөр ойролцоо огноо/чиглэл санал болго.
- Захиалга шалгахад код асуу (формат: AG + 5 тэмдэгт, ж: AG7X9P2).
- Tool-ийн буцаасан өгөгдлийг л ашигла. Үнэ, нислэг, захиалга
  ЗОХИОЖ БҮҮ ХЭЛ. Мэдэхгүй бол "мэдэхгүй байна" гэж хэл.

# Хязгаарлалт
- Чи зөвхөн МЭДЭЭЛЭЛ өгнө. Захиалга үүсгэх/цуцлахыг чи хийхгүй —
  хэрэглэгчийг вэбсайтын "Захиалах" эсвэл "Захиалга шалгах" хэсэг рүү
  чиглүүл.
- Нислэгийн бус асуултад эелдэгээр "Би нислэгийн тусламж л үзүүлдэг"
  гэж хариул.
- Хувийн нууц мэдээлэл (паспорт, картын дугаар) бүү асуу.

Богино, тустай, бодит хариулт өг.`;

const TOOLS = [
  {
    name: 'search_airports',
    description: 'Хот эсвэл нисэх буудлын нэрээр IATA код (3 үсэг) хайх. ' +
      'Хэрэглэгч хотын нэр хэлвэл flight хайхаас өмнө үүгээр код ол.',
    input_schema: {
      type: 'object',
      properties: {
        q: { type: 'string', description: 'Хот эсвэл буудлын нэр, ж: "Сөүл", "Tokyo", "ULN"' }
      },
      required: ['q']
    }
  },
  {
    name: 'search_flights',
    description: 'Нэг чиглэлийн нэг өдрийн нислэгүүдийг үнэ, цаг, ' +
      'суудлын хамт хайх. from/to нь IATA код (3 үсэг), огноо YYYY-MM-DD.',
    input_schema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Хөөрөх буудлын IATA код, ж: ULN' },
        to: { type: 'string', description: 'Очих буудлын IATA код, ж: ICN' },
        departure_date: { type: 'string', description: 'Явах огноо YYYY-MM-DD (2026-05-20 ~ 2026-09-30)' }
      },
      required: ['from', 'to', 'departure_date']
    }
  },
  {
    name: 'get_booking',
    description: 'Захиалгын кодоор захиалгын төлөв, төлбөр, билетийг шалгах.',
    input_schema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'Захиалгын код, ж: AG7X9P2' }
      },
      required: ['code']
    }
  }
];

/** Tool-ийг гүйцэтгэж compact үр дүн (string) буцаана */
async function runTool(name, input) {
  try {
    if (name === 'search_airports') {
      const data = await searchAirports(String(input.q || '').trim());
      return JSON.stringify(data.length ? data : { note: 'no airports found' });
    }
    if (name === 'search_flights') {
      const data = await searchFlights({
        from: input.from, to: input.to, departure_date: input.departure_date
      });
      return JSON.stringify(
        data.length ? { count: data.length, flights: data }
                    : { note: 'no flights on this route/date', count: 0 }
      );
    }
    if (name === 'get_booking') {
      const b = await getBookingByCode(String(input.code || '').trim().toUpperCase());
      if (!b) return JSON.stringify({ note: 'booking not found' });
      return JSON.stringify({
        booking_code: b.booking_code,
        status: b.status,
        customer: b.customer?.name,
        total_mnt: b.total_amount,
        paid_mnt: b.paid_amount,
        balance_mnt: b.balance_due,
        tickets: (b.tickets || []).map(t => ({
          no: t.ticket_number, status: t.status,
          flight: t.flight?.flight_number,
          route: `${t.flight?.origin?.code}→${t.flight?.destination?.code}`
        }))
      });
    }
    return JSON.stringify({ error: `unknown tool: ${name}` });
  } catch (e) {
    return JSON.stringify({ error: e.message || 'tool failed' });
  }
}

/**
 * Чат — messages нь [{role:'user'|'assistant', content:string}, ...]
 * @returns {Promise<{reply:string, usage:object}>}
 */
export async function chat(messages) {
  if (!client) {
    const err = new Error('Chat үйлчилгээ идэвхгүй (ANTHROPIC_API_KEY тохируулаагүй)');
    err.code = 'CHAT_DISABLED';
    err.statusCode = 503;
    throw err;
  }

  // Дотоод ажлын message массив (tool_use/tool_result блокуудтай өснө)
  const convo = messages.map(m => ({ role: m.role, content: m.content }));

  let lastUsage = null;
  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    const resp = await client.messages.create({
      model: config.chat.model,
      max_tokens: MAX_TOKENS,
      // Render order: tools → system → messages.
      // cache_control-г сүүлийн system блок дээр тавьснаар tools+system
      // хоёуланг нэг prefix болгож cache-лнэ (тогтвортой тул дахин ашиглана).
      system: [
        { type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }
      ],
      tools: TOOLS,
      messages: convo
    });
    lastUsage = resp.usage;

    if (resp.stop_reason === 'tool_use') {
      // Assistant-ийн бүх content-г (tool_use блокуудтай) түүхэнд нэмнэ
      convo.push({ role: 'assistant', content: resp.content });

      // tool_use блок бүрд нэг tool_result
      const toolResults = [];
      for (const block of resp.content) {
        if (block.type === 'tool_use') {
          const result = await runTool(block.name, block.input);
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: result
          });
        }
      }
      convo.push({ role: 'user', content: toolResults });
      continue; // дахин Claude рүү
    }

    // tool_use биш → эцсийн хариу
    const text = resp.content
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim();
    return {
      reply: text || 'Уучлаарай, хариу үүсгэж чадсангүй. Дахин асууна уу.',
      usage: lastUsage
    };
  }

  // Loop guard
  return {
    reply: 'Уучлаарай, хүсэлт хэт төвөгтэй боллоо. Илүү тодорхой асууна уу.',
    usage: lastUsage
  };
}
