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
  } catch (_) { /* Sentry-н алдаа үндсэн ажлыг блоклохгүй */ }
}
