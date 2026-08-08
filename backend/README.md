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
GET  /pharmacies/nearby?lat={latitude}&lng={longitude}
POST /pharmacies/search
```

Expected `/pharmacies/search` request body:

```json
{
  "lat": 33.8938,
  "lng": 35.5018,
  "radius": 5000,
  "limit": 10
}
```

Pharmacy search reads from the `DawaaPharmacies` DynamoDB table and ranks results by
straight-line distance.

After deploying this backend, set the frontend server environment variable:

```text
DAWAA_API_BASE_URL=https://your-api-gateway-url
```

Until `DAWAA_API_BASE_URL` is set, the existing local Lovable connector fallback still runs.


## Before Handover

- Refactor `GET /admin/users` out of `AuthHandler` into an admin/user handler.
-----------------------
Current:
AuthHandler handles POST /auth/register
AuthHandler handles POST /auth/login
AuthHandler also handles GET /admin/users

Target:
AuthHandler handles only auth routes
AdminUserHandler or UserAdminHandler handles GET /admin/users
shared user lookup logic lives in UserService/UserRepository
-----------------------

- Modify structure to the following if possible:
---
api/auth/AuthHandler.java
  POST /auth/register
  POST /auth/login

api/admin/AdminUserHandler.java
  GET /admin/users

business/user/UserService.java
domain/user/User.java
domain/user/UserRole.java
domain/user/UserRepository.java
persistence/dynamodb/user/DynamoDbUserRepository.java
---

- Add `User`, `UserRole`, `UserRepository`, `UserService`, and `DynamoDbUserRepository`. ---- HALFWAY THROUGH
- Add role-based frontend landing tabs.
- Add shared Settings tab for all roles.
- Add real admin bootstrap strategy.
- Add basic frontend/backend tests.

## Later Security Pass

- Add AWS Cognito.
- Replace localStorage trust with token-based auth.
- Protect admin and pharmacist backend routes.
