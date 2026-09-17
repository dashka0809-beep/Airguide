# Visa Itinerary Document ("Захиалгын хуудас") — Design Spec

**Date:** 2026-09-17
**Status:** Design approved. Implementation blocked on external access (see §9).
**Approach:** B — fully automated, built once Amadeus Enterprise API and QPay access are available.

---

## Товч тайлбар (MN)

Үйлчлүүлэгч сайт дээр жинхэнэ нислэг хайж сонгоод, зорчигчийн мэдээллээ
бөглөж, зорчигч бүрт 10,000₮ төлнө. Төлбөр ормогц систем **Amadeus дээр
жинхэнэ түр захиалга (PNR)** автоматаар үүсгэж, AIRGUIDE LLC-ийн нэртэй
**захиалгын хуудас (PDF)** гаргана. Тийз бичигдэхгүй. Агаарын компанийн
хугацаа дуусахад захиалга өөрөө цуцлагдана. Ажилтан оролцохгүй.

Хуудас бүр **заавал жинхэнэ PNR-тэй** байна. Сайт өөрөө нислэг, захиалга
зохиож хуудас гаргахгүй. Ингэснээр элчин сайдын яамны шалгалтад хуурамч
баримт болохоос сэргийлнэ.

---

## 1. Context

- AIRGUIDE LLC is an Amadeus agency. Staff already produce visa itineraries
  manually: they create a real PNR in Amadeus (segments `Confirmed`, a
  ticketing deadline after which the airline cancels) and send the Amadeus
  itinerary PDF.
- The public site's flight search uses **demo seed data**. A visa document
  must never reference demo flights or a PNR that does not exist.
- **Amadeus Self-Service APIs were decommissioned on 2026-07-17** (including
  Flight Create Orders). The only Amadeus route is **Amadeus Enterprise APIs
  (Amadeus Web Services)**, obtained through the local Amadeus office.
- Payments: no gateway yet. QPay is the planned provider (`QPAY_*` vars
  already reserved in `backend/src/config.js`).
- Reference competitor flow: nisleg.mn "Захиалгын хуудас".

## 2. Business rules (decided)

| Rule | Decision |
|---|---|
| Price | **10,000₮ per passenger** (all passenger types) |
| Document validity / hold length | No Airguide-defined duration. PNR ticketing deadline = **airline's last ticketing date** returned by pricing. No follow-up after issue; the PNR auto-cancels |
| Payment timing | **Pay first, then create PNR.** No PNR is created for unpaid orders |
| Ticketing | Never. No real tickets are issued by this feature |
| Trip types | One-way and round-trip |
| Cabin | Economy only |
| Passenger types | Adult, child, infant |
| Names | Latin letters exactly as in passport (A–Z, space, hyphen), stored uppercase |
| Duplicate guard | Reject a new order if an active (paid/issuing/issued, not past deadline) order already exists for the same passport number on the same flight segments |
| Offer / form timer | 20 minutes from offer selection to completed payment |
| Price on document | Not shown |

## 3. Customer flow

1. Nav entry **"Визний захиалгын хуудас"** → dedicated page, separate from the
   demo-data search.
2. Search form: from, to, departure date, optional return date, passenger
   counts (adult/child/infant). Search hits Amadeus (real availability).
3. Results list → select an itinerary → detail view (times, airline,
   operating carrier, connections, duration).
4. **"Захиалгын хуудас авах"** → confirmation dialog: paid service; this is
   not a ticket; cannot be used to fly; non-refundable; price not printed;
   not a notarised document; all passengers on one document. **Тийм / Үгүй**.
5. Form (per passenger): surname, given name (Latin), gender, date of birth,
   nationality, passport number, passport expiry. Contact: name, phone,
   email. 20-minute countdown visible.
6. Payment: amount = passengers × 10,000₮ → QPay invoice QR (+ bank app
   deep links on mobile).
7. On confirmed payment the order is issued automatically → success page with
   **"Татах"** (download PDF) button; the PDF is also emailed when email is
   configured.

## 4. Architecture

Three sub-projects, each with its own spec + implementation plan:

| # | Sub-project | Responsibility | Unblocked by |
|---|---|---|---|
| 1 | **Amadeus client** (`backend/src/services/amadeus/`) | Session/auth, availability search, sell, build PNR (names, DOCS, contacts, ticketing element), price + TST to obtain last ticketing date, end-transact, retrieve PNR. Typed errors, no app-fatal throws | Amadeus Enterprise test access + WSDL/docs |
| 2 | **QPay payments** (`backend/src/services/qpay/`) | Token, create invoice, render QR, payment check (callback + polling fallback), invoice expiry. Reusable for normal bookings later | QPay merchant credentials |
| 3 | **Visa itinerary service** | Page + form + timer (frontend), order state machine, orchestration (payment → PNR → document), PDF generation, download/email, admin screens, PII purge job | 1 and 2 |

1 and 2 run in parallel; 3 follows. Exact Amadeus message names/versions
(e.g. `Fare_MasterPricerTravelBoardSearch`, `Air_SellFromRecommendation`,
`PNR_AddMultiElements`, `Fare_PricePNRWithBookingClass`,
`Ticket_CreateTSTFromPricing`, `PNR_Retrieve`) and QPay endpoints are
confirmed from official docs in each sub-project spec — not assumed here.

## 5. Order state machine

```
draft ──(form submitted, invoice created)──▶ awaiting_payment
awaiting_payment ──(20 min / invoice expired)──▶ expired
awaiting_payment ──(payment confirmed)──▶ paid
paid ──(orchestrator picks up)──▶ issuing
issuing ──(PNR created + snapshot stored)──▶ issued
issuing ──(retries exhausted)──▶ refund_required
refund_required ──(staff marks refunded in admin)──▶ refunded
```

- Issuing retries: up to 2 automatic retries with backoff for transient
  Amadeus errors. Non-transient failures (no seats, fare changed) go straight
  to `refund_required`.
- Every transition is written to `audit_log`.

## 6. Data model (new tables via dbmate migration)

**`visa_orders`**
`order_id`, `public_token` (≥32 random url-safe chars, unique), `status`,
`passenger_count`, `amount_mnt`, `contact_name`, `contact_phone`,
`contact_email`, `offer_snapshot` JSONB, `offer_expires_at`,
`qpay_invoice_id`, `paid_at`, `pnr_locator`, `airline_refs` JSONB,
`ticketing_deadline`, `pnr_snapshot` JSONB, `issued_at`, `failure_reason`,
`refunded_at`, `pii_purged_at`, `created_at`, `updated_at`.

**`visa_order_passengers`**
`id`, `order_id` FK, `passenger_type`, `last_name`, `first_name`, `gender`,
`birth_date`, `nationality`, `passport_no`, `passport_expiry`.

The PDF is **not stored**; it is regenerated on demand from `pnr_snapshot`.

## 7. Document (PDF)

Generated server-side (pdfkit + embedded Noto Sans for Cyrillic) from
`pnr_snapshot`. Structure mirrors the agency's Amadeus itinerary:

1. Header: "Your trip", booking reference (PNR), document issue date.
2. Traveller name(s) (`SURNAME/GIVEN MR|MRS|MS|MSTR|MISS`).
3. Agency block: AIRGUIDE LLC address, telephones, email.
4. Per segment, grouped by date: airline + flight number (with "Operated by"
   when codeshare); departure and arrival date/time and airport (+terminal);
   duration and stops; booking status; class; equipment and meal when present.
5. Line after each segment: "Please ticket before {deadline}, overdue will
   cancel the itinerary without notice."
6. General Information (Mongolian, 6 points as used today).
7. Airline Booking Reference(s).
8. Data Protection Notice.

No price, no third-party advertising.

## 8. Admin, errors, privacy

**Admin** — new "Визний хуудас" list: code, passengers, route, amount, date,
PNR, status filter. Actions: download PDF; retry issuing — offered only for
`refund_required` orders whose `failure_reason` is transient (e.g. Amadeus
timeout), never for "no seats" / "fare changed"; mark refunded. Revenue report gets a
separate "Visa itinerary" line (sum of `amount_mnt` for issued orders).

**Errors**

| Case | Behaviour |
|---|---|
| Search fails / no results | Clear message, allow retry |
| Timer expires | Order → `expired`, customer restarts |
| Payment never arrives | No PNR created |
| Paid but PNR fails | Retry; then `refund_required`, customer sees "мөнгийг тань буцаана", staff alerted via admin list + Sentry. Refund done by staff in QPay |

**Privacy**
- `passport_no`, `passport_expiry`, `birth_date` are nulled **30 days after
  `issued_at`** (or after `created_at` for expired/failed orders); set
  `pii_purged_at`. Document regeneration does not need them.
- Download URL uses `public_token` only; rate-limited.
- Passport fields added to pino redact paths; never sent to Sentry.

## 9. Dependencies the business must obtain

1. **Amadeus Enterprise API access** — office ID, API credentials, test
   environment, certification — from the local Amadeus office.
2. **QPay merchant account** — invoice code, username, password (sandbox and
   production).
3. Optional: email sending provider + verified `airguide.mn` sender domain.

## 10. Risks

- **Airline ADMs** for unticketed holds. Automated volume increases exposure
  versus today's manual practice. Mitigations: duplicate guard (§2), airline
  ticketing deadlines only, no re-holding the same passenger/flight.
- Amadeus Enterprise access lead time and commercial cost are unknown.
- After the PNR auto-cancels, embassy verification will not find it
  (same as current manual practice and competitors).

## 11. Testing

- Unit: price calculation, name validation, state machine transitions,
  duplicate guard, PII purge selection, PDF rendering from a fixture
  `pnr_snapshot` (text assertions on required sections, absence of price).
- Integration: full flow against Amadeus test environment + QPay sandbox
  before any production credentials are used.
- Production cutover: one internal order end-to-end, verify PNR in Amadeus
  terminal and PDF content, then enable the nav entry.

## 12. Out of scope

- Issuing real tickets or selling tickets through this flow.
- Switching the main site search/booking from demo data to Amadeus.
- Multi-city, business/first class.
- Automatic QPay refunds.
- Hotel reservation documents.
