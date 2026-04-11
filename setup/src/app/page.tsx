"use client";

import { useState, useCallback, useRef } from "react";
import {
  Globe, Shield, Cpu, Rocket,
  ChevronRight, ChevronLeft, Check, Loader2, ExternalLink,
  Eye, EyeOff, CircleCheck, CircleAlert,
  Briefcase,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Language = "en" | "uk" | "es";
type AuthMode = "google" | "demo";
type AIProvider = "ollama" | "gemini" | "groq";

interface Config {
  language: Language;
  auth: AuthMode;
  googleClientId: string;
  googleClientSecret: string;
  aiProvider: AIProvider;
  aiApiKey: string;
  ollamaUrl: string;
}

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const STEPS = [
  { label: "Language", icon: <Globe size={16} /> },
  { label: "Auth", icon: <Shield size={16} /> },
  { label: "AI", icon: <Cpu size={16} /> },
  { label: "Deploy", icon: <Rocket size={16} /> },
];

const LANGUAGES: { value: Language; label: string; flag: string }[] = [
  { value: "en", label: "English", flag: "EN" },
  { value: "uk", label: "Українська", flag: "UA" },
  { value: "es", label: "Español", flag: "ES" },
];

const AI_PROVIDERS: { value: AIProvider; label: string; desc: string; needsKey: boolean }[] = [
  { value: "ollama", label: "Ollama (Local)", desc: "Free, private, runs on your machine. Requires Ollama installed.", needsKey: false },
  { value: "gemini", label: "Google Gemini", desc: "Cloud AI by Google. Requires API key from ai.google.dev", needsKey: true },
  { value: "groq", label: "Groq", desc: "Fast cloud inference. Requires API key from groq.com", needsKey: true },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function cn(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function Stepper({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3 mb-8">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className="flex items-center">
          <div
            className={cn(
              "w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300",
              i < step && "bg-accent text-white",
              i === step && "bg-accent text-white ring-2 ring-accent/40 ring-offset-2 ring-offset-bg",
              i > step && "bg-bg-card text-text-muted border border-border"
            )}
          >
            {i < step ? <Check size={16} /> : i + 1}
          </div>
          {i < total - 1 && (
            <div className={cn(
              "hidden sm:block w-10 md:w-16 h-0.5 mx-1.5 transition-colors duration-300",
              i < step ? "bg-accent" : "bg-border"
            )} />
          )}
        </div>
      ))}
    </div>
  );
}

function Card({ children, title, subtitle }: { children: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="bg-bg-card rounded-xl border border-border p-6 sm:p-8 w-full max-w-2xl mx-auto">
      <h2 className="text-xl sm:text-2xl font-bold mb-1">{title}</h2>
      {subtitle && <p className="text-text-muted text-sm mb-6">{subtitle}</p>}
      {!subtitle && <div className="mb-6" />}
      {children}
    </div>
  );
}

function PasswordInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 pr-10 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
      />
      <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text">
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

function DeployLogViewer({ log, defaultOpen }: { log: string[]; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-4">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-text-muted hover:text-text flex items-center gap-1 mb-2"
      >
        <ChevronRight size={12} className={cn("transition-transform", open && "rotate-90")} />
        {open ? "Hide" : "Show"} deploy log ({log.length} lines)
      </button>
      {open && (
        <div className="bg-bg-input rounded-lg p-4 max-h-48 overflow-y-auto font-mono text-xs text-text-muted space-y-1">
          {log.map((line, i) => (
            <div key={i} className={cn(
              line.startsWith("ERROR") && "text-error",
              line.startsWith("WARNING") && "text-yellow-400",
              line.startsWith("[done]") && "text-success font-semibold",
              /^\[\d+\/\d+\]/.test(line) && "text-text",
            )}>{line}</div>
          ))}
        </div>
      )}
    </div>
  );
}


function getSetupToken(): string | null {
  if (typeof window === "undefined") return null;
  let tok = window.localStorage.getItem("jf-setup-token");
  if (!tok) {
    tok = window.prompt(
      "Enter SETUP_TOKEN (see container logs: `docker logs jf-setup` or SETUP_TOKEN env var):",
    );
    if (tok) window.localStorage.setItem("jf-setup-token", tok.trim());
  }
  return tok ? tok.trim() : null;
}

function setupFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = getSetupToken();
  const headers = new Headers(init.headers || {});
  if (token) headers.set("x-setup-token", token);
  return fetch(input, { ...init, headers });
}

function ContainerStatusPanel() {
  const [containers, setContainers] = useState<{ name: string; status: string; health: string }[]>([]);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useState(() => {
    const fetchStatus = async () => {
      try {
        const res = await setupFetch("/api/status");
        if (res.status === 401) { window.localStorage.removeItem("jf-setup-token"); return; }
        const data = await res.json();
        setContainers(data.containers || []);
      } catch {
        // ignore
      }
    };
    fetchStatus();
    pollingRef.current = setInterval(fetchStatus, 5000);
  });

  if (containers.length === 0) return null;

  return (
    <div className="mt-4">
      <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Container Status</h3>
      <div className="space-y-2">
        {containers.map((c) => (
          <div key={c.name} className="flex items-center gap-2 text-sm">
            {c.health === "healthy" || c.health === "running" ? (
              <CircleCheck size={16} className="text-success flex-shrink-0" />
            ) : c.health === "starting" ? (
              <Loader2 size={16} className="text-accent animate-spin flex-shrink-0" />
            ) : (
              <CircleAlert size={16} className="text-error flex-shrink-0" />
            )}
            <code className="text-accent text-xs">{c.name}</code>
            <span className="text-text-muted text-xs">{c.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Wizard                                                        */
/* ------------------------------------------------------------------ */

export default function SetupWizard() {
  const [step, setStep] = useState(0);
  const [deploying, setDeploying] = useState(false);
  const [deployLog, setDeployLog] = useState<string[]>([]);
  const [deployDone, setDeployDone] = useState(false);

  const [config, setConfig] = useState<Config>({
    language: "en",
    auth: "demo",
    googleClientId: "",
    googleClientSecret: "",
    aiProvider: "ollama",
    aiApiKey: "",
    ollamaUrl: "http://ollama:11434",
  });

  const handleDeploy = useCallback(async () => {
    setDeploying(true);
    setDeployLog([]);
    try {
      const token = getSetupToken();
      if (!token) {
        setDeployLog((prev) => [...prev, "ERROR: SETUP_TOKEN required"]);
        setDeploying(false);
        return;
      }
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-setup-token": token,
        },
        body: JSON.stringify(config),
      });
      if (res.status === 401) {
        window.localStorage.removeItem("jf-setup-token");
        setDeployLog((prev) => [...prev, "ERROR: Invalid SETUP_TOKEN — reload page and try again"]);
        setDeploying(false);
        return;
      }
      if (!res.body) throw new Error("No response body");
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        done = d;
        if (value) {
          const text = decoder.decode(value);
          const lines = text.split("\n").filter(Boolean);
          setDeployLog((prev) => [...prev, ...lines]);
        }
      }
      setDeployDone(true);
    } catch (err) {
      setDeployLog((prev) => [...prev, `ERROR: ${err instanceof Error ? err.message : "Deploy failed"}`]);
    } finally {
      setDeploying(false);
    }
  }, [config]);

  const canNext = () => {
    if (step === 1 && config.auth === "google") {
      return config.googleClientId.length > 0 && config.googleClientSecret.length > 0;
    }
    if (step === 2 && config.aiProvider !== "ollama") {
      return config.aiApiKey.length > 0;
    }
    return true;
  };

  /* ---- Step 1: Language ---- */
  const renderLanguage = () => (
    <Card title="Choose Language" subtitle="Select the interface language for JobFinder">
      <div className="space-y-3">
        {LANGUAGES.map((lang) => (
          <label
            key={lang.value}
            onClick={() => setConfig((p) => ({ ...p, language: lang.value }))}
            className={cn(
              "flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all",
              config.language === lang.value
                ? "border-accent bg-accent/10"
                : "border-border hover:border-text-muted"
            )}
          >
            <div className={cn(
              "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors",
              config.language === lang.value ? "border-accent" : "border-border"
            )}>
              {config.language === lang.value && <div className="w-2.5 h-2.5 rounded-full bg-accent" />}
            </div>
            <span className="text-lg font-medium">{lang.flag}</span>
            <span className="font-medium">{lang.label}</span>
          </label>
        ))}
      </div>
    </Card>
  );

  /* ---- Step 2: Auth ---- */
  const renderAuth = () => {
    const authOptions: { value: AuthMode; label: string; badge?: string; desc: string; helpUrl?: string }[] = [
      { value: "google", label: "Google OAuth", badge: "Recommended", desc: "Login with your Google account. Requires Client ID and Secret from console.cloud.google.com", helpUrl: "https://console.cloud.google.com/apis/credentials" },
      { value: "demo", label: "Demo Mode", desc: "No authentication required. Best for testing and local use." },
    ];

    return (
      <Card title="Authentication" subtitle="How will you log in to JobFinder?">
        <div className="space-y-3">
          {authOptions.map((opt) => (
            <div key={opt.value}>
              <label
                className={cn(
                  "flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-all",
                  config.auth === opt.value ? "border-accent bg-accent/10" : "border-border hover:border-text-muted"
                )}
                onClick={() => setConfig((p) => ({ ...p, auth: opt.value }))}
              >
                <div className={cn(
                  "w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 transition-colors",
                  config.auth === opt.value ? "border-accent" : "border-border"
                )}>
                  {config.auth === opt.value && <div className="w-2.5 h-2.5 rounded-full bg-accent" />}
                </div>
                <div className="flex-1">
                  <span className="font-medium text-sm">{opt.label}</span>
                  {opt.badge && <span className="ml-2 text-xs text-accent">{opt.badge}</span>}
                  <p className="text-text-muted text-xs mt-1">{opt.desc}</p>
                </div>
              </label>

              {config.auth === "google" && opt.value === "google" && (
                <div className="ml-8 space-y-3 py-3">
                  <div>
                    <label className="text-xs text-text-muted mb-1 block">Google Client ID</label>
                    <input
                      type="text"
                      value={config.googleClientId}
                      onChange={(e) => setConfig((p) => ({ ...p, googleClientId: e.target.value }))}
                      placeholder="123456789.apps.googleusercontent.com"
                      className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-text-muted mb-1 block">Google Client Secret</label>
                    <PasswordInput
                      value={config.googleClientSecret}
                      onChange={(v) => setConfig((p) => ({ ...p, googleClientSecret: v }))}
                      placeholder="GOCSPX-..."
                    />
                  </div>
                  <div className="bg-bg-input rounded-lg p-3 text-xs text-text-muted space-y-1">
                    <p className="font-medium text-text">Callback URL for your OAuth App:</p>
                    <code className="text-accent bg-bg border border-border rounded px-2 py-1 block">http://localhost:3456/api/auth/callback/google</code>
                  </div>
                  <a href={opt.helpUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
                    Get credentials <ExternalLink size={12} />
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>
    );
  };

  /* ---- Step 3: AI Provider ---- */
  const renderAI = () => (
    <Card title="AI Provider" subtitle="Choose the AI backend for resume analysis and job matching">
      <div className="space-y-3">
        {AI_PROVIDERS.map((provider) => (
          <div key={provider.value}>
            <label
              className={cn(
                "flex items-start gap-3 p-4 rounded-lg border cursor-pointer transition-all",
                config.aiProvider === provider.value ? "border-accent bg-accent/10" : "border-border hover:border-text-muted"
              )}
              onClick={() => setConfig((p) => ({ ...p, aiProvider: provider.value, aiApiKey: "" }))}
            >
              <div className={cn(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 transition-colors",
                config.aiProvider === provider.value ? "border-accent" : "border-border"
              )}>
                {config.aiProvider === provider.value && <div className="w-2.5 h-2.5 rounded-full bg-accent" />}
              </div>
              <div className="flex-1">
                <span className="font-medium text-sm">{provider.label}</span>
                {provider.value === "ollama" && <span className="ml-2 text-xs text-success">Free</span>}
                <p className="text-text-muted text-xs mt-1">{provider.desc}</p>
              </div>
            </label>

            {config.aiProvider === provider.value && provider.value === "ollama" && (
              <div className="ml-8 space-y-3 py-3">
                <div>
                  <label className="text-xs text-text-muted mb-1 block">Ollama URL</label>
                  <input
                    type="text"
                    value={config.ollamaUrl}
                    onChange={(e) => setConfig((p) => ({ ...p, ollamaUrl: e.target.value }))}
                    placeholder="http://ollama:11434"
                    className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-text placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
                  />
                </div>
                <p className="text-text-muted text-xs italic">Default works with Docker Compose. Change if Ollama runs elsewhere.</p>
              </div>
            )}

            {config.aiProvider === provider.value && provider.needsKey && (
              <div className="ml-8 space-y-3 py-3">
                <div>
                  <label className="text-xs text-text-muted mb-1 block">{provider.label} API Key</label>
                  <PasswordInput
                    value={config.aiApiKey}
                    onChange={(v) => setConfig((p) => ({ ...p, aiApiKey: v }))}
                    placeholder={`Enter your ${provider.label} API key`}
                  />
                </div>
                <a
                  href={provider.value === "gemini" ? "https://ai.google.dev" : "https://console.groq.com/keys"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-accent hover:underline"
                >
                  Get API key <ExternalLink size={12} />
                </a>
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  );

  /* ---- Step 4: Deploy ---- */
  const renderDeploy = () => {
    const containers = [
      { name: "jf-app", desc: "Next.js Application" },
      { name: "pg", desc: "PostgreSQL Database" },
      ...(config.aiProvider === "ollama" ? [{ name: "ollama", desc: "Local AI (Ollama)" }] : []),
    ];

    const hasErrors = deployLog.some((l) => l.startsWith("ERROR"));
    const autoDeployed = deployLog.some((l) => l.includes("Starting containers") || l.includes("Deployment complete"));
    const manualMode = deployLog.some((l) => l.includes("Docker socket not available"));

    if (deployDone) {
      return (
        <Card title={hasErrors ? "Deployment Issues" : "Setup Complete!"} subtitle={hasErrors ? "There were some issues during deployment." : "JobFinder is deployed and running."}>
          <DeployLogViewer log={deployLog} defaultOpen={hasErrors} />

          {autoDeployed && !hasErrors && <ContainerStatusPanel />}

          <div className="text-center space-y-4 mt-6">
            {manualMode ? (
              <div className="space-y-3">
                <p className="text-sm text-text-muted">
                  Configuration files saved to <code className="text-accent bg-bg-input px-1.5 py-0.5 rounded text-xs">/data/</code>
                </p>
                <div className="bg-bg-input rounded-lg p-4 text-left">
                  <p className="text-xs text-text-muted mb-2">To deploy, run these commands:</p>
                  <div className="space-y-1 font-mono text-xs">
                    <p className="text-accent">cd /data</p>
                    <p className="text-accent">docker compose up -d</p>
                    <p className="text-accent">docker exec jf-app npx prisma migrate deploy</p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-text-muted">
                JobFinder is running. It may take a few seconds to fully start.
              </p>
            )}

            <a
              href="http://localhost:3456"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-accent hover:bg-accent-hover text-white font-semibold px-6 py-3 rounded-lg transition-colors"
            >
              Open JobFinder <ExternalLink size={16} />
            </a>

            <p className="text-xs text-text-muted">
              URL: <code className="text-accent">http://localhost:3456</code>
            </p>
          </div>
        </Card>
      );
    }

    if (deploying) {
      const stepLines = deployLog.filter((l) => l.match(/^\[\d+\/\d+\]/));
      const lastStep = stepLines.length > 0 ? stepLines[stepLines.length - 1] : "";
      const match = lastStep.match(/^\[(\d+)\/(\d+)\]/);
      const progressPct = match ? Math.min(95, (parseInt(match[1]) / parseInt(match[2])) * 100) : Math.min(95, deployLog.length * 10);

      return (
        <Card title="Deploying..." subtitle="Setting up JobFinder">
          <div className="space-y-4">
            <div className="w-full bg-bg-input rounded-full h-2 overflow-hidden">
              <div className="h-full bg-accent rounded-full transition-all duration-700 ease-out" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="bg-bg-input rounded-lg p-4 max-h-72 overflow-y-auto font-mono text-xs text-text-muted space-y-1" ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }}>
              {deployLog.map((line, i) => (
                <div key={i} className={cn(
                  line.startsWith("ERROR") && "text-error",
                  line.startsWith("WARNING") && "text-yellow-400",
                  /^\[\d+\/\d+\]/.test(line) && "text-text font-semibold",
                )}>
                  {line}
                </div>
              ))}
              <div className="flex items-center gap-2 text-accent">
                <Loader2 size={12} className="animate-spin" /> Working...
              </div>
            </div>
          </div>
        </Card>
      );
    }

    return (
      <Card title="Review & Deploy" subtitle="Review your configuration before deploying.">
        <div className="space-y-5">
          {/* Language */}
          <div>
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Language</h3>
            <p className="text-sm">{LANGUAGES.find((l) => l.value === config.language)?.label}</p>
          </div>

          {/* Auth */}
          <div>
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Authentication</h3>
            <p className="text-sm">{config.auth === "google" ? "Google OAuth" : "Demo Mode (no auth)"}</p>
          </div>

          {/* AI */}
          <div>
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">AI Provider</h3>
            <p className="text-sm">{AI_PROVIDERS.find((p) => p.value === config.aiProvider)?.label}</p>
          </div>

          {/* Containers */}
          <div>
            <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Docker Containers</h3>
            <div className="space-y-1">
              {containers.map((c) => (
                <div key={c.name} className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-success" />
                  <code className="text-accent text-xs">{c.name}</code>
                  <span className="text-text-muted text-xs">-- {c.desc}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-bg-input rounded-lg p-3 text-xs text-text-muted">
            <p>Clicking <strong className="text-text">Deploy Now</strong> will:</p>
            <ol className="list-decimal ml-4 mt-2 space-y-1">
              <li>Generate .env and docker-compose.yml</li>
              <li>Start all containers via Docker</li>
              <li>Run database migrations</li>
            </ol>
          </div>

          <button
            onClick={handleDeploy}
            className="w-full bg-accent hover:bg-accent-hover text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2 text-sm"
          >
            <Rocket size={18} /> Deploy Now
          </button>
        </div>
      </Card>
    );
  };

  const stepRenderers = [renderLanguage, renderAuth, renderAI, renderDeploy];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-4 sm:px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-accent rounded-lg flex items-center justify-center font-bold text-white text-sm">
              <Briefcase size={18} />
            </div>
            <span className="font-semibold text-sm hidden sm:block">JobFinder Setup</span>
          </div>
          <span className="text-xs text-text-muted">Step {step + 1} of {STEPS.length}</span>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 sm:px-6 py-8">
        <div className="max-w-3xl mx-auto">
          <Stepper step={step} total={STEPS.length} />
          {stepRenderers[step]()}
        </div>
      </main>

      {/* Footer Navigation */}
      {!deploying && !deployDone && (
        <footer className="border-t border-border px-4 sm:px-6 py-4">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <button
              onClick={() => setStep((s) => s - 1)}
              disabled={step === 0}
              className={cn(
                "flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                step === 0 ? "text-text-muted cursor-not-allowed" : "text-text hover:bg-bg-card"
              )}
            >
              <ChevronLeft size={16} /> Back
            </button>

            {step < STEPS.length - 1 && (
              <button
                onClick={() => setStep((s) => s + 1)}
                disabled={!canNext()}
                className={cn(
                  "flex items-center gap-1 px-5 py-2 rounded-lg text-sm font-semibold transition-colors",
                  canNext()
                    ? "bg-accent hover:bg-accent-hover text-white"
                    : "bg-border text-text-muted cursor-not-allowed"
                )}
              >
                Next <ChevronRight size={16} />
              </button>
            )}
          </div>
        </footer>
      )}
    </div>
  );
}
