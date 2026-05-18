/**
 * services/travelport.js — Travelport JSON API v11 (sandbox прототайп)
 *
 * API contract: docs/superpowers/plans/travelport-api-notes.md
 * (Task 1-д албан ёсны Travelport баримтаас баталгаажуулсан).
 *
 * Энэ модуль тусгаарласан — одоогийн /api/flights/search, захиалгад
 * ОГТ хүрэхгүй. Нэвтрэх эрхгүй бол route нь 503 буцаана.
 */

/**
 * Travelport CatalogProductOfferings хариуг манай товч хэлбэрт хөрвүүлнэ.
 * ЦЭВЭР функц — сүлжээ хөндөхгүй, алдаа шиднэхгүй (дутуу/буруу → []/null).
 *
 * Бүтэц (v11, баталгаажсан):
 *   CatalogProductOfferingsResponse.CatalogProductOfferings.CatalogProductOffering[]
 *   offer.ProductBrandOptions[].flightRefs[] → ReferenceList[@type=ReferenceListFlight].Flight[].id
 *   price: offer.ProductBrandOptions[].ProductBrandOffering[].BestCombinablePrice
 *
 * @param {object|null} api Travelport JSON хариу
 * @returns {Array<{flight,airline,route,depart,arrive,economy_mnt,business_mnt,seats_left,currency}>}
 */
export function mapOffersToCompact(api) {
  const resp = api?.CatalogProductOfferingsResponse;
  const offers = resp?.CatalogProductOfferings?.CatalogProductOffering;
  if (!Array.isArray(offers) || offers.length === 0) return [];

  const refList = Array.isArray(resp?.ReferenceList) ? resp.ReferenceList : [];
  const flightRef = refList.find(r => r?.['@type'] === 'ReferenceListFlight');
  const flights = Array.isArray(flightRef?.Flight) ? flightRef.Flight : [];
  const flightById = Object.fromEntries(flights.map(f => [f?.id, f]));

  return offers.map((offer) => {
    const pbo = offer?.ProductBrandOptions?.[0];
    const fl = flightById[pbo?.flightRefs?.[0]] ?? null;
    const price = pbo?.ProductBrandOffering?.[0]?.BestCombinablePrice;

    const carrier = fl?.carrier ?? '';
    const number  = fl?.number ?? '';
    const origin  = fl?.Departure?.location ?? offer?.Departure ?? '';
    const dest    = fl?.Arrival?.location ?? offer?.Arrival ?? '';
    const dep     = fl?.Departure;
    const arr     = fl?.Arrival;
    const depart  = dep?.date && dep?.time ? `${dep.date}T${dep.time}` : null;
    const arrive  = arr?.date && arr?.time ? `${arr.date}T${arr.time}` : null;
    const amount  = price?.TotalPrice;

    return {
      flight:  `${carrier}${number}`,
      airline: String(carrier),
      route:   `${origin} → ${dest}`,
      depart,
      arrive,
      economy_mnt:  amount != null ? Number(amount) : null,
      business_mnt: null,
      seats_left:   fl?.availableSeats != null ? Number(fl.availableSeats) : null,
      currency:     price?.CurrencyCode?.value ?? null
    };
  });
}
