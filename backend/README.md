# Dawaa Java Backend

This backend is the Java 21 implementation of the Dawaa API.
It keeps the project aligned with the planning document's language choice:

- Frontend: JavaScript + React
- Backend feature logic: Java 21

The deployed Lambdas expose:

```text
GET  /medicines/search
POST /auth/register
POST /auth/login
GET  /admin/users
GET  /inventory/availability?medicineId={medicineId}
POST /pharmacies
GET  /pharmacies/mine
GET  /admin/pharmacies
POST /admin/pharmacies/{id}/approve
POST /pharmacies/search
```

Expected request body:

```json
{
  "lat": 33.8938,
  "lng": 35.5018,
  "radius": 5000,
  "keyword": "ibuprofen"
}
```

Expected environment variable:

```text
GOOGLE_MAPS_API_KEY=...
```

After deploying this backend, set the frontend server environment variable:

```text
DAWAA_API_BASE_URL=https://your-api-gateway-url
```

Until `DAWAA_API_BASE_URL` is set, the existing local Lovable connector fallback still runs.
