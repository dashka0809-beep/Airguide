# Travelport JSON API v11 — Confirmed Contract Notes (Task 1)

Source: official Travelport support docs (fetched 2026-05-18).
- OAuth: https://support.travelport.com/webhelp/JSONAPIs/Airv11/Content/GeneralProject/Oauth.htm
- Search: https://support.travelport.com/webhelp/JSONAPIs/Airv11/Content/Air11/Search/APIRef_Search.htm
- Headers: https://support.travelport.com/webhelp/JSONAPIs/Airv11/Content/Air11/General/CommonAirHeaders.htm

## OAuth (pre-production / sandbox)

- Token URL (pre-prod): `https://auth.pp.travelport.net/oauth/token`
- Token URL (prod):     `https://auth.travelport.net/oauth/token`
- Method: `POST`, Content-Type `application/x-www-form-urlencoded`
- Body params (confirmed required): `username`, `password`, `client_id`, `client_secret`
- `grant_type`: NOT stated verbatim in docs. Travelport two-legged OAuth =
  `password` grant (standard). **Flagged:** if OAuth returns 4xx during
  Task 8, reconcile grant_type/body here (plan Task 8 Step 3).
- Response: `access_token` (string). Token validity: 24h (86400s).
  No expiry field name documented → default TTL 86400s, refresh on demand.

## Air Search (pre-production / sandbox)

- Base (pre-prod): `https://api.pp.travelport.net/11/air/`
- Base (prod):     `https://api.travelport.net/11/air/`
- Endpoint: `POST catalog/search/catalogproductofferings`
- Required headers (verbatim from CommonAirHeaders):
  - `Accept-Encoding: gzip, deflate`  (mandatory, must include compression)
  - `Cache-Control: no-cache`
  - `Accept: application/json`
  - `Content-Type: application/json`
  - `Authorization: Bearer {access_token}`
  - `XAUTH_TRAVELPORT_ACCESSGROUP: {access_group}` **OR**
    `TVP-PCC-CORE: {PCC}_{GDS}` (e.g. `79JP_1G`) — at least one required
  - `Accept-Version: 11`   (required for Air Search)
  - `Content-Version: 11`  (required for Air Search)
- Request body (confirmed skeleton, one-way / 1 ADT / Economy):

```json
{
  "CatalogProductOfferingsQueryRequest": {
    "@type": "CatalogProductOfferingsQueryRequest",
    "CatalogProductOfferingsRequest": {
      "@type": "CatalogProductOfferingsRequestAir",
      "PassengerCriteria": [
        { "@type": "PassengerCriteria", "passengerTypeCode": "ADT", "number": 1 }
      ],
      "SearchCriteriaFlight": [
        { "@type": "SearchCriteriaFlight", "departureDate": "YYYY-MM-DD",
          "From": { "value": "ULN" }, "To": { "value": "ICN" } }
      ],
      "SearchModifiersAir": {
        "@type": "SearchModifiersAir",
        "CabinPreference": [
          { "@type": "CabinPreference", "preferenceType": "Permitted",
            "cabins": ["Economy"] }
        ]
      }
    }
  }
}
```

## Response paths (confirmed)

- Offers list: `CatalogProductOfferingsResponse.CatalogProductOfferings.CatalogProductOffering[]`
- Flight refs: each offer's `ProductBrandOptions[].flightRefs[]` → ids into
  `CatalogProductOfferingsResponse.ReferenceList[]` where `@type ==
  "ReferenceListFlight"` → `.Flight[]` keyed by `.id`
- Per flight: `.number`, `.carrier`, `.Departure.location/.date/.time`,
  `.Arrival.location/.date/.time`
- Price: `offer.ProductBrandOptions[].ProductBrandOffering[].BestCombinablePrice.TotalPrice`
- Currency: same `BestCombinablePrice.CurrencyCode.value`

## Fixture caveat

Official doc pages omit the full `ReferenceList` ("edited out for
brevity") and no complete copy-pasteable sample exists without sandbox
credentials. `backend/test/fixtures/travelport-search.sample.json` is
**constructed to the confirmed v11 schema/paths above**. The mapper is
tolerant (missing field → null). Plan **Task 8 Step 3** reconciles the
mapper against the real sandbox response once credentials are set.
