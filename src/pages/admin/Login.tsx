import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n/LanguageProvider";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Wordmark } from "@/components/layout/Wordmark";

export default function Login() {
  const { isAuthenticated, loading, signIn } = useAuth();
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && isAuthenticated) return <Navigate to="/admin" replace />;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const { error } = await signIn(email, password);
    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("invalid login") || msg.includes("credentials")) {
        setError(t("adminLoginBadCredentials"));
      } else if (msg.includes("rate") || msg.includes("too many")) {
        setError(t("adminLoginRateLimited"));
      } else {
        setError(t("errorGeneric"));
      }
    }
    setSubmitting(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-panel p-8">
        <Wordmark className="mx-auto mb-8" />
        <h1 className="mb-6 text-center font-display text-2xl text-ink">{t("adminLogin")}</h1>
        <form onSubmit={onSubmit} className="space-y-4">
          <Input
            type="email"
            autoComplete="username"
            placeholder={t("adminEmail")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            type="password"
            autoComplete="current-password"
            placeholder={t("adminPassword")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button type="submit" className="w-full" size="lg" disabled={submitting}>
            {t("adminSignIn")}
          </Button>
        </form>
      </div>
    </div>
  );
}
