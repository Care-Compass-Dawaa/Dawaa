import { createServerFn } from "@tanstack/react-start";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

function haversine(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export const searchPharmacies = createServerFn({ method: "POST" })
  .inputValidator((input) => {
    if (typeof input?.lat !== "number" || typeof input?.lng !== "number") {
      throw new Error("lat and lng are required");
    }
    const radius = Math.min(Math.max(input.radius ?? 5000, 500), 50000);
    return { lat: input.lat, lng: input.lng, radius, keyword: input.keyword?.trim() || "" };
  })
  .handler(async ({ data }) => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const gmKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!lovableKey || !gmKey) throw new Error("Google Maps connector not configured");

    const res = await fetch(`${GATEWAY_URL}/places/v1/places:searchNearby`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": gmKey,
        "Content-Type": "application/json",
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.formattedAddress,places.location,places.rating,places.userRatingCount,places.currentOpeningHours.openNow,places.nationalPhoneNumber,places.websiteUri",
      },
      body: JSON.stringify({
        includedTypes: ["pharmacy"],
        maxResultCount: 20,
        locationRestriction: {
          circle: {
            center: { latitude: data.lat, longitude: data.lng },
            radius: data.radius,
          },
        },
        rankPreference: "DISTANCE",
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Places API error ${res.status}: ${text.slice(0, 200)}`);
    }
    const json = await res.json();

    const center = { lat: data.lat, lng: data.lng };
    const pharmacies = (json.places ?? []).map((p) => {
      const loc = { lat: p.location.latitude, lng: p.location.longitude };
      return {
        id: p.id,
        name: p.displayName?.text ?? "Pharmacy",
        address: p.formattedAddress ?? "",
        location: loc,
        rating: p.rating,
        userRatingCount: p.userRatingCount,
        openNow: p.currentOpeningHours?.openNow,
        phone: p.nationalPhoneNumber,
        websiteUri: p.websiteUri,
        distanceMeters: Math.round(haversine(center, loc)),
      };
    });

    return { pharmacies };
  });
