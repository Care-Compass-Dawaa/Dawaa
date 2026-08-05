# Care Compass / Dawaa

Dawaa is a medicine-finder prototype for Lebanon. The project currently includes a React patient search interface, pharmacist inventory and pharmacy-management screens, an admin approval interface, and a Java 21 AWS Lambda-compatible backend.

## Project Structure

```text
Dawaa/
|-- src/                                      <- React/TanStack Start application
|   |-- routes/
|   |   |-- index.jsx                         <- Patient, pharmacist, admin, and auth interfaces
|   |   |-- __root.jsx                        <- Root layout, metadata, and error boundary
|   |   `-- README.md                         <- Route conventions
|   |
|   |-- lib/
|   |   |-- pharmacies.functions.js           <- Server functions and backend/fallback adapters
|   |   |-- error-capture.js                  <- Error capture helper
|   |   |-- error-page.js                     <- Error page renderer
|   |   `-- lovable-error-reporting.js        <- Lovable error reporting helper
|   |
|   |-- router.jsx                            <- TanStack Router setup
|   |-- routeTree.gen.ts                      <- Generated route tree
|   |-- server.js                             <- Server entry wrapper
|   |-- start.js                              <- TanStack Start setup
|   `-- styles.css                            <- Global Tailwind CSS styles
|
|-- backend/
|   |-- src/main/java/com/dawaa/
|   |   |-- auth/AuthHandler.java             <- Registration and login
|   |   |-- common/BaseHandler.java           <- Shared JSON, error, and CORS responses
|   |   |-- api/inventory/                    <- Inventory availability API
|   |   |-- business/inventory/               <- Inventory availability service
|   |   |-- domain/inventory/                 <- Inventory domain model and repository contract
|   |   |-- persistence/dynamodb/inventory/   <- DynamoDB inventory availability repository
|   |   |-- pharmacies/PharmacyHandler.java   <- Pharmacy registration and approval
|   |   `-- pharmacies/SearchPharmaciesHandler.java
|   |                                           <- Nearby pharmacy search through Google Places
|   |
|   |-- pom.xml                               <- Java 21 Maven configuration
|   |-- template.yaml                         <- AWS SAM, Lambda, API Gateway, and DynamoDB resources
|   `-- README.md                             <- Backend setup and endpoint notes
|
|-- public/favicon.ico                        <- Static site icon
|-- .env.example                              <- Example environment variables
|-- package.json                              <- Frontend dependencies and scripts
|-- package-lock.json                         <- npm dependency lockfile
|-- bun.lock                                  <- Bun dependency lockfile
|-- bunfig.toml                               <- Bun configuration
|-- components.json                           <- UI component configuration
|-- eslint.config.js                          <- ESLint configuration
|-- tsconfig.json                             <- Path alias and tooling configuration
|-- tsr.config.json                           <- TanStack Router generation configuration
|-- vite.config.js                            <- Vite/TanStack Start configuration
|-- .prettierrc                               <- Prettier configuration
|-- .prettierignore                           <- Prettier ignore rules
`-- .gitignore                                <- Git ignore rules
```

## What Is Currently Implemented

### Patient search

- Search for a medication name.
- Receive medication-name suggestions from the RxNorm API.
- Use browser geolocation when permission is available.
- Search within a radius of 1, 2, 5, 10, or 20 km.
- Retrieve nearby pharmacies from Google Places.
- Display pharmacy name, address, distance, rating, opening status, and phone number when available.
- Filter the results to pharmacies that are currently open.

The current interface displays pharmacy results as a list. It does not display an interactive map yet.

### Accounts

- Register as a patient or pharmacist.
- Log in using email and password.
- Store the logged-in user in browser `localStorage` for the current frontend session.

### Pharmacist features

- Register one pharmacy profile.
- View whether the pharmacy is pending or approved.
- Add, update, list, and delete inventory items.
- Store medicine name, quantity, and in-stock status.

### Admin features

- View pharmacies.
- Approve or revoke pharmacy registrations.
- View registered users.

## Java Backend

The AWS SAM template defines Java 21 Lambda handlers that use these existing DynamoDB tables:

- `DawaaUsers`
- `DawaaInventory`
- `DawaaPharmacies`
- `DawaaMedicines`

Implemented API routes:

```text
POST   /auth/register
POST   /auth/login
GET    /medicines/search?name={brandName}
GET    /inventory/availability?medicineId={medicineId}
POST   /pharmacies
GET    /pharmacies/mine?pharmacistId={id}
POST   /pharmacies/search
GET    /admin/users
GET    /admin/pharmacies
POST   /admin/pharmacies/{id}/approve
```

## Current Limitations

- The medication keyword is sent to the pharmacy-search backend but is not currently used to filter Google Places results.
- Patient medicine search can show raw inventory availability, but it does not yet join those results to full registered pharmacy details.
- The optional city/area text field is collected by the frontend but is not currently used by the search logic.
- There is no Cognito, JWT, token, or real role-based authorization yet.
- The Java login implementation returns user data but does not create a session or access token.
- The frontend admin account is available only in the local in-memory fallback; the Java backend does not seed an admin account.
- No automated backend or frontend tests are included.
- The repository contains deployment configuration, but this alone does not confirm that the AWS resources are deployed.

## Local and Backend Modes

When `DAWAA_API_BASE_URL` is configured, the frontend sends account, pharmacy, inventory, admin, and search requests to the Java backend.

When it is not configured:

- Account, pharmacy, inventory, and admin data use temporary in-memory stores and are lost when the server restarts.
- Pharmacy search uses the Lovable Google Maps connector and requires both `LOVABLE_API_KEY` and `GOOGLE_MAPS_API_KEY`.

Environment variables:

```env
DAWAA_API_BASE_URL=""
LOVABLE_API_KEY=""
GOOGLE_MAPS_API_KEY=""
```

## Run the Frontend

```bash
npm install
npm run dev
```

## Build the Java Backend

```bash
cd backend
mvn clean package
sam build
```
