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
GET  /admin/users/{id}
GET  /admin/users/by-email?email={email}
DELETE /admin/users/{id}
GET  /users/me
POST /users/me/update
GET  /inventory/availability?medicineId={medicineId}
GET  /inventory/{requesterUserId}
POST /inventory
DELETE /inventory/{medicineId}
POST /pharmacies
GET  /pharmacies/mine
POST /pharmacies/mine/schedule
GET  /pharmacies/{id}
GET  /admin/pharmacies
GET  /admin/pharmacies/{id}
POST /admin/pharmacies/{id}/approve
GET  /pharmacies/nearby?lat={latitude}&lng={longitude}
POST /pharmacies/search
POST /routes/directions
```

Expected `/pharmacies/search` request body:

```json
{
  "lat": 33.8938,
  "lng": 35.5018,
  "radius": 5000,
  "limit": 10,
  "openNowOnly": false
}
```

Pharmacy search reads from the `DawaaPharmacies` DynamoDB table. When route configuration is
available, the backend uses OpenRouteService for route-aware ranking; otherwise, it still returns
distance-based results from the available pharmacy coordinates. When `openNowOnly` is true, closed
pharmacies and pharmacies with unknown hours are excluded before results are ranked.

Expected `/pharmacies/mine/schedule` request body:

```json
{
  "timezone": "Asia/Beirut",
  "hoursMode": "regular",
  "weeklyHours": {
    "MONDAY": [
      { "open": "08:00", "close": "13:00" },
      { "open": "16:00", "close": "22:00" }
    ],
    "TUESDAY": [
      { "open": "08:00", "close": "22:00" }
    ]
  }
}
```

Use `"hoursMode": "twentyFourHours"` for pharmacies that are always open, or
`"hoursMode": "unknown"` when a pharmacist has not supplied a schedule.

After deploying this backend, set the frontend environment variables:

```text
VITE_DAWAA_API_BASE_URL=https://your-api-gateway-url
DAWAA_API_BASE_URL=https://your-api-gateway-url
```

Private backend API keys should remain in AWS Lambda environment variables and should not be
placed in frontend `.env` files.

## MVP Requester Identity

Protected MVP routes temporarily use this header:

```text
X-Dawaa-User-Id: USER#...
```

That header is not real authentication. It lets the service layer receive a requester while the
project is still pre-Cognito. When Cognito is added, handlers should read the authenticated Cognito
claims instead of trusting this frontend-provided header.

## Admin Bootstrap

Public signup intentionally allows only patients and pharmacists. To use the admin panel in the demo,
create one admin row manually with:

```powershell
cd backend
mvn -q -DskipTests package
.\scripts\create-admin.ps1 -Email admin@dawaa.com -Password "choose-a-demo-password"
```

Optional parameters:

```powershell
.\scripts\create-admin.ps1 `
  -TableName DawaaUsers `
  -Region eu-north-1 `
  -UserId "USER#ADMIN" `
  -Email admin@dawaa.com `
  -Password "choose-a-demo-password" `
  -Name "Admin"
```

The script writes a user with:

```text
userId, email, name, role=admin, passwordHash, active=true, createdAt, updatedAt
```

The password hash is generated with bcrypt, matching `UserService` login.

## Inventory Shape

The live `DawaaInventory` table uses:

```text
PK: pharmacyId
SK: medicineId
GSI: MedicineAvailabilityIndex
  - availableMedicineId
  - availableLocationKey
```

So pharmacist inventory CRUD is wired around the real table shape:

```text
GET    /inventory/{requesterUserId}
POST   /inventory
DELETE /inventory/{medicineId}
```

The path/body uses `requesterUserId` because the current frontend sends the logged-in user id.
The backend resolves that user to their pharmacy, then reads/writes inventory by
`pharmacyId + medicineId`.

The older inventory design that indexed directly by pharmacist/user id is not compatible with the
current DynamoDB table.


## Later Security Pass

- Add AWS Cognito.
- Replace localStorage trust with token-based auth.
- Keep bcrypt for password storage until Cognito or another production auth provider replaces local password handling.
