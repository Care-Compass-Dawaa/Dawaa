import { createServerFn } from "@tanstack/react-start";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";
const DAWAA_API_BASE_URL = process.env.DAWAA_API_BASE_URL || process.env.VITE_DAWAA_API_BASE_URL;
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

function normalizeLebanesePhone(phone) {
  let digits = (phone ?? "").replace(/\D/g, "");
  if (digits.startsWith("961")) digits = digits.slice(3);
  if (digits.length !== 8) {
    throw new Error("Phone must contain 8 digits after +961");
  }
  return `+961${digits}`;
}

// ─── Haversine distance ────────────────────────────────────────────────────────
async function apiErrorMessage(res, fallback = "Request failed") {
  const text = await res.text();
  if (!text) return fallback;

  try {
    const json = JSON.parse(text);
    return json?.message || json?.error || fallback;
  } catch {
    return text.slice(0, 200);
  }
}

async function requireOk(res, fallback) {
  if (!res.ok) {
    throw new Error(await apiErrorMessage(res, fallback));
  }
}

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
      await requireOk(res, "Registration failed");
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
      await requireOk(res, "Sign in failed");
      return await res.json();
    }

    const user = [...usersStore.values()].find((u) => u.email === data.email);
    if (!user || user.passwordHash !== hashPassword(data.password)) {
      throw new Error("Invalid email or password");
    }

    const { passwordHash, ...safeUser } = user;
    return { user: safeUser };
  });

export const deactivateCurrentUser = createServerFn({ method: "POST" })
  .validator((input) => {
    if (!input?.requesterUserId) throw new Error("requesterUserId is required");
    return { requesterUserId: input.requesterUserId };
  })
  .handler(async ({ data }) => {
    if (DAWAA_API_BASE_URL) {
      const res = await fetch(`${DAWAA_API_BASE_URL.replace(/\/$/, "")}/users/me`, {
        method: "DELETE",
        headers: { [REQUESTER_HEADER]: data.requesterUserId },
      });
      await requireOk(res, "Failed to deactivate account");
      return await res.json();
    }

    const user = usersStore.get(data.requesterUserId);
    if (user?.role === "admin") throw new Error("Admin accounts cannot self-deactivate");
    if (user) usersStore.set(data.requesterUserId, { ...user, active: false });
    return { success: true };
  });

export const updateCurrentUser = createServerFn({ method: "POST" })
  .validator((input) => {
    if (!input?.requesterUserId || !input?.name || !input?.email) {
      throw new Error("requesterUserId, name, and email are required");
    }

    return {
      requesterUserId: input.requesterUserId,
      name: input.name.trim(),
      email: input.email.toLowerCase().trim(),
      password: input.password?.trim() || "",
    };
  })
  .handler(async ({ data }) => {
    if (DAWAA_API_BASE_URL) {
      const res = await fetch(`${DAWAA_API_BASE_URL.replace(/\/$/, "")}/users/me/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json", [REQUESTER_HEADER]: data.requesterUserId },
        body: JSON.stringify(data),
      });
      await requireOk(res, "Failed to update account");
      return await res.json();
    }

    const user = usersStore.get(data.requesterUserId);
    if (!user) throw new Error("Requester not found");
    const existing = [...usersStore.values()].find(
      (u) => u.email === data.email && u.id !== data.requesterUserId,
    );
    if (existing) throw new Error("Email is already used by another account");

    const updated = {
      ...user,
      name: data.name,
      email: data.email,
      passwordHash: data.password ? hashPassword(data.password) : user.passwordHash,
      updatedAt: new Date().toISOString(),
    };
    usersStore.set(data.requesterUserId, updated);
    const { passwordHash, ...safeUser } = updated;
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
      await requireOk(res, "Failed to load inventory");
      return await res.json();
    }

    const store = inventoryStore.get(data.requesterUserId) ?? new Map();
    return { items: [...store.values()].sort((a, b) => a.medicineName.localeCompare(b.medicineName)) };
  });

export const upsertInventoryItem = createServerFn({ method: "POST" })
  .validator((input) => {
    if (!input?.requesterUserId || !input?.medicineName) throw new Error("requesterUserId and medicineName are required");
    const quantity = Math.max(0, Number(input.quantity) || 0);
    return {
      requesterUserId: input.requesterUserId,
      id: input.id ?? null,
      medicineId: input.medicineId?.trim() || "",
      medicineName: input.medicineName.trim(),
      quantity,
      inStock: quantity > 0,
    };
  })
  .handler(async ({ data }) => {
    if (DAWAA_API_BASE_URL) {
      const res = await fetch(`${DAWAA_API_BASE_URL.replace(/\/$/, "")}/inventory`, {
        method: "POST",
        headers: { "Content-Type": "application/json", [REQUESTER_HEADER]: data.requesterUserId },
        body: JSON.stringify(data),
      });
      await requireOk(res, "Failed to save inventory item");
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
      await requireOk(res, "Failed to delete inventory item");
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
    if (
      input.latitude === undefined ||
      input.longitude === undefined ||
      !Number.isFinite(Number(input.latitude)) ||
      !Number.isFinite(Number(input.longitude))
    ) {
      throw new Error("Latitude and longitude are required");
    }
    return {
      requesterUserId: input.requesterUserId,
      name: input.name.trim(),
      address: input.address.trim(),
      area: input.area.trim(),
      district: input.district?.trim() || "",
      phone: normalizeLebanesePhone(input.phone),
      email: input.email?.trim() || "",
      latitude: Number(input.latitude) || 0,
      longitude: Number(input.longitude) || 0,
    };
  })
  .handler(async ({ data }) => {
    if (DAWAA_API_BASE_URL) {
      const res = await fetch(`${DAWAA_API_BASE_URL.replace(/\/$/, "")}/pharmacies`, {
        method: "POST",
        headers: { "Content-Type": "application/json", [REQUESTER_HEADER]: data.requesterUserId },
        body: JSON.stringify(data),
      });
      await requireOk(res, "Failed to register pharmacy");
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
      district: data.district,
      phone: data.phone,
      email: data.email,
      latitude: data.latitude,
      longitude: data.longitude,
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
      await requireOk(res, "Failed to load pharmacy");
      return await res.json();
    }

    const pharmacy = [...pharmaciesStore.values()].find((p) => p.ownerUserId === data.requesterUserId) ?? null;
    return { pharmacy };
  });

// ─── Admin ─────────────────────────────────────────────────────────────────────
export const updateMyPharmacy = createServerFn({ method: "POST" })
  .validator((input) => {
    if (!input?.requesterUserId || !input?.phone) {
      throw new Error("requesterUserId and phone are required");
    }
    if (
      input.latitude === undefined ||
      input.longitude === undefined ||
      !Number.isFinite(Number(input.latitude)) ||
      !Number.isFinite(Number(input.longitude))
    ) {
      throw new Error("Latitude and longitude are required");
    }

    return {
      requesterUserId: input.requesterUserId,
      email: input.email?.trim() || "",
      phone: normalizeLebanesePhone(input.phone),
      latitude: Number(input.latitude),
      longitude: Number(input.longitude),
    };
  })
  .handler(async ({ data }) => {
    if (DAWAA_API_BASE_URL) {
      const res = await fetch(`${DAWAA_API_BASE_URL.replace(/\/$/, "")}/pharmacies/mine/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json", [REQUESTER_HEADER]: data.requesterUserId },
        body: JSON.stringify(data),
      });
      await requireOk(res, "Failed to update pharmacy");
      return await res.json();
    }

    const pharmacy = [...pharmaciesStore.values()].find((p) => p.ownerUserId === data.requesterUserId);
    if (!pharmacy) throw new Error("pharmacy not found.");
    const updated = {
      ...pharmacy,
      email: data.email,
      phone: data.phone,
      latitude: data.latitude,
      longitude: data.longitude,
      updatedAt: new Date().toISOString(),
    };
    pharmaciesStore.set(pharmacy.id, updated);
    return { pharmacy: updated };
  });

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
      await requireOk(res, "Failed to load users");
      return await res.json();
    }

    const users = [...usersStore.values()]
      .filter((u) => u.role !== "admin")
      .map(({ passwordHash, ...u }) => u);
    return { users };
  });

export const deactivateUserAsAdmin = createServerFn({ method: "POST" })
  .validator((input) => {
    if (!input?.requesterUserId || !input?.targetUserId) {
      throw new Error("requesterUserId and targetUserId are required");
    }
    return {
      requesterUserId: input.requesterUserId,
      targetUserId: input.targetUserId,
    };
  })
  .handler(async ({ data }) => {
    if (DAWAA_API_BASE_URL) {
      const res = await fetch(
        `${DAWAA_API_BASE_URL.replace(/\/$/, "")}/admin/users/${encodeURIComponent(data.targetUserId)}`,
        {
          method: "DELETE",
          headers: { [REQUESTER_HEADER]: data.requesterUserId },
        },
      );
      await requireOk(res, "Failed to deactivate user");
      return await res.json();
    }

    const requester = usersStore.get(data.requesterUserId);
    const target = usersStore.get(data.targetUserId);
    if (requester?.role !== "admin") throw new Error("Admin access is required");
    if (target?.role === "admin") throw new Error("Admin accounts cannot be deactivated here");
    if (target) usersStore.set(data.targetUserId, { ...target, active: false });
    return { success: true };
  });

export const activateUserAsAdmin = createServerFn({ method: "POST" })
  .validator((input) => {
    if (!input?.requesterUserId || !input?.targetUserId) {
      throw new Error("requesterUserId and targetUserId are required");
    }
    return {
      requesterUserId: input.requesterUserId,
      targetUserId: input.targetUserId,
    };
  })
  .handler(async ({ data }) => {
    if (DAWAA_API_BASE_URL) {
      const res = await fetch(
        `${DAWAA_API_BASE_URL.replace(/\/$/, "")}/admin/users/${encodeURIComponent(data.targetUserId)}/activate`,
        {
          method: "POST",
          headers: { [REQUESTER_HEADER]: data.requesterUserId },
        },
      );
      await requireOk(res, "Failed to activate user");
      return await res.json();
    }

    const requester = usersStore.get(data.requesterUserId);
    const target = usersStore.get(data.targetUserId);
    if (requester?.role !== "admin") throw new Error("Admin access is required");
    if (target) usersStore.set(data.targetUserId, { ...target, active: true });
    return { success: true };
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
      await requireOk(res, "Failed to load pharmacies");
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
      await requireOk(res, "Failed to update pharmacy approval");
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
      medicineId: input.medicineId?.trim() || "",
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

    await requireOk(res, `Places API error ${res.status}`);
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

  await requireOk(res, `Dawaa API error ${res.status}`);

  return await res.json();
}
