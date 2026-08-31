# Care Compass / Dawaa

Dawaa is a medication availability prototype for Lebanon. The application helps patients and caregivers search for a medicine, view nearby approved pharmacies that report availability, and open route guidance to a selected pharmacy. It also includes pharmacist-facing inventory and pharmacy management screens, admin approval tools, and a Java 21 AWS Lambda-compatible backend.

## Submission Links

- GitHub repository: https://github.com/Care-Compass-Dawaa/Dawaa.git
- Deployed backend API: https://ozgyyjnp1b.execute-api.eu-north-1.amazonaws.com/Prod

The deployed backend stores required server-side API keys securely in AWS. Private API keys, AWS credentials, and routing provider keys are not included in this repository or in the final report.

## Reviewer Quick Start

Reviewers who only need to run the frontend demo do not need AWS credentials, DynamoDB access, SAM, or private API keys.

```bash
git clone https://github.com/Care-Compass-Dawaa/Dawaa.git
cd Dawaa
npm install
cp .env.example .env.local
```

Set the deployed backend URL in `.env.local`:

```env
VITE_DAWAA_API_BASE_URL="https://ozgyyjnp1b.execute-api.eu-north-1.amazonaws.com/Prod"
DAWAA_API_BASE_URL="https://ozgyyjnp1b.execute-api.eu-north-1.amazonaws.com/Prod"
```

On Windows PowerShell, use this instead of `cp` if needed:

```powershell
Copy-Item .env.example .env.local
```

Then run the frontend:

```bash
npm run dev
```

The app will print a local Vite URL, usually:

```text
http://localhost:5173
```

## Frontend Commands

```bash
npm install
npm run dev
npm run build
```

The frontend is built with React, TanStack Start, Vite, and Tailwind CSS. The build output includes Cloudflare-compatible output under `.output/`.

## Backend Developer Setup

Backend deployment or infrastructure changes require Java 21, Maven, AWS CLI, AWS SAM CLI, and valid AWS credentials. These are not required for ordinary reviewer/demo usage.

```bash
cd backend
mvn clean package
sam build
sam deploy --config-file samconfig.toml
```

The backend is deployed through AWS API Gateway and Java Lambda functions. DynamoDB table names, OpenRouteService configuration, and other backend-only settings are handled through the AWS SAM template and Lambda environment variables.

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
|   |   |-- pharmacies.functions.js           <- Frontend server functions and AWS API adapters
|   |   |-- error-capture.js                  <- Error capture helper
|   |   |-- error-page.js                     <- Error page renderer
|   |   `-- lovable-error-reporting.js        <- Error reporting helper
|   |
|   |-- router.jsx                            <- TanStack Router setup
|   |-- routeTree.gen.ts                      <- Generated route tree
|   |-- server.js                             <- Server entry wrapper
|   |-- start.js                              <- TanStack Start setup
|   `-- styles.css                            <- Global Tailwind CSS styles
|
|-- backend/
|   |-- src/main/java/com/dawaa/
|   |   |-- api/                              <- AWS Lambda HTTP handlers
|   |   |-- business/                         <- Service layer and application rules
|   |   |-- domain/                           <- Domain records and repository contracts
|   |   |-- persistence/                      <- DynamoDB and OpenRouteService integrations
|   |   `-- common/                           <- Shared handler utilities
|   |
|   |-- pom.xml                               <- Java 21 Maven configuration
|   |-- template.yaml                         <- AWS SAM resources, routes, env vars, and permissions
|   |-- samconfig.toml                        <- SAM deployment configuration
|   `-- README.md                             <- Backend setup and endpoint notes
|
|-- .env.example                              <- Example non-secret environment variables
|-- package.json                              <- Frontend dependencies and scripts
|-- package-lock.json                         <- npm dependency lockfile
|-- vite.config.js                            <- Vite/TanStack Start configuration
`-- README.md                                <- Project setup and feature notes
```

## Backend Architecture

The backend uses a layered structure:

- `api`: Lambda handlers that receive API Gateway requests, parse inputs, call services, and return HTTP responses.
- `business`: service classes that apply validation, role checks, account state checks, pharmacy approval rules, inventory rules, and routing workflows.
- `domain`: core records/enums and repository interfaces for users, pharmacies, medicines, inventory, and routes.
- `persistence`: DynamoDB repositories and OpenRouteService client code. This layer handles table keys, indexes, item mapping, and external routing calls.
- `template.yaml`: infrastructure configuration for Lambda functions, API Gateway routes, DynamoDB permissions, and environment variables.

## Implemented Features

### Patient Search

- Search medicines by brand or generic name.
- Use browser location permission when available.
- Search approved pharmacies carrying a selected medicine.
- Display pharmacy name, address, area, distance, opening status, and phone number when available.
- Open a map view and route guidance to a selected pharmacy.
- Avoid exposing exact stock quantities to patients; low stock is shown as a general availability warning.

### Accounts

- Register as a patient or pharmacist.
- Log in with email and password.
- Store only the returned user profile in browser storage, not the password hash.
- Edit personal name/email/password.
- Deactivate non-admin accounts.
- Store new and updated passwords using bcrypt hashing.

### Pharmacist Features

- Register one pharmacy profile for the MVP.
- View pharmacy approval status.
- Edit pharmacy contact information, coordinates, and schedule.
- Add, update, search, and delete inventory items.
- Prevent duplicate medicine entries in the same pharmacy inventory.

### Admin Features

- View users.
- Activate or deactivate non-admin users.
- View pharmacies.
- Approve or revoke pharmacy registrations.
- Admin accounts are created manually and are not available through public signup.

### Routing

- Route directions are handled through backend endpoints backed by OpenRouteService.
- The routing API key is stored server-side in AWS Lambda configuration and is not exposed to frontend users.

## Java Backend Routes

The AWS SAM template defines Java 21 Lambda handlers for routes including:

```text
POST   /auth/register
POST   /auth/login
GET    /users/me
POST   /users/me/update
DELETE /users/me
GET    /admin/users
GET    /admin/users/{id}
GET    /admin/users/by-email
DELETE /admin/users/{id}
POST   /admin/users/{id}/activate
GET    /medicines/search
GET    /medicines/suggestions
GET    /inventory/availability
GET    /inventory/{requesterUserId}
POST   /inventory
DELETE /inventory/{medicineId}
POST   /pharmacies
GET    /pharmacies/mine
POST   /pharmacies/mine/update
POST   /pharmacies/mine/schedule
GET    /pharmacies/{id}
GET    /admin/pharmacies
GET    /admin/pharmacies/{id}
POST   /admin/pharmacies/{id}/approve
GET    /pharmacies/nearby
POST   /pharmacies/search
POST   /routes/directions
```

## Environment Variables

Frontend/reviewer `.env.local`:

```env
VITE_DAWAA_API_BASE_URL="https://ozgyyjnp1b.execute-api.eu-north-1.amazonaws.com/Prod"
DAWAA_API_BASE_URL="https://ozgyyjnp1b.execute-api.eu-north-1.amazonaws.com/Prod"
```

Backend-only environment variables are configured in AWS/SAM and should not be placed in public documentation:

```text
OPENROUTESERVICE_API_KEY
OPENROUTESERVICE_PROFILE
USERS_TABLE
PHARMACIES_TABLE
MEDICINES_TABLE
INVENTORY_TABLE
```

