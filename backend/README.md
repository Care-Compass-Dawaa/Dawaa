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

Pharmacy search reads from the `DawaaPharmacies` DynamoDB table and ranks results by
straight-line distance. When `openNowOnly` is true, closed pharmacies and pharmacies with
unknown hours are excluded before the remaining results are ranked by distance.

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

After deploying this backend, set the frontend server environment variable:

```text
DAWAA_API_BASE_URL=https://your-api-gateway-url
```

Until `DAWAA_API_BASE_URL` is set, the existing local Lovable connector fallback still runs.

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

The password hash matches the temporary `AuthHandler` login format.

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


## Before Handover

- Add role-based frontend landing tabs.
- Add shared Settings tab for all roles.
- Add basic frontend/backend tests.

## Later Security Pass

- Add AWS Cognito.
- Replace localStorage trust with token-based auth.
- Replace temporary password hashing with production password/auth handling.
