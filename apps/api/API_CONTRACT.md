# API Contract

This file documents the current frontend-facing backend flow for the FlashDrop PWA.

Base URL:

```text
http://127.0.0.1:8000/api/v1
```

## Primary seller flow

### 1. Upload media

`POST /media/upload`

Form field:

- `file`

Example response:

```json
{
  "url": "/media/demo-image.jpg",
  "absolute_url": "http://127.0.0.1:8000/media/demo-image.jpg",
  "content_type": "image/jpeg",
  "size": 183442
}
```

### 2. Generate preview copy

`POST /drops/generate-preview`

Example request:

```json
{
  "pitch": "handmade tote for our student design club, only five left",
  "media_url": "/media/demo-image.jpg"
}
```

Example response:

```json
{
  "title": "Midnight Handmade Tote For Our Drop",
  "description": "handmade tote for our student design club, only five left",
  "price_cents": 2450,
  "currency": "EUR"
}
```

### 3. Create draft drop

`POST /drops`

Example request:

```json
{
  "title": "Midnight Market Tote",
  "description": "Student-made tote bag from the design booth.",
  "pitch": "handmade tote for our student design club, only five left",
  "price_cents": 2450,
  "currency": "EUR",
  "inventory": 5,
  "media_url": "/media/demo-image.jpg",
  "seller_id": "demo-seller"
}
```

### 4. Fetch draft or published drop

`GET /drops/{slug}`

This is the main detail endpoint for the preview screen and public drop page.

### 5. Move to review

`POST /drops/{drop_id}/review`

Drafts must move to `review` before they can be published.

### 6. Publish

`POST /drops/{drop_id}/publish`

The backend creates a stub bunq payment target and returns a live drop with:

- `bunq_tab_url`
- `bunq_tab_uuid`
- `payments`

### 7. Subscribe to live updates

`GET /drops/{slug}/stream`

This endpoint returns Server-Sent Events.

The first event is always:

```text
event: snapshot
```

Example snapshot payload:

```json
{
  "type": "snapshot",
  "id": "drop-id",
  "slug": "midnight-market-tote-a1b2",
  "title": "Midnight Market Tote",
  "state": "live",
  "inventory": 5,
  "sold_count": 0,
  "price_cents": 2450,
  "currency": "EUR",
  "bunq_tab_url": "https://bunq.me/flashdrop/example",
  "media_url": "/media/demo-image.jpg"
}
```

Later events currently include:

- `published`
- `payment`
- `state_changed`

### 8. Mock a sandbox payment

`POST /drops/{drop_id}/mock-payment`

This is a sandbox-only demo endpoint. It marks the most recent pending bunq payment for the drop as paid and emits the same live updates the webhook flow would normally trigger.

### 9. Buyer QR flow

The frontend QR now points to a buyer checkout page inside the app rather than directly to the unstable bunq sandbox checkout.

That buyer page:

- loads the public drop by slug
- shows the item and amount on mobile
- triggers `POST /drops/{drop_id}/mock-payment` when the buyer taps pay
- redirects to a success screen after payment
- still exposes the real bunq sandbox URL as proof that the integration exists

### 10. Inspect persisted events

`GET /drops/{slug}/events`

This returns the durable event log for that drop. It is useful for debugging the seller flow and verifying webhook behavior.

## Current lifecycle

The current backend lifecycle is:

```text
draft -> review -> live -> partially_sold -> sold_out
                  live -> paused -> live/partially_sold
any active state -> archived
```

## Notes for the frontend

- `publish` is no longer allowed directly from `draft`
- use the `snapshot` SSE event as the initial live state
- `bunq_tab_url` is the current buyer-facing payment link
- bunq link creation is live, but sandbox checkout may need `POST /drops/{drop_id}/mock-payment` for demos when bunq sandbox buyer links do not resolve
