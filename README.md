# Care Compass / Dawaa

Patient-facing medicine search feature for finding nearby pharmacies, with a React frontend and a Java 21 AWS Lambda-compatible backend implementation.

## Project Structure

```text
-firstTryLovable-find-my-meds-map/
|-- src/                                      <- Main frontend application code
|   |-- routes/                               <- App routes and pages
|   |   |-- index.jsx                         <- Main medicine/pharmacy search page
|   |   |-- __root.jsx                        <- Root layout, metadata, and error boundary
|   |   `-- README.md                         <- Route conventions
|   |
|   |-- lib/                                  <- Frontend/server helper logic
|   |   |-- pharmacies.functions.js           <- Pharmacy search server function adapter
|   |   |-- error-capture.js                  <- Error capture helper
|   |   |-- error-page.js                     <- Error page renderer
|   |   `-- lovable-error-reporting.js        <- Lovable error reporting helper
|   |
|   |-- router.jsx                            <- TanStack Router setup
|   |-- routeTree.gen.js                      <- Generated JavaScript route tree
|   |-- server.js                             <- Server entry wrapper
|   |-- start.js                              <- TanStack Start setup
|   `-- styles.css                            <- Global styles and Tailwind CSS
|
|-- backend/                                  <- Java backend implementation
|   |-- src/main/java/com/dawaa/pharmacies/
|   |   `-- SearchPharmaciesHandler.java      <- Java 21 Lambda handler for pharmacy search
|   |
|   |-- pom.xml                               <- Maven build configuration
|   |-- template.yaml                         <- AWS SAM Lambda/API Gateway template
|   `-- README.md                             <- Backend setup notes
|
|-- public/
|   `-- favicon.ico                           <- Static site icon
|
|-- CURRENT_FEATURE_NOTES.md                  <- Implemented feature status and limitations
|-- .env.example                              <- Example environment variables
|-- package.json                              <- Frontend dependencies and scripts
|-- bun.lock                                  <- Dependency lockfile
|-- bunfig.toml                               <- Bun configuration
|-- components.json                           <- UI component configuration
|-- eslint.config.js                          <- ESLint configuration
|-- tsconfig.json                             <- Path alias/tooling configuration
|-- tsr.config.json                           <- TanStack Router JavaScript generation config
|-- vite.config.js                            <- Vite/TanStack Start configuration
|-- .prettierrc                               <- Prettier formatting configuration
|-- .prettierignore                           <- Prettier ignore rules
|-- .gitignore                                <- Git ignore rules
`-- AGENTS.md                                 <- Lovable/Codex project guidance
```

## Current Feature

The current implemented feature lets a patient search for a medication name, get medication suggestions from RxNorm, and view nearby pharmacies through Google Maps/Places.

Important note: the current feature finds nearby pharmacies, but it does not confirm real medication stock availability yet.
