/**
 * Last-resort crash screen. Rendered by the top-level <ErrorBoundary> in
 * main.tsx, which sits OUTSIDE the Theme/Language/Auth providers — so this
 * component must not call any app hook. It leans only on the CSS custom
 * properties defined on :root in index.css (always present) and shows both
 * languages since it can't know which one the visitor picked.
 */
export function AppErrorFallback() {
  return (
    <div
      dir="ltr"
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1rem",
        padding: "2rem",
        textAlign: "center",
        background: "rgb(var(--c-bg))",
        color: "rgb(var(--c-ink))",
        fontFamily: "var(--font-sans, system-ui, sans-serif)",
      }}
    >
      <div style={{ fontSize: "1.75rem", color: "rgb(var(--c-brand))" }}>✦</div>
      <div style={{ maxWidth: "28rem" }}>
        <p style={{ margin: "0 0 .25rem", fontSize: "1.05rem" }}>
          Une erreur est survenue. Veuillez recharger la page.
        </p>
        <p dir="rtl" style={{ margin: 0, color: "rgb(var(--c-muted))" }}>
          حدث خطأ. يرجى إعادة تحميل الصفحة.
        </p>
      </div>
      <div style={{ display: "flex", gap: ".75rem", flexWrap: "wrap", justifyContent: "center" }}>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            border: "1px solid rgb(var(--c-brand))",
            background: "rgb(var(--c-brand))",
            color: "rgb(var(--c-brand-ink))",
            borderRadius: "9999px",
            padding: ".6rem 1.4rem",
            fontSize: ".9rem",
            cursor: "pointer",
          }}
        >
          Recharger / إعادة التحميل
        </button>
        <a
          href="/"
          style={{
            border: "1px solid rgb(var(--c-line))",
            color: "rgb(var(--c-ink))",
            borderRadius: "9999px",
            padding: ".6rem 1.4rem",
            fontSize: ".9rem",
            textDecoration: "none",
          }}
        >
          Accueil / الرئيسية
        </a>
      </div>
    </div>
  );
}
