# REST API

> Air Guide backend API-н бүх endpoint-ийн жагсаалт, request/response формат, алдааны код.

---

## 1. Үндсэн мэдээлэл

| Параметр | Утга |
|---|---|
| Base URL (dev) | `http://localhost:3000/api` |
| Base URL (prod) | `https://api.airguide.mn` |
| Content-Type | `application/json` |
| Charset | UTF-8 |
| Auth scheme | `Authorization: Bearer <jwt>` |
| Date format | ISO 8601 UTC (`2026-06-15T09:30:00Z`) |
| Currency | `MNT` default, ISO 4217 |
| Versioning | URL дотор хийхгүй — backward-compatible өөрчлөлт |

---

## 2. Стандарт response формат

### Амжилт

```json
{
  "data": { ... },
  "meta": { "total": 42, "page": 1, "limit": 20 }
}
```

### Алдаа

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "departure_date is required",
    "field": "departure_date"
  }
}
```

### HTTP статус код

| Код | Утга |
|---|---|
| 200 | OK — амжилттай |
| 201 | Created — шинэ resource үүссэн |
| 204 | No Content — амжилт, body байхгүй |
| 400 | Bad Request — Zod validation алдаа |
| 401 | Unauthorized — JWT алга/буруу |
| 403 | Forbidden — эрх хүрэхгүй |
| 404 | Not Found |
| 409 | Conflict — давхар захиалга, suudal full |
| 422 | Unprocessable — бизнес дүрэм зөрчигдсөн |
| 429 | Too Many Requests — rate limit |
| 500 | Internal Server Error |

---

## 3. Endpoint жагсаалт

| Method | URL | Зорилго | Auth |
|---|---|---|---|
| **Public** | | | |
| GET | `/airports` | Airport хайлт (autocomplete) | — |
| GET | `/airlines` | Бүх агаарын компани | — |
| GET | `/flights/search` | Нислэг хайх | — |
| GET | `/flights/:id` | Нислэгийн дэлгэрэнгүй | — |
| **Booking** | | | |
| POST | `/bookings` | Шинэ захиалга үүсгэх | — |
| GET | `/bookings/:code` | Захиалга харах | Booking code |
| POST | `/bookings/:code/cancel` | Захиалга цуцлах | Customer JWT |
| **Payment** | | | |
| POST | `/payments/qpay/invoice` | QPay invoice үүсгэх | — |
| POST | `/payments/qpay/webhook` | QPay callback | Signature |
| GET | `/payments/:booking_code/status` | Төлбөрийн төлөв | — |
| **Auth** | | | |
| POST | `/auth/login` | Ажилтан нэвтрэх | — |
| POST | `/auth/refresh` | JWT шинэчлэх | Refresh token |
| POST | `/auth/logout` | Гарах | JWT |
| **Admin** | | | |
| GET | `/admin/bookings` | Бүх захиалга | Admin/Manager |
| PATCH | `/admin/bookings/:id` | Захиалга засах | Admin/Manager |
| GET | `/admin/flights` | Бүх нислэг | Agent+ |
| POST | `/admin/flights` | Нислэг нэмэх | Manager+ |
| PATCH | `/admin/flights/:id` | Нислэг засах | Manager+ |
| GET | `/admin/reports/revenue` | Орлогын тайлан | Admin |

---

## 4. Public endpoints

### 4.1 `GET /airports`

Airport autocomplete-д ашиглана.

**Query params:**
| param | type | required | description |
|---|---|---|---|
| `q` | string | yes | Хайх үг (хот, нэр, IATA код) |
| `limit` | int | no | Default 10, max 50 |

**Жишээ хүсэлт:**
```http
GET /airports?q=ulan&limit=5
```

**Response (200):**
```json
{
  "data": [
    {
      "airport_id": 1,
      "iata_code": "ULN",
      "icao_code": "ZMCK",
      "name": "Chinggis Khaan International Airport",
      "city": "Ulaanbaatar",
      "country": "Mongolia"
    }
  ]
}
```

### 4.2 `GET /flights/search`

**Query params:**
| param | type | required | example |
|---|---|---|---|
| `from` | string (IATA 3) | yes | `ULN` |
| `to` | string (IATA 3) | yes | `ICN` |
| `departure_date` | date | yes | `2026-06-15` |
| `return_date` | date | no | `2026-06-22` |
| `passengers` | int | no | default 1, max 9 |
| `class` | enum | no | `economy` \| `business` \| `first` |

**Response (200):**
```json
{
  "data": {
    "outbound": [
      {
        "flight_id": 1,
        "flight_number": "OM301",
        "airline": { "code": "OM", "name": "MIAT Mongolian Airlines" },
        "origin": { "code": "ULN", "city": "Ulaanbaatar" },
        "destination": { "code": "ICN", "city": "Seoul" },
        "departure_time": "2026-06-15T01:30:00Z",
        "arrival_time": "2026-06-15T06:00:00Z",
        "duration_minutes": 210,
        "price": { "economy": 890000, "business": 1890000 },
        "available_seats": 120,
        "currency": "MNT"
      }
    ],
    "inbound": []
  }
}
```

**Алдаа (400):**
```json
{ "error": { "code": "INVALID_DATE", "message": "departure_date must be today or later" } }
```

### 4.3 `GET /flights/:id`

Тодорхой нислэгийн дэлгэрэнгүй.

**Response (200):**
```json
{
  "data": {
    "flight_id": 1,
    "flight_number": "OM301",
    "airline": { ... },
    "origin": { ... },
    "destination": { ... },
    "departure_time": "2026-06-15T01:30:00Z",
    "arrival_time": "2026-06-15T06:00:00Z",
    "duration_minutes": 210,
    "aircraft": { "model": "Boeing 737-800", "total_seats": 168 },
    "prices": { "economy": 890000, "business": 1890000, "first": null },
    "available_seats": 120,
    "baggage_allowance_kg": 20,
    "status": "scheduled"
  }
}
```

---

## 5. Booking endpoints

### 5.1 `POST /bookings`

Шинэ захиалга үүсгэнэ. **Transaction атомтай.**

**Request body:**
```json
{
  "trip_type": "round_trip",
  "outbound_flight_id": 1,
  "return_flight_id": 2,
  "class_type": "economy",
  "customer": {
    "last_name": "Дашдорж",
    "first_name": "Энхтөр",
    "email": "dashka@example.com",
    "phone": "99887766"
  },
  "passengers": [
    {
      "last_name": "Дашдорж",
      "first_name": "Энхтөр",
      "passport_no": "MN1234567",
      "passport_expiry": "2030-08-09",
      "birth_date": "1990-08-09",
      "gender": "M",
      "passenger_type": "adult"
    }
  ]
}
```

**Response (201):**
```json
{
  "data": {
    "booking_code": "AG7X9P2",
    "status": "pending",
    "total_amount": 1780000,
    "currency": "MNT",
    "payment_deadline": "2026-05-14T01:00:00Z",
    "payment_url": "/api/payments/qpay/invoice?booking_code=AG7X9P2"
  }
}
```

**Алдаа:**
- `409 SEATS_UNAVAILABLE` — суудал хүрэлцэхгүй
- `422 PASSPORT_EXPIRED` — паспортын хүчинтэй хугацаа дууссан
- `422 FLIGHT_DEPARTED` — нислэг хөөрсөн

### 5.2 `GET /bookings/:code`

Захиалгын одоогийн төлөв, билет.

**Response (200):**
```json
{
  "data": {
    "booking_code": "AG7X9P2",
    "status": "confirmed",
    "trip_type": "round_trip",
    "total_amount": 1780000,
    "paid_amount": 1780000,
    "balance_due": 0,
    "customer": { ... },
    "passengers": [ ... ],
    "tickets": [
      {
        "ticket_number": "OM-2026-0001",
        "flight": { ... },
        "class_type": "economy",
        "seat_number": "14A",
        "status": "issued"
      }
    ],
    "payments": [ ... ],
    "created_at": "2026-05-13T10:15:00Z"
  }
}
```

### 5.3 `POST /bookings/:code/cancel`

Захиалга цуцлах. Refund нь policy-р тооцоологдоно.

**Request body:**
```json
{ "reason": "Customer changed plan" }
```

**Response (200):**
```json
{
  "data": {
    "booking_code": "AG7X9P2",
    "status": "cancelled",
    "refund_amount": 1602000,
    "cancellation_fee": 178000
  }
}
```

---

## 6. Payment endpoints

### 6.1 `POST /payments/qpay/invoice`

QPay invoice үүсгэж QR код буцаана.

**Request:**
```json
{ "booking_code": "AG7X9P2" }
```

**Response (201):**
```json
{
  "data": {
    "invoice_id": "qpay_inv_xxx",
    "amount": 1780000,
    "qr_text": "0002010102...",
    "qr_image": "data:image/png;base64,iVBOR...",
    "expires_at": "2026-05-13T10:30:00Z",
    "deep_link": "qpay://...",
    "urls": {
      "khan": "khanbank://...",
      "tdb": "tdb://...",
      "social": "socialpay://..."
    }
  }
}
```

### 6.2 `POST /payments/qpay/webhook`

QPay-ээс ирэх callback. **Signature шалгасны дараа** booking-ыг `confirmed` болгож, e-ticket илгээнэ.

**Header:**
```
X-QPay-Signature: <hmac-sha256>
```

**Request (QPay-ээс ирдэг):**
```json
{
  "invoice_id": "qpay_inv_xxx",
  "payment_id": "qpay_pay_yyy",
  "amount": 1780000,
  "status": "PAID",
  "paid_at": "2026-05-13T10:25:00Z"
}
```

**Response:** `204 No Content`

### 6.3 `GET /payments/:booking_code/status`

Long-polling эсвэл client polling-д.

**Response (200):**
```json
{
  "data": {
    "booking_code": "AG7X9P2",
    "status": "confirmed",
    "paid_amount": 1780000,
    "method": "qpay",
    "paid_at": "2026-05-13T10:25:00Z"
  }
}
```

---

## 7. Auth endpoints (ажилтан)

### 7.1 `POST /auth/login`

**Request:**
```json
{ "username": "admin", "password": "..." }
```

**Response (200):**
```json
{
  "data": {
    "access_token": "eyJhbGciOi...",
    "refresh_token": "eyJhbGciOi...",
    "expires_in": 900,
    "user": {
      "user_id": 1,
      "username": "admin",
      "full_name": "Бат-Эрдэнэ Дорж",
      "role": "admin"
    }
  }
}
```

**Алдаа:**
- `401 INVALID_CREDENTIALS`
- `403 ACCOUNT_DISABLED`

### 7.2 `POST /auth/refresh`

**Request:**
```json
{ "refresh_token": "eyJ..." }
```

**Response (200):**
```json
{ "data": { "access_token": "eyJ...", "expires_in": 900 } }
```

---

## 8. Admin endpoints

Бүх admin endpoint-д `Authorization: Bearer <jwt>` шаардлагатай.

### 8.1 `GET /admin/bookings`

**Query params:**
- `status` — `pending|confirmed|cancelled|completed|refunded`
- `from`, `to` — date range
- `customer_id`
- `page`, `limit`

**Response:** `v_booking_details` view-ийн pagination-тэй жагсаалт.

### 8.2 `POST /admin/flights`

**Request:**
```json
{
  "flight_number": "OM303",
  "airline_id": 1,
  "origin_airport_id": 1,
  "destination_airport_id": 4,
  "departure_time": "2026-07-01T22:00:00Z",
  "arrival_time": "2026-07-02T05:30:00Z",
  "economy_price": 1200000,
  "business_price": 2400000,
  "available_seats": 168
}
```

### 8.3 `GET /admin/reports/revenue`

**Query:** `period=2026-06` (YYYY-MM), эсвэл `from=2026-06-01&to=2026-06-30`

**Response:**
```json
{
  "data": {
    "period": "2026-06",
    "total_revenue": 45680000,
    "booking_count": 312,
    "by_airline": [
      { "airline": "OM", "revenue": 28500000, "bookings": 178 }
    ],
    "by_route": [
      { "from": "ULN", "to": "ICN", "revenue": 18900000, "bookings": 102 }
    ]
  }
}
```

---

## 9. Алдааны код жагсаалт

| Код | HTTP | Тайлбар |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Zod validation |
| `INVALID_DATE` | 400 | Огноо буруу |
| `MISSING_FIELD` | 400 | Шаардлагатай талбар алга |
| `UNAUTHORIZED` | 401 | JWT алга |
| `INVALID_TOKEN` | 401 | JWT хүчингүй/expired |
| `INVALID_CREDENTIALS` | 401 | Нэр/нууц үг буруу |
| `FORBIDDEN` | 403 | Эрх хүрэхгүй |
| `ACCOUNT_DISABLED` | 403 | Идэвхгүй акк |
| `NOT_FOUND` | 404 | Resource алга |
| `SEATS_UNAVAILABLE` | 409 | Suudal хүрэлцэхгүй |
| `BOOKING_ALREADY_PAID` | 409 | Аль хэдийн төлсөн |
| `PASSPORT_EXPIRED` | 422 | Паспорт хугацаа дууссан |
| `FLIGHT_DEPARTED` | 422 | Нислэг хөөрсөн |
| `RATE_LIMITED` | 429 | Хэт олон хүсэлт |
| `INTERNAL_ERROR` | 500 | Серверийн алдаа |

---

## 10. Rate limit

| Endpoint бүлэг | Лимит |
|---|---|
| Public (search, airports) | 60 req/min/IP |
| Booking | 10 req/min/IP |
| Payment webhook | unlimited (signature шалгана) |
| Auth | 5 req/min/IP |
| Admin | 120 req/min/user |

Header дээр:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1715587200
```

---

## 11. OpenAPI / Swagger

`@fastify/swagger` plugin Fastify-н schema-аас автомат OpenAPI 3.1 spec гаргана:

- Dev: `http://localhost:3000/docs`
- Production-д disable

---

## 12. Version, өөрчлөлт

Backward-compatible өөрчлөлт — тоо нэмэх, талбар нэмэх, шинэ endpoint.
Breaking change хийх бол:
1. Шинэ endpoint `/api/v2/...` нэмэх
2. Хуучин endpoint 6 сар дэмжих
3. `Deprecation` header илгээх
