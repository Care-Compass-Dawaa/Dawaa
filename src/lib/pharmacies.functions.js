import { createServerFn } from "@tanstack/react-start";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";
const DAWAA_API_BASE_URL = process.env.DAWAA_API_BASE_URL;
const REQUESTER_HEADER = "X-Dawaa-User-Id";

// ─── In-memory stores (replace with DynamoDB when backend is wired up) ─────────
const usersStore = new Map();
const inventoryStore = new Map(); // key: requesterUserId, value: Map of itemId -> item
const pharmaciesStore = new Map();

// Simple hash — server-only, no Node crypto import needed in client bundle
function hashPassword(password) {
  // Basic deterministic hash for dev fallback (not cryptographically secure for production)
  let hash = 0;
  const str = password + "dawaa_salt_2024";
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0;
  }
  return hash.toString(16);
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ─── Haversine distance ────────────────────────────────────────────────────────
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

// ─── Auth: Register ────────────────────────────────────────────────────────────
export const registerUser = createServerFn({ method: "POST" })
  .validator((input) => {
    if (!input?.email || !input?.password || !input?.name) {
      throw new Error("Email, password, and name are required");
    }
    const role = ["patient", "pharmacist"].includes(input.role) ? input.role : "patient";
    return { email: input.email.toLowerCase().trim(), password: input.password, name: input.name.trim(), role };
  })
  .handler(async ({ data }) => {
    if (DAWAA_API_BASE_URL) {
      const res = await fetch(`${DAWAA_API_BASE_URL.replace(/\/$/, "")}/auth/register`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.text()).slice(0, 200));
      return await res.json();
    }

    const existing = [...usersStore.values()].find((u) => u.email === data.email);
    if (existing) throw new Error("An account with this email already exists");

    const user = {
      id: generateId(),
      email: data.email,
      name: data.name,
      role: data.role,
      passwordHash: hashPassword(data.password),
      createdAt: new Date().toISOString(),
    };
    usersStore.set(user.id, user);

    const { passwordHash, ...safeUser } = user;
    return { user: safeUser };
  });

// ─── Auth: Login ───────────────────────────────────────────────────────────────
export const loginUser = createServerFn({ method: "POST" })
  .validator((input) => {
    if (!input?.email || !input?.password) throw new Error("Email and password are required");
    return { email: input.email.toLowerCase().trim(), password: input.password };
  })
  .handler(async ({ data }) => {
    if (DAWAA_API_BASE_URL) {
      const res = await fetch(`${DAWAA_API_BASE_URL.replace(/\/$/, "")}/auth/login`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.text()).slice(0, 200));
      return await res.json();
    }

    const user = [...usersStore.values()].find((u) => u.email === data.email);
    if (!user || user.passwordHash !== hashPassword(data.password)) {
      throw new Error("Invalid email or password");
    }

    const { passwordHash, ...safeUser } = user;
    return { user: safeUser };
  });

// Seed default admin on first server load (in-memory only)
(function seedAdmin() {
  const ADMIN_EMAIL = "admin@dawaa.com";
  if (![...usersStore.values()].find((u) => u.email === ADMIN_EMAIL)) {
    const adminId = generateId();
    usersStore.set(adminId, {
      id: adminId,
      email: ADMIN_EMAIL,
      name: "Admin",
      role: "admin",
      passwordHash: hashPassword("admin123"),
      createdAt: new Date().toISOString(),
    });
  }
})();

// ─── Pharmacist Inventory ──────────────────────────────────────────────────────
export const getInventory = createServerFn({ method: "POST" })
  .validator((input) => {
    if (!input?.requesterUserId) throw new Error("requesterUserId is required");
    return { requesterUserId: input.requesterUserId };
  })
  .handler(async ({ data }) => {
    if (DAWAA_API_BASE_URL) {
      const res = await fetch(`${DAWAA_API_BASE_URL.replace(/\/$/, "")}/inventory/${encodeURIComponent(data.requesterUserId)}`, {
        headers: { [REQUESTER_HEADER]: data.requesterUserId },
      });
      if (!res.ok) throw new Error((await res.text()).slice(0, 200));
      return await res.json();
    }

    const store = inventoryStore.get(data.requesterUserId) ?? new Map();
    return { items: [...store.values()].sort((a, b) => a.medicineName.localeCompare(b.medicineName)) };
  });

export const upsertInventoryItem = createServerFn({ method: "POST" })
  .validator((input) => {
    if (!input?.requesterUserId || !input?.medicineName) throw new Error("requesterUserId and medicineName are required");
    return {
      requesterUserId: input.requesterUserId,
      id: input.id ?? null,
      medicineName: input.medicineName.trim(),
      quantity: Math.max(0, Number(input.quantity) || 0),
      inStock: input.inStock !== false,
    };
  })
  .handler(async ({ data }) => {
    if (DAWAA_API_BASE_URL) {
      const res = await fetch(`${DAWAA_API_BASE_URL.replace(/\/$/, "")}/inventory`, {
        method: "POST",
        headers: { "Content-Type": "application/json", [REQUESTER_HEADER]: data.requesterUserId },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.text()).slice(0, 200));
      return await res.json();
    }

    if (!inventoryStore.has(data.requesterUserId)) inventoryStore.set(data.requesterUserId, new Map());
    const store = inventoryStore.get(data.requesterUserId);

    const id = data.id ?? generateId();
    const now = new Date().toISOString();
    const existing = data.id ? store.get(data.id) : null;

    store.set(id, {
      id,
      requesterUserId: data.requesterUserId,
      medicineName: data.medicineName,
      quantity: data.quantity,
      inStock: data.inStock,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });

    return { success: true };
  });

export const deleteInventoryItem = createServerFn({ method: "POST" })
  .validator((input) => {
    if (!input?.requesterUserId || !input?.id) throw new Error("requesterUserId and id are required");
    return { requesterUserId: input.requesterUserId, id: input.id };
  })
  .handler(async ({ data }) => {
    if (DAWAA_API_BASE_URL) {
      const res = await fetch(`${DAWAA_API_BASE_URL.replace(/\/$/, "")}/inventory/${encodeURIComponent(data.id)}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json", [REQUESTER_HEADER]: data.requesterUserId },
        body: JSON.stringify({ requesterUserId: data.requesterUserId }),
      });
      if (!res.ok) throw new Error((await res.text()).slice(0, 200));
      return await res.json();
    }

    const store = inventoryStore.get(data.requesterUserId);
    if (store) store.delete(data.id);
    return { success: true };
  });

// ─── Pharmacy Registration ────────────────────────────────────────────────────
export const registerPharmacy = createServerFn({ method: "POST" })
  .validator((input) => {
    if (!input?.requesterUserId || !input?.name || !input?.address || !input?.area || !input?.phone) {
      throw new Error("All pharmacy fields are required");
    }
    return {
      requesterUserId: input.requesterUserId,
      name: input.name.trim(),
      address: input.address.trim(),
      area: input.area.trim(),
      phone: input.phone.trim(),
    };
  })
  .handler(async ({ data }) => {
    if (DAWAA_API_BASE_URL) {
      const res = await fetch(`${DAWAA_API_BASE_URL.replace(/\/$/, "")}/pharmacies`, {
        method: "POST",
        headers: { "Content-Type": "application/json", [REQUESTER_HEADER]: data.requesterUserId },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.text()).slice(0, 200));
      return await res.json();
    }

    const existing = [...pharmaciesStore.values()].find((p) => p.ownerUserId === data.requesterUserId);
    if (existing) return { pharmacy: existing };

    const pharmacy = {
      id: generateId(),
      ownerUserId: data.requesterUserId,
      name: data.name,
      address: data.address,
      area: data.area,
      phone: data.phone,
      approved: false,
      createdAt: new Date().toISOString(),
    };
    pharmaciesStore.set(pharmacy.id, pharmacy);
    return { pharmacy };
  });

export const getMyPharmacy = createServerFn({ method: "POST" })
  .validator((input) => {
    if (!input?.requesterUserId) throw new Error("requesterUserId is required");
    return { requesterUserId: input.requesterUserId };
  })
  .handler(async ({ data }) => {
    if (DAWAA_API_BASE_URL) {
      const res = await fetch(`${DAWAA_API_BASE_URL.replace(/\/$/, "")}/pharmacies/mine`, {
        headers: { [REQUESTER_HEADER]: data.requesterUserId },
      });
      if (!res.ok) throw new Error((await res.text()).slice(0, 200));
      return await res.json();
    }

    const pharmacy = [...pharmaciesStore.values()].find((p) => p.ownerUserId === data.requesterUserId) ?? null;
    return { pharmacy };
  });

// ─── Admin ─────────────────────────────────────────────────────────────────────
export const getAllUsers = createServerFn({ method: "POST" })
  .validator((input) => {
    if (!input?.requesterUserId) throw new Error("requesterUserId is required");
    return { requesterUserId: input.requesterUserId };
  })
  .handler(async ({ data }) => {
    if (DAWAA_API_BASE_URL) {
      const res = await fetch(`${DAWAA_API_BASE_URL.replace(/\/$/, "")}/admin/users`, {
        headers: { [REQUESTER_HEADER]: data.requesterUserId },
      });
      if (!res.ok) throw new Error((await res.text()).slice(0, 200));
      return await res.json();
    }

    const users = [...usersStore.values()]
      .filter((u) => u.role !== "admin")
      .map(({ passwordHash, ...u }) => u);
    return { users };
  });

export const getAllPharmacies = createServerFn({ method: "POST" })
  .validator((input) => {
    if (!input?.requesterUserId) throw new Error("requesterUserId is required");
    return { requesterUserId: input.requesterUserId };
  })
  .handler(async ({ data }) => {
    if (DAWAA_API_BASE_URL) {
      const res = await fetch(`${DAWAA_API_BASE_URL.replace(/\/$/, "")}/admin/pharmacies`, {
        headers: { [REQUESTER_HEADER]: data.requesterUserId },
      });
      if (!res.ok) throw new Error((await res.text()).slice(0, 200));
      return await res.json();
    }

    return { pharmacies: [...pharmaciesStore.values()] };
  });

export const approvePharmacy = createServerFn({ method: "POST" })
  .validator((input) => {
    if (!input?.pharmacyId || !input?.requesterUserId) {
      throw new Error("pharmacyId and requesterUserId are required");
    }
    return {
      pharmacyId: input.pharmacyId,
      requesterUserId: input.requesterUserId,
      approved: input.approved !== false,
    };
  })
  .handler(async ({ data }) => {
    if (DAWAA_API_BASE_URL) {
      const res = await fetch(
        `${DAWAA_API_BASE_URL.replace(/\/$/, "")}/admin/pharmacies/${encodeURIComponent(data.pharmacyId)}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", [REQUESTER_HEADER]: data.requesterUserId },
          body: JSON.stringify({ approved: data.approved }),
        },
      );
      if (!res.ok) throw new Error((await res.text()).slice(0, 200));
      return await res.json();
    }

    const pharmacy = pharmaciesStore.get(data.pharmacyId);
    if (pharmacy) pharmaciesStore.set(data.pharmacyId, { ...pharmacy, approved: data.approved });
    return { success: true };
  });

// ─── Pharmacy Search ───────────────────────────────────────────────────────────
export const searchPharmacies = createServerFn({ method: "POST" })
  .validator((input) => {
    if (typeof input?.lat !== "number" || typeof input?.lng !== "number") {
      throw new Error("lat and lng are required");
    }
    const radius = Math.min(Math.max(input.radius ?? 5000, 500), 50000);
    return {
      lat: input.lat,
      lng: input.lng,
      radius,
      keyword: input.keyword?.trim() || "",
      location: input.location?.trim() || "",
    };
  })
  .handler(async ({ data }) => {
    if (DAWAA_API_BASE_URL) {
      return searchViaJavaBackend(data);
    }

    const lovableKey = process.env.LOVABLE_API_KEY;
    const gmKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!lovableKey || !gmKey) {
      throw new Error("Search backend not configured. Please set DAWAA_API_BASE_URL in your .env file.");
    }

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

async function searchViaJavaBackend(data) {
  const res = await fetch(`${DAWAA_API_BASE_URL.replace(/\/$/, "")}/pharmacies/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Dawaa API error ${res.status}: ${text.slice(0, 200)}`);
  }

  return await res.json();
}
