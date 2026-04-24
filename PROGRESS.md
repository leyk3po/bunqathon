# Progress

## Backend Phases

### Phase 1: Contract Stabilization
Status: Completed

Scope:
- add `/api/v1` route prefix
- define response schemas for endpoints
- remove direct `state` mutation from generic update payloads
- keep lifecycle changes behind explicit action endpoints
- stabilize route/module naming so the frontend can depend on the API shape

Delivered:
- API routers mounted under `/api/v1`
- typed response models for health, media upload, webhook callback, and API meta
- `DropUpdate` no longer accepts `state`
- `publish` remains the explicit lifecycle action endpoint

### Phase 2: Lifecycle and Persistence
Status: In Progress

Scope:
- formalize allowed drop state transitions
- add Alembic migrations
- introduce an event log table for webhook and drop events
- persist publish/payment-related events in a recoverable way

Progress:
- [x] Add Alembic migrations
- [ ] Formalize allowed drop state transitions
- [ ] Introduce an event log table
- [ ] Persist publish/payment-related events

### Phase 3: Frontend-Unblocking Flow
Status: Pending

Scope:
- make upload, preview, create, publish, fetch, and SSE endpoints stable
- document payload shapes for the frontend
- keep the stubbed AI and bunq adapters predictable for UI integration

### Phase 4: Integration Hardening
Status: Pending

Scope:
- replace bunq stub with real sandbox integration
- replace AI stub with real provider calls
- make webhook processing idempotent
- model multiple payment attempts correctly
- add service-layer tests for payment and lifecycle behavior
