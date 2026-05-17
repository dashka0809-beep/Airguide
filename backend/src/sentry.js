/**
 * sentry.js — Алдааны хяналт (Sentry)
 *
 * SENTRY_DSN тохируулаагүй бол бүх функц no-op — апп хэвийн ажиллана
 * (chat-ийн ANTHROPIC_API_KEY-тэй ижил graceful загвар).
 *
 * Railway-д SENTRY_DSN нэмэхэд автомат идэвхжинэ. Код өөрчлөх
 * шаардлагагүй.
 */

import { config } from './config.js';

let Sentry = null;

if (config.sentry.enabled) {
  try {
    Sentry = await import('@sentry/node');
    Sentry.init({
      dsn: config.sentry.dsn,
      environment: config.env,
      // 10% trace — зардал/чимээг бага байлгана
      tracesSampleRate: 0.1,
      // PII (passport, password г.м) бүү илгээ
      sendDefaultPii: false
    });

    // Boot self-test — холболт ажиллаж байгааг шууд шалгаж,
    // Railway log дээр үр дүнг хэвлэнэ (асуудлыг ил болгоно).
    try {
      Sentry.captureMessage('[boot] Airguide Sentry connectivity test', 'info');
      const flushed = await Sentry.flush(5000);
      console.log(`[sentry] init OK — boot test flushed: ${flushed}`);
    } catch (e) {
      console.error('[sentry] boot test failed:', e);
    }
  } catch (e) {
    console.error('[sentry] init failed (continuing without):', e.message);
    Sentry = null;
  }
}

export const sentryEnabled = Boolean(Sentry);

/** Алдаа барих — Sentry идэвхгүй бол no-op */
export function captureException(err, context) {
  if (!Sentry) return;
  try {
    if (context) {
      Sentry.withScope((scope) => {
        scope.setContext('request', context);
        Sentry.captureException(err);
      });
    } else {
      Sentry.captureException(err);
    }
    // Урт хугацааны серверт ч албадан флаш хийж, илгээлтийг
    // баталгаажуулна (fire-and-forget — үндсэн ажлыг блоклохгүй).
    Sentry.flush(2000)
      .then((ok) => { if (!ok) console.warn('[sentry] flush incomplete (event may be delayed)'); })
      .catch((e) => console.error('[sentry] flush error:', e));
  } catch (e) {
    // Sentry-н алдаа үндсэн ажлыг блоклохгүй — гэхдээ ХАРАГДАХ ёстой
    console.error('[sentry] captureException failed:', e);
  }
}
