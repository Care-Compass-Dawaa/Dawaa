# Dawaa Java Backend

This backend is the Java 21 implementation of the current pharmacy search feature.
It keeps the project aligned with the planning document's language choice:

- Frontend: JavaScript + React
- Backend feature logic: Java 21

The deployed Lambda exposes:

```text
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
