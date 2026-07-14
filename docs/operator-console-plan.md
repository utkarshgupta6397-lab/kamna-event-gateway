# Operator Console Plan

## Current Architecture
The Kamna Event Gateway is built as a stateless, high-performance Node.js application utilizing Fastify for HTTP routing, TypeScript for strict type safety, and SQLite with Drizzle ORM for persistence. The architecture heavily relies on domain-driven design, decoupling incoming HTTP requests into an abstract `DomainEvent`, planning fan-out tasks into `Deliveries` based on the `Destination Registry`, and executing them synchronously via a plugin-based `Transport Layer` (currently implementing `HttpTransport`).

## Existing APIs
- **Health**: `GET /health`
- **Events**: 
  - `POST /events/test` (Ingest Event)
  - `GET /events` (List latest events)
  - `GET /events/:id` (Get specific event)
  - `GET /events/:eventId/deliveries` (List deliveries for an event)
- **Destinations (Registry)**:
  - `GET /destinations` (List all)
  - `POST /destinations` (Create new)
  - `PATCH /destinations/:id` (Update configuration)
  - `DELETE /destinations/:id` (Remove destination)
- **Deliveries**:
  - `GET /deliveries` (List all deliveries)
  - `GET /deliveries/:id` (Get specific delivery)
- **Dispatcher**:
  - `POST /dispatch/:deliveryId` (Manual dispatch trigger)
- **Debug**:
  - `POST /debug/receiver/a`
  - `POST /debug/receiver/b`

## Existing Database Tables
- **`events`**: Stores normalized events (`eventId`, `source`, `type`, `payload`, `metadata`, `receivedAt`, `processingTimeMs`, `status`).
- **`destinations`**: Stores subscriber configuration (`name`, `type`, `url`, `enabled`, `priority`, `timeoutMs`, `headers`, `authentication`).
- **`deliveries`**: Stores the delivery execution intents and results (`eventId`, `destinationId`, `status`, `attempt`, `queuedAt`, `startedAt`, `completedAt`, `responseCode`, `responseBody`, `latencyMs`, `error`).

## Existing Components
- **EventNormalizer**: Converts inbound Fastify HTTP requests into agnostic domain events.
- **DeliveryPlanner**: Evaluates enabled Destinations against an incoming Event to create pending Deliveries.
- **DispatcherService**: The execution engine that resolves the transport plugin and executes the network request.
- **TransportRegistry**: Abstract plugin registry mapping destination types (`webhook`, `http`, `kafka`) to execution strategies.

## Reusable code
- The Drizzle schema definitions and TypeScript interfaces (`DomainEvent`, `DestinationType`, `DeliveryRecord`).
- Core Service layers (`eventService`, `destinationService`, `deliveryService`) that cleanly wrap SQL queries and can be exposed directly to UI-facing API routes.

## Missing APIs required for UI
To support a robust Operator Console without crashing the browser, the backend must be extended with:
1. **Pagination, Sorting, and Filtering**: The current `GET /events` and `GET /deliveries` endpoints fetch *all* records. We need limit, offset, and status-based filtering.
2. **Dashboard Metrics Endpoint**: An API to fetch aggregated stats (e.g., total events today, success/failure rate of deliveries, average latency).
3. **CORS Support**: `@fastify/cors` must be installed and configured to allow the frontend to safely query the backend.

## Frontend Architecture
- **Framework**: React 18+ via Vite (Single Page Application).
- **Styling**: Tailwind CSS + Shadcn UI (for accessible, premium, and reusable atomic components like Tables, Modals, and Badges).
- **State Management**: TanStack Query (React Query) for server state caching and synchronization; minimal Context API for local UI state (like dark mode).
- **Language**: TypeScript (sharing types with the backend where possible).

## Proposed Folder Structure
```text
kamna-event-gateway/
├── src/                  # Existing Backend
├── docs/
├── ui/                   # NEW: React Frontend
│   ├── src/
│   │   ├── assets/       # Images, icons, global css
│   │   ├── components/   # Shared UI components (Buttons, Modals)
│   │   ├── features/     # Domain-specific components (EventsTable, DestinationForm)
│   │   ├── hooks/        # Custom React hooks & React Query mutations
│   │   ├── layouts/      # Dashboard Sidebar & Header layout
│   │   ├── pages/        # Route components (Dashboard, Events, Destinations)
│   │   ├── services/     # Axios/fetch API client
│   │   ├── types/        # Shared frontend TS types
│   │   └── App.tsx       # Router configuration
│   ├── package.json
│   └── vite.config.ts
```

## React Architecture
The UI will follow a feature-sliced architecture. Global layout wraps the application with a persistent navigation sidebar. Domain features (Destinations, Events, Deliveries) encapsulate their own data-fetching hooks, rendering logic, and forms, keeping the global `pages` layer extremely thin.

## Routing Plan
- `/` - **Dashboard**: High-level metrics, recent failed deliveries, throughput charts.
- `/events` - **Event Log**: Paginated table of ingested events.
- `/events/:id` - **Event Details**: Deep dive into the payload, metadata, and a sub-table of the fan-out deliveries spawned by this event.
- `/destinations` - **Registry Management**: Table of active destinations, with modals to Create, Edit, or Toggle (Enable/Disable).
- `/deliveries` - **Delivery Log**: Paginated table showing transport success/failure, latency, and HTTP response body debugging.

## Component Hierarchy
```text
App
 └── DashboardLayout
      ├── SidebarNavigation
      ├── Topbar (Theme toggle, Connection Status)
      └── Outlet (Page Content)
           ├── DashboardPage (MetricsCards, RecentErrorsList)
           ├── DestinationsPage (DestinationsTable, CreateDestinationModal)
           ├── EventsPage (EventsTable, SearchFilterBar)
           └── EventDetailsPage (PayloadViewer, DeliveriesSubTable)
```

## UI State Management
- **Server State**: Managed strictly by `@tanstack/react-query`. This handles loading states, error states, and automatic background refetching (essential for a live operations console).
- **Local State**: Managed by standard `useState` (for modal visibility, form state) and `useContext` for global preferences like dark mode.
- **Form State**: Managed by `react-hook-form` + `zod` for robust validation matching the backend schema.

## API Layer
An Axios instance will be configured in `ui/src/services/apiClient.ts` with a base URL pointing to the Fastify server (`http://localhost:3004`). API wrapper functions will be strictly typed using TypeScript interfaces mirroring the Drizzle ORM schemas.

## Risks
1. **Performance (No Pagination)**: If the UI is built before backend pagination is implemented, fetching thousands of events will freeze the browser and crash the Node server via out-of-memory errors.
2. **Security (No Auth)**: Exposing the Operator Console on the internet allows anyone to alter the routing registry or view sensitive event payloads. A basic auth layer must be implemented before exposing the UI to production.
3. **CORS Errors**: The frontend (running on e.g., Vite port 5173) will be blocked by the browser when calling Fastify (port 3004) unless Fastify explicitly allows the origin.

## Estimated implementation order
1. **Backend Prep**: Add `@fastify/cors` and implement pagination/filtering on `GET /events` and `GET /deliveries`.
2. **Frontend Scaffolding**: Initialize Vite React project, install Tailwind CSS and Shadcn UI.
3. **API Client & Routing**: Setup React Router and Axios/React Query client.
4. **Destinations MVP**: Build the Destinations table, and Create/Edit forms.
5. **Event Logs MVP**: Build the Events table and Payload details view.
6. **Deliveries MVP**: Build the Deliveries table with response body debugging.
7. **Dashboard**: Implement aggregated metrics and overview page.
8. **Polish**: Add dark mode, responsive styling, and loading skeletons.
