import { BrowserRouter, Navigate, NavLink, Outlet, Route, Routes, useLocation } from "react-router-dom";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

const primaryTabs = [
  { label: "Home", to: "/" },
  { label: "Create", to: "/create" },
  { label: "Preview", to: "/preview" },
];

function getScreenMeta(pathname: string) {
  if (pathname === "/") {
    return {
      title: "FlashDrop",
      subtitle: "A browser-first mobile shell for the live commerce prototype.",
    };
  }

  if (pathname.startsWith("/create")) {
    return {
      title: "Create Drop",
      subtitle: "Camera, mic, and draft flow will plug into this screen next.",
    };
  }

  if (pathname.startsWith("/preview")) {
    return {
      title: "Preview",
      subtitle: "Use this screen to shape the AI output and seller story.",
    };
  }

  if (pathname.startsWith("/drop/")) {
    return {
      title: "Public Drop",
      subtitle: "Buyer-facing storefront shell for QR and payment flows.",
    };
  }

  return {
    title: "FlashDrop",
    subtitle: "Mobile-first shell.",
  };
}

function RootLayout() {
  const location = useLocation();
  const screenMeta = getScreenMeta(location.pathname);

  return (
    <div className="mobile-shell">
      <div className="mobile-chrome">
        <div className="status-strip">
          <span>9:41</span>
          <span>flashdrop.app</span>
        </div>

        <header className="app-header">
          <div>
            <p className="app-kicker">Browser-first PWA</p>
            <h1>{screenMeta.title}</h1>
            <p className="app-subtitle">{screenMeta.subtitle}</p>
          </div>
          <div className="badge-cluster">
            <span className="badge">PWA</span>
            <span className="badge">Mobile</span>
          </div>
        </header>

        <main className="screen-body">
          <Outlet />
        </main>

        <nav className="bottom-nav" aria-label="Primary navigation">
          {primaryTabs.map((tab) => (
            <NavLink
              key={tab.to}
              className={({ isActive }) => `nav-pill${isActive ? " is-active" : ""}`}
              to={tab.to}
            >
              <span>{tab.label}</span>
            </NavLink>
          ))}
          <NavLink
            className={({ isActive }) => `nav-pill${isActive ? " is-active" : ""}`}
            to="/drop/demo-drop"
          >
            <span>Drop</span>
          </NavLink>
        </nav>
      </div>
    </div>
  );
}

function CapabilityRow({
  label,
  detail,
  status,
}: {
  label: string;
  detail: string;
  status: "ready" | "pending";
}) {
  return (
    <div className="capability-row">
      <div>
        <h3>{label}</h3>
        <p>{detail}</p>
      </div>
      <span className={`status-dot status-${status}`}>{status === "ready" ? "Ready" : "Next"}</span>
    </div>
  );
}

function HomeScreen() {
  const isSecureContextLabel = window.isSecureContext ? "Secure context available" : "HTTPS needed on device";

  return (
    <div className="screen-stack">
      <section className="hero-card hero-card-home">
        <p className="eyebrow">Native-feeling mobile web</p>
        <h2>One codebase, mobile browser UX, no app store dependency.</h2>
        <p>
          This shell is designed to feel like an app inside Safari and Chrome while staying
          browser-first for camera, microphone, bunq checkout, and fast iteration.
        </p>
        <div className="hero-actions">
          <a className="button-primary" href="/create">
            Start the seller flow
          </a>
          <a className="button-secondary" href={`${apiBaseUrl}/docs`} target="_blank" rel="noreferrer">
            API docs
          </a>
        </div>
      </section>

      <section className="stack-card">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Current shell</p>
            <h3>What is already in place</h3>
          </div>
          <span className="muted-chip">{isSecureContextLabel}</span>
        </div>
        <div className="capability-list">
          <CapabilityRow
            label="Mobile layout system"
            detail="Safe-area spacing, bottom navigation, full-height screen framing, and app-style transitions."
            status="ready"
          />
          <CapabilityRow
            label="Route-based screens"
            detail="Dedicated paths for seller home, create, preview, and public drop pages."
            status="ready"
          />
          <CapabilityRow
            label="Media capture flows"
            detail="Camera and microphone entry points will plug into the create screen next."
            status="pending"
          />
        </div>
      </section>

      <section className="stack-card inset-grid">
        <article className="mini-panel">
          <p className="eyebrow">PWA</p>
          <h3>Installable shell</h3>
          <p>
            Standalone manifest, theme color, and service worker registration are wired so the app
            can behave like a mobile product instead of a plain site.
          </p>
        </article>
        <article className="mini-panel">
          <p className="eyebrow">Backend</p>
          <h3>FastAPI base</h3>
          <p>
            The frontend is already pointed at <code>{apiBaseUrl}</code> and can start consuming
            upload, drop, and webhook endpoints as they land.
          </p>
        </article>
      </section>
    </div>
  );
}

function CreateScreen() {
  return (
    <div className="screen-stack">
      <section className="hero-card hero-card-create">
        <p className="eyebrow">Seller capture flow</p>
        <h2>Camera and microphone belong here.</h2>
        <p>
          This page is shaped like a native capture screen already. Next, wire browser camera
          preview, voice recording, and upload orchestration into this frame.
        </p>
      </section>

      <section className="stack-card">
        <div className="phone-stage">
          <div className="camera-stage">
            <span className="stage-label">Camera preview area</span>
            <div className="stage-grid">
              <div className="stage-chip">Photo or video capture</div>
              <div className="stage-chip">Voice note prompt</div>
              <div className="stage-chip">Permission state</div>
            </div>
          </div>
          <div className="recording-dock">
            <button className="round-button" type="button">
              Capture
            </button>
            <div className="dock-copy">
              <h3>Ready for multimodal input</h3>
              <p>Use the browser media APIs here next. Keep everything triggered from user taps.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function PreviewScreen() {
  return (
    <div className="screen-stack">
      <section className="hero-card hero-card-preview">
        <p className="eyebrow">Seller review</p>
        <h2>Review the drop before publishing.</h2>
        <p>
          This route is ready for AI-generated title, description, image treatment, price, and
          publish actions once the create flow exists.
        </p>
      </section>

      <section className="stack-card">
        <article className="preview-card">
          <div className="preview-visual">
            <span>Generated hero visual</span>
          </div>
          <div className="preview-copy">
            <p className="eyebrow">Demo preview</p>
            <h3>Late-night tote drop</h3>
            <p>
              A placeholder preview card to help the team design around a realistic mobile review
              flow before the actual AI output is connected.
            </p>
            <div className="price-row">
              <strong>EUR 24.50</strong>
              <span>5 left</span>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}

function DropScreen() {
  return (
    <div className="screen-stack">
      <section className="hero-card hero-card-drop">
        <p className="eyebrow">Public storefront</p>
        <h2>This is the buyer-facing mobile page.</h2>
        <p>
          Keep this screen clean, fast, and QR-friendly. It will eventually hold the live bunq
          payment action, urgency state, and the most polished storytelling.
        </p>
      </section>

      <section className="stack-card storefront-card">
        <div className="storefront-hero">
          <div className="storefront-visual">FlashDrop</div>
          <div className="storefront-meta">
            <p className="eyebrow">Demo public drop</p>
            <h3>Midnight market bag</h3>
            <p>Small-batch tote from the design booth. Buyable in one scan.</p>
          </div>
        </div>
        <div className="storefront-footer">
          <div>
            <strong>EUR 24.50</strong>
            <p>QR and bunq payment will sit here.</p>
          </div>
          <a className="button-primary" href={apiBaseUrl} target="_blank" rel="noreferrer">
            Backend live
          </a>
        </div>
      </section>
    </div>
  );
}

function NotFoundScreen() {
  return (
    <div className="screen-stack">
      <section className="hero-card">
        <p className="eyebrow">Not found</p>
        <h2>This route does not exist yet.</h2>
        <p>Use the bottom navigation to move between the seeded mobile screens.</p>
      </section>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<RootLayout />}>
          <Route index element={<HomeScreen />} />
          <Route path="create" element={<CreateScreen />} />
          <Route path="preview" element={<PreviewScreen />} />
          <Route path="drop/:slug" element={<DropScreen />} />
          <Route path="*" element={<Navigate replace to="/" />} />
        </Route>
        <Route path="/404" element={<NotFoundScreen />} />
      </Routes>
    </BrowserRouter>
  );
}
