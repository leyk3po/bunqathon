# FlashDrop

**2nd Place at bunq Multi-modal Hackathon 7.0**

FlashDrop turns any real world object into an instant, pay ready storefront. Point your phone at something, speak a one line pitch, and AI generates a product title, description, price, and visual card in seconds, complete with a QR code for instant payment via bunq.

No online shop to build. No listing to write. Just point, speak, and sell.

## How it works

1. **Capture** — snap a photo and record a short voice pitch
2. **Generate** — multimodal AI turns it into a polished storefront (title, copy, price, visual)
3. **Publish** — a public payment page and QR code go live instantly
4. **Sell** — buyers scan, pay through bunq, and the seller's screen updates in real time

Built for student clubs, artists, flea market sellers, and pop up vendors, anyone who needs to go from object to sale in under a minute.

## Why it's different

Most fintech hackathon projects are dashboards or budgeting tools. FlashDrop makes bunq the live payment engine behind a real physical commerce moment, camera in, cash out.

## Stack

- **Frontend:** React + Capacitor (web & mobile from one codebase)
- **Backend:** FastAPI
- **Database:** PostgreSQL
- **Storage:** S3
- **Payments:** bunq API (bunq.me tabs + webhooks)
- **AI:** Multimodal generation for product understanding and copy

## Architecture

```
Seller / Buyer → React App → FastAPI Backend → PostgreSQL / S3
                                   ↓        ↑
                               bunq API → Webhook
```

---

*Built in 24 hours for bunq Multimodal Hackathon 7.0.*
