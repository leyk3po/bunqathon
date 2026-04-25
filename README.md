  # FlashDrop

  FlashDrop is an AI-powered instant pop-up storefront for physical spaces. A seller points a phone at something in the real world, speaks a short pitch,
  and the app turns that moment into a polished, pay-ready storefront powered by bunq.

  The core idea is simple: instead of building a full online shop, we let anyone create a temporary “drop” from a real-world object, poster, food item,
  artwork, or event in seconds.

  ## The concept

  A user opens the app, takes a photo or short video, and records a quick voice pitch such as:

  “This is a handmade tote bag, only five left, support our student design club.”

  The app uses multimodal AI to understand the image and voice input, then generates:

  - a product title
  - short sales copy
  - a suggested price
  - a visual storefront card
  - a public payment page
  - a QR code linked to bunq

  A buyer scans the QR code and pays. When the payment succeeds, the storefront updates live and the seller sees inventory change immediately.

  ## What makes this interesting

  Most hackathon finance demos are budgeting tools, dashboards, or chatbots. FlashDrop is different because it turns bunq into the engine for a live
  physical commerce experience.

  This is not “AI shopping advice” and not “expense tracking.” It is real-time commerce from the physical world.

  The wow moment is:

  - point the camera at a random object
  - say one sentence
  - AI turns it into something desirable
  - bunq turns it into something payable
  - the payment instantly changes the experience on screen

  ## Who it is for

  FlashDrop is designed for lightweight real-world selling:

  - student clubs selling merch
  - artists at booths
  - thrift or flea market sellers
  - charity drives
  - campus events
  - food and drink pop-ups
  - demo-day or hackathon merch tables

  ## User flow

  ### Seller flow

  - open the app
  - capture a photo or video
  - record a short voice pitch
  - review the AI-generated storefront
  - publish the drop
  - show the QR code to nearby buyers
  - watch payments and stock update live

  ### Buyer flow

  - scan the QR code
  - open the public storefront page
  - view the item and price
  - pay through bunq
  - receive confirmation while the seller screen updates in real time

  ## Why bunq is central

  bunq is not just a payment button in the background. It is a core part of the product.

  We use bunq for:

  - creating the payment flow behind each drop
  - generating the buyer-facing payment experience
  - receiving payment updates through webhooks
  - driving the live storefront state after a successful payment

  That means the bunq API is part of the actual product interaction, not just an implementation detail.

  ## Why multimodal AI matters

  The AI is responsible for the part most people struggle with when selling casually:

  - understanding what is being sold from the camera input
  - turning rough real-world context into clean product language
  - helping with pricing and framing
  - generating a visual that makes the drop feel intentional

  Without AI, the seller still has a payment link. With AI, they get a storefront.

  ## Hackathon scope

  This is a prototype, so we are intentionally keeping the first version narrow.

  ### MVP

  - React frontend
  - Capacitor mobile wrapper
  - FastAPI backend
  - seller can create a drop from image + voice
  - AI generates title, description, and visual card
  - backend creates bunq payment link / QR flow
  - buyer can open the public drop page
  - successful payment updates the drop state
  - seller sees live success state and reduced inventory

  ### Stretch goals

  - limited-edition drops
  - countdown timer
  - multiple quantity support
  - AI-generated collectible receipt or thank-you card
  - seller analytics
  - saved drop templates
  - better live animations for sold-out / paid states

  ### Non-goals for the hackathon

  - full marketplace
  - advanced user account management
  - native iOS release
  - complex inventory back office
  - full payout reconciliation system
  - multi-vendor admin platform

  ## Tech stack

  We want the stack to be simple enough to build fast but clean enough to grow.

  ### Frontend

  - React for the web app
  - Capacitor for mobile packaging
  - one shared UI and business flow across web and mobile

  ### Backend

  - FastAPI for the API and webhook handling
  - PostgreSQL for persistent data
  - S3 for media uploads and generated assets

  ### Infrastructure

  For the hackathon, we should keep infrastructure simple:

  - Amplify Hosting for the React app
  - one FastAPI container deployed on AWS
  - PostgreSQL database
  - S3 bucket for uploads
  - bunq API for payments
  - multimodal AI API for generation

  We should avoid over-engineering with too many services on day one.

  ## Suggested architecture

  The simplest architecture that still makes sense is:

  - one frontend
  - one backend
  - one database
  - one object store

  That means:

  - the React app handles seller and buyer pages
  - the FastAPI backend handles bunq integration, AI orchestration, and public drop data
  - PostgreSQL stores drops, users, and payments
  - S3 stores uploaded media and generated assets

  If we need to scale later, we can split out background jobs and real-time infrastructure. We do not need that on day one.

  ## Core product object: the drop

  A drop is the central object in the system.

  A drop includes:

  - seller identity
  - uploaded media
  - AI-generated title
  - AI-generated description
  - price
  - inventory count
  - bunq payment reference
  - public page slug
  - lifecycle state

  The drop lifecycle is:

  - draft
  - live
  - sold out
  - archived

  ## Demo story

  The best demo is physical and immediate.

  - place a few real objects on a table
  - pick one live
  - take a photo
  - record a one-line pitch
  - let AI generate the storefront
  - show the QR on a projector
  - have someone pay
  - show inventory drop and payment success live

  That tells the whole story in under two minutes.

  ## Why this can win

  FlashDrop has a strong hackathon profile because it is:

  - easy to understand in seconds
  - visually demoable
  - clearly powered by bunq
  - clearly powered by multimodal AI
  - not a generic finance dashboard
  - useful in real physical contexts

  It feels like a product, not just a tech demo.
  
  flowchart TB
      Seller[Seller on React Web or Capacitor App]
      Buyer[Buyer on Public Web Page]

      Seller --> Frontend[React App]
      Buyer --> Frontend

      Frontend --> API[FastAPI App\nsingle deployed backend]

      API --> DB[(PostgreSQL)]
      API --> S3[(S3 for uploads/assets)]
      API --> Bunq[bunq API]
      API --> AI[Multimodal AI API]

      Bunq --> Webhook[bunq Webhook Callback]
      Webhook --> API
      
      
  - Amplify Hosting for the React web app
  - Lightsail Container Service for one Dockerized FastAPI app
  - Lightsail PostgreSQL or RDS PostgreSQL for the database
  - S3 for media

  ———

  References:

  - bunq callbacks/webhooks: https://doc.bunq.com/basics/callbacks-webhooks
  - bunq.me tabs: https://doc.bunq.com/api-reference/bunqme/bunqme-tab
  - AWS Amplify Hosting: https://docs.aws.amazon.com/amplify/latest/userguide/welcome.html
  - AWS Lightsail containers: https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-container-services.html
  - AWS Lightsail databases: https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-databases.html
