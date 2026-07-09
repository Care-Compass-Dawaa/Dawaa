# Current Feature Notes

## Implemented Feature

The current implementation focuses on the patient-facing medicine/pharmacy search flow:

- Users can search for a medication name.
- Medication autocomplete uses RxNorm.
- The app requests the user's browser location.
- Nearby pharmacies are displayed as a list and on a Google Map.
- Pharmacy details can include address, phone number, rating, distance, and open/closed status when provided by Google.
- The frontend is implemented with JavaScript and React.
- A Java 21 AWS Lambda-compatible backend implementation has been added for pharmacy search.

## Current Language Alignment

This feature now matches the planned programming-language direction from the design document:

- Frontend: JavaScript with React.
- Backend logic: Java 21.
- Backend build tool: Maven.
- Serverless structure: AWS SAM / AWS Lambda-compatible handler.

## Missing or Incomplete for This Feature

- Real medication stock availability is not implemented.
  - The app finds nearby pharmacies, but it does not confirm that a pharmacy has the searched medicine in stock.

- The searched medication name is not used to verify pharmacy inventory.
  - Searching for a medicine currently leads to a nearby pharmacy search, not a stock-specific inventory search.

- The local Google Maps browser key may not work on localhost.
  - If the Google key blocks `localhost`, the map shows a Google Maps error until a valid key/referrer configuration is provided.

- Open/closed filtering is incomplete.
  - The app can display open/closed status when Google provides it, but there is no dedicated user filter to show only open pharmacies.

- Map failure fallback UI can be improved.
  - When Google Maps fails to load, the default Google error appears instead of a polished in-app fallback message.

- The Java backend is not deployed yet.
  - The backend compiles locally, but it has not been deployed to AWS Lambda/API Gateway.

- The frontend is not connected to a deployed Java backend yet.
  - The frontend supports `DAWAA_API_BASE_URL`, but without a deployed backend URL it continues to use the existing local fallback path.

- Automated tests are not added yet.
  - There are no unit/integration tests for the Java handler, frontend search flow, or server function adapter.

- Postman/API testing artifacts are not added yet.
  - A Postman collection for `POST /pharmacies/search` would make backend testing easier.

## Important Functional Note

The current feature should be described as:

> A patient-facing medicine search flow that finds nearby pharmacies, not a confirmed medicine stock availability system.

