"use client";

import type { CSSProperties, FormEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { ensureErrejotaTenant, getErrejotaSnapshot, type ErrejotaSnapshot } from "@/lib/errejota-data";
import { supabase } from "@/lib/supabase";

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [initializing, setInitializing] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<ErrejotaSnapshot | null>(null);
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("supernegocioolinee@gmail.com");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setChecking(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) setSession(nextSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user?.id) {
      setTenantId(null);
      setSnapshot(null);
      return;
    }

    let cancelled = false;
    setInitializing(true);
    setError("");

    void (async () => {
      try {
        const id = await ensureErrejotaTenant("Errejota");
        if (cancelled) return;
        setTenantId(id);

        const current = await getErrejotaSnapshot(id);
        if (!cancelled) setSnapshot(current);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Falha ao inicializar o workspace Errejota.");
        }
      } finally {
        if (!cancelled) setInitializing(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    setError("");

    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;

        if (!data.session) {
          setMessage("Cadastro criado. Confira o e-mail para confirmar o acesso e depois entre no sistema.");
        } else {
          setMessage("Cadastro criado. Inicializando o workspace Errejota...");
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível autenticar.");
    } finally {
      setSubmitting(false);
    }
  }

  if (checking) {
    return <FullScreenMessage title="Conectando ao Supabase" text="Validando sua sessão com segurança..." />;
  }

  if (!session) {
    return (
      <main style={styles.authPage}>
        <section style={styles.authCard}>
          <div style={styles.logo}>RJ</div>
          <p style={styles.eyebrow}>ERREJOTA • CENTRAL DE EVENTOS</p>
          <h1 style={styles.title}>{mode === "signup" ? "Criar acesso administrador" : "Entrar no sistema"}</h1>
          <p style={styles.subtitle}>
            Acesso protegido pelo Supabase Auth. No primeiro login, o sistema cria automaticamente o workspace Errejota e vincula o usuário como proprietário.
          </p>

          <form onSubmit={submit} style={styles.form}>
            <label style={styles.label}>
              E-mail
              <input
                style={styles.input}
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </label>
            <label style={styles.label}>
              Senha
              <input
                style={styles.input}
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={6}
                required
              />
            </label>

            {error && <div style={styles.error}>{error}</div>}
            {message && <div style={styles.success}>{message}</div>}

            <button style={styles.primaryButton} type="submit" disabled={submitting}>
              {submitting ? "Processando..." : mode === "signup" ? "Criar meu acesso" : "Entrar"}
            </button>
          </form>

          <button
            style={styles.linkButton}
            type="button"
            onClick={() => {
              setMode(mode === "signup" ? "login" : "signup");
              setError("");
              setMessage("");
            }}
          >
            {mode === "signup" ? "Já tenho cadastro → Entrar" : "Primeiro acesso → Criar cadastro"}
          </button>
        </section>
      </main>
    );
  }

  if (initializing || !tenantId) {
    return <FullScreenMessage title="Preparando o Errejota" text={error || "Criando e validando seu workspace isolado..."} />;
  }

  return (
    <>
      {children}
      <div style={styles.connectionBadge}>
        <span style={styles.onlineDot} />
        <div>
          <strong style={styles.connectionTitle}>Supabase conectado</strong>
          <span style={styles.connectionText}>
            {snapshot ? `${snapshot.contacts} contatos • ${snapshot.openConversations} conversas abertas` : "Workspace Errejota ativo"}
          </span>
        </div>
        <button style={styles.logoutButton} onClick={() => void supabase.auth.signOut()} type="button">
          Sair
        </button>
      </div>
    </>
  );
}

function FullScreenMessage({ title, text }: { title: string; text: string }) {
  return (
    <main style={styles.authPage}>
      <section style={styles.loadingCard}>
        <div style={styles.logo}>RJ</div>
        <h1 style={styles.title}>{title}</h1>
        <p style={styles.subtitle}>{text}</p>
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  authPage: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 24,
    background: "radial-gradient(circle at top right, #351319 0, transparent 34%), #0b0b0d",
    color: "#f5f5f5",
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
  },
  authCard: {
    width: "min(460px, 100%)",
    padding: 32,
    border: "1px solid #2c2c31",
    borderRadius: 20,
    background: "rgba(18,18,21,.98)",
    boxShadow: "0 30px 80px rgba(0,0,0,.35)",
  },
  loadingCard: {
    width: "min(430px, 100%)",
    padding: 32,
    border: "1px solid #2c2c31",
    borderRadius: 20,
    background: "#121215",
    textAlign: "center",
  },
  logo: {
    width: 48,
    height: 48,
    display: "grid",
    placeItems: "center",
    borderRadius: 14,
    background: "#f14b55",
    color: "white",
    fontWeight: 900,
    marginBottom: 22,
  },
  eyebrow: {
    margin: "0 0 8px",
    color: "#8e8e96",
    fontSize: 11,
    fontWeight: 800,
    letterSpacing: ".14em",
  },
  title: { margin: "0 0 10px", fontSize: 28, letterSpacing: "-.04em" },
  subtitle: { margin: "0 0 24px", color: "#a0a0a7", lineHeight: 1.55, fontSize: 14 },
  form: { display: "grid", gap: 15 },
  label: { display: "grid", gap: 7, color: "#cfcfd4", fontSize: 12, fontWeight: 700 },
  input: {
    width: "100%",
    border: "1px solid #34343a",
    borderRadius: 10,
    background: "#0d0d10",
    color: "white",
    padding: "12px 13px",
    outline: "none",
  },
  primaryButton: {
    marginTop: 5,
    border: 0,
    borderRadius: 10,
    padding: "12px 15px",
    background: "#f14b55",
    color: "white",
    fontWeight: 800,
    cursor: "pointer",
  },
  linkButton: {
    width: "100%",
    marginTop: 18,
    border: 0,
    background: "transparent",
    color: "#a6a6ad",
    cursor: "pointer",
    fontWeight: 700,
  },
  error: { borderRadius: 9, padding: 11, background: "#32191d", color: "#ff9da3", fontSize: 12 },
  success: { borderRadius: 9, padding: 11, background: "#123024", color: "#95ddb8", fontSize: 12 },
  connectionBadge: {
    position: "fixed",
    zIndex: 50,
    left: 18,
    bottom: 18,
    display: "flex",
    alignItems: "center",
    gap: 9,
    padding: "9px 10px",
    border: "1px solid #303036",
    borderRadius: 12,
    background: "rgba(15,15,18,.94)",
    boxShadow: "0 10px 35px rgba(0,0,0,.25)",
  },
  onlineDot: { width: 8, height: 8, borderRadius: 99, background: "#36bd7e" },
  connectionTitle: { display: "block", fontSize: 11, color: "#e8e8eb" },
  connectionText: { display: "block", marginTop: 2, fontSize: 9, color: "#85858d" },
  logoutButton: {
    border: "1px solid #34343a",
    borderRadius: 8,
    background: "#19191d",
    color: "#bdbdc3",
    padding: "6px 8px",
    fontSize: 10,
    cursor: "pointer",
  },
};
