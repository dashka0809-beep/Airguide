#!/usr/bin/env python3
"""
smoke_test.py — Endpoint-уудыг бүгдийг туршина (UTF-8 цэвэр)

Хэрэглэх:
    python scripts/smoke_test.py
"""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request

BASE = "https://airguide-production-ec87.up.railway.app"


def request(method, path, body=None, expected_status=200):
    url = f"{BASE}{path}"
    headers = {"Content-Type": "application/json; charset=utf-8"}
    data = json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None

    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            status = resp.status
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        status = e.code
        payload = json.loads(e.read().decode("utf-8"))

    ok = (status == expected_status)
    mark = "✓" if ok else "✗"
    label = f"{mark} {method:<5} {path}  →  {status}"
    print(label)
    return status, payload


def main():
    # 1. Health
    print("\n=== 1. Health ===")
    _, p = request("GET", "/api/health")
    print(f"   db: {p.get('database')}, env: {p.get('env')}")

    # 2. Airport autocomplete (Mongolian-friendly)
    print("\n=== 2. Airport autocomplete ===")
    for q in ["ulan", "seoul", "tokyo", "ICN"]:
        _, p = request("GET", f"/api/airports?q={q}&limit=3")
        cities = [r["city"] for r in p.get("data", [])]
        print(f"   q={q!r:<10} → {cities}")

    # 3. Airlines
    print("\n=== 3. Airlines ===")
    _, p = request("GET", "/api/airlines")
    print(f"   {p.get('meta', {}).get('total')} airlines")

    # 4. Flight search
    print("\n=== 4. Flight search ULN→ICN, 2026-06-15 ===")
    _, p = request("GET", "/api/flights/search?from=ULN&to=ICN&departure_date=2026-06-15")
    print(f"   outbound={p.get('meta', {}).get('outbound_count')}, "
          f"inbound={p.get('meta', {}).get('inbound_count')}")

    # 5. Single flight detail
    print("\n=== 5. Single flight ===")
    _, p = request("GET", "/api/flights/1")
    f = p.get("data", {})
    print(f"   {f.get('flight_number')} {f.get('origin', {}).get('code')}→"
          f"{f.get('destination', {}).get('code')}, "
          f"available_seats={f.get('available_seats')}")

    seats_before = f.get("available_seats")

    # 6. Create booking with Mongolian chars
    print("\n=== 6. POST /bookings (Mongolian text) ===")
    booking_body = {
        "trip_type": "one_way",
        "outbound_flight_id": 1,
        "class_type": "economy",
        "customer": {
            "last_name": "Дашдорж",
            "first_name": "Хэрэглэгч",
            "email": "ulaa@example.com",
            "phone": "99887700"
        },
        "passengers": [
            {
                "last_name": "Дашдорж",
                "first_name": "Хэрэглэгч",
                "passport_no": "MN9999001",
                "passport_expiry": "2030-12-31",
                "birth_date": "1995-03-15",
                "gender": "M",
                "passenger_type": "adult"
            }
        ]
    }
    status, p = request("POST", "/api/bookings", booking_body, expected_status=201)
    booking_code = p.get("data", {}).get("booking_code")
    print(f"   booking_code = {booking_code}")
    print(f"   total_amount = {p.get('data', {}).get('total_amount')}")

    # 7. Get booking detail
    print(f"\n=== 7. GET /bookings/{booking_code} ===")
    _, p = request("GET", f"/api/bookings/{booking_code}")
    cust = p.get("data", {}).get("customer", {})
    pax = p.get("data", {}).get("passengers", [{}])[0]
    print(f"   customer name = {cust.get('name')!r}")
    print(f"   passenger     = {pax.get('last_name')!r} {pax.get('first_name')!r}")

    # 8. Seats decreased
    print("\n=== 8. Seats after booking ===")
    _, p = request("GET", "/api/flights/1")
    seats_after_book = p.get("data", {}).get("available_seats")
    print(f"   seats: before={seats_before} → after_book={seats_after_book} (expected -1)")

    # 9. Cancel
    print(f"\n=== 9. POST /bookings/{booking_code}/cancel ===")
    _, p = request("POST", f"/api/bookings/{booking_code}/cancel", {"reason": "Smoke test"})
    print(f"   status      = {p.get('data', {}).get('status')}")
    print(f"   refund      = {p.get('data', {}).get('refund_amount')}")
    print(f"   cancel_fee  = {p.get('data', {}).get('cancellation_fee')}")

    # 10. Seats restored
    print("\n=== 10. Seats after cancel ===")
    _, p = request("GET", "/api/flights/1")
    seats_after_cancel = p.get("data", {}).get("available_seats")
    print(f"   seats: before={seats_before}, after_book={seats_after_book}, "
          f"after_cancel={seats_after_cancel} (expected={seats_before})")

    print("\n✅ Smoke tests done.")


if __name__ == "__main__":
    main()
