/**
 * travelport.mapper.test.js — mapOffersToCompact цэвэр функцийн тест
 * Fixture: test/fixtures/travelport-search.sample.json (confirmed v11 schema)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { mapOffersToCompact } from '../src/services/travelport.js';

const sample = JSON.parse(readFileSync(
  fileURLToPath(new URL('./fixtures/travelport-search.sample.json', import.meta.url)),
  'utf8'
));

test('mapOffersToCompact returns a non-empty array', () => {
  const out = mapOffersToCompact(sample);
  assert.ok(Array.isArray(out));
  assert.equal(out.length, 2);
});

test('each compact item has the expected shape', () => {
  for (const f of mapOffersToCompact(sample)) {
    assert.equal(typeof f.flight, 'string');
    assert.equal(typeof f.airline, 'string');
    assert.equal(typeof f.route, 'string');
    assert.equal(typeof f.depart, 'string');
    assert.equal(typeof f.arrive, 'string');
    assert.ok(f.economy_mnt === null || typeof f.economy_mnt === 'number');
    assert.ok(f.seats_left === null || typeof f.seats_left === 'number');
  }
});

test('maps the first offer from the fixture exactly', () => {
  const [f] = mapOffersToCompact(sample);
  assert.equal(f.flight, 'OM301');
  assert.equal(f.airline, 'OM');
  assert.equal(f.route, 'ULN → ICN');
  assert.equal(f.depart, '2026-07-01T09:30:00');
  assert.equal(f.arrive, '2026-07-01T13:00:00');
  assert.equal(f.economy_mnt, 890000);
  assert.equal(f.currency, 'MNT');
  assert.equal(f.seats_left, null);
});

test('maps the second offer (KE868, 950000)', () => {
  const f = mapOffersToCompact(sample)[1];
  assert.equal(f.flight, 'KE868');
  assert.equal(f.economy_mnt, 950000);
  assert.equal(f.route, 'ULN → ICN');
});

test('tolerates an empty / malformed response (returns [])', () => {
  assert.deepEqual(mapOffersToCompact({}), []);
  assert.deepEqual(mapOffersToCompact(null), []);
  assert.deepEqual(mapOffersToCompact({ CatalogProductOfferingsResponse: {} }), []);
});
