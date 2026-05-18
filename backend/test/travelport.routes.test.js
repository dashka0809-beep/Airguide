/**
 * travelport.routes.test.js — route gating (creds байхгүй → 503)
 * CI-д TRAVELPORT_* тохируулаагүй тул config.travelport.enabled === false.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import Fastify from 'fastify';
import travelportRoutes from '../src/routes/travelport.js';

async function buildApp() {
  const app = Fastify();
  await app.register(travelportRoutes, { prefix: '/api' });
  return app;
}

test('GET /api/travelport/health returns a boolean enabled flag', async () => {
  const app = await buildApp();
  const r = await app.inject({ method: 'GET', url: '/api/travelport/health' });
  assert.equal(r.statusCode, 200);
  const j = r.json();
  assert.equal(typeof j.enabled, 'boolean');
  assert.equal(j.enabled, false); // no TRAVELPORT_* in test env
  assert.equal(typeof j.env, 'string');
  await app.close();
});

test('GET /api/travelport/test-search → 503 TRAVELPORT_DISABLED when no creds', async () => {
  const app = await buildApp();
  const r = await app.inject({
    method: 'GET',
    url: '/api/travelport/test-search?from=ULN&to=ICN&departure_date=2026-07-01'
  });
  assert.equal(r.statusCode, 503);
  assert.equal(r.json().error.code, 'TRAVELPORT_DISABLED');
  await app.close();
});
