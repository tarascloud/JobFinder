"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { enterDemoMode } from "@/actions/demo";
import { ArrowLeft, Eye } from "lucide-react";
import { LanguageToggle } from "@/components/shared/language-toggle";

export function LoginForm({ githubEnabled }: { githubEnabled: boolean }) {
  const t = useTranslations("login");
  const [isInApp, setIsInApp] = useState(false);
  useEffect(() => {
    const ua = navigator.userAgent || "";
    setIsInApp(/FBAN|FBAV|Instagram|Telegram|TelegramBot|Twitter|Line\/|Snapchat|WhatsApp|Viber|Pinterest|LinkedIn/i.test(ua));
  }, []);

  async function handleGoogleSignIn() {
    const { signIn } = await import("next-auth/react");
    signIn("google", { callbackUrl: "/profile" });
  }

  async function handleGitHubSignIn() {
    const { signIn } = await import("next-auth/react");
    signIn("github", { callbackUrl: "/profile" });
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center space-y-6">
          <div>
            <h1 className="text-3xl font-bold text-primary">{t("title")}</h1>
            <p className="mt-2 text-muted-foreground">{t("subtitle")}</p>
          </div>

          <div className="flex justify-center">
            <LanguageToggle />
          </div>

          <div className="space-y-3">
            {isInApp && (
              <div className="p-3 border border-amber-500/30 bg-amber-500/10 rounded-md text-sm space-y-2">
                <p className="font-medium">Google sign-in is not supported in this browser.</p>
                <p className="text-muted-foreground text-xs">Please open this page in Safari or Chrome.</p>
                <div className="flex gap-2">
                  <a
                    href={`https://www.google.com/url?q=${encodeURIComponent(typeof window !== "undefined" ? window.location.href : "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs underline"
                  >
                    Open in Browser
                  </a>
                  <button onClick={() => navigator.clipboard?.writeText(window.location.href)} className="text-xs underline text-muted-foreground">
                    Copy link
                  </button>
                </div>
              </div>
            )}
            <Button
              size="lg"
              className="w-full"
              onClick={handleGoogleSignIn}
            >
              <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              {t("sign_in_google")}
            </Button>

            {githubEnabled && (
              <Button
                size="lg"
                variant="outline"
                className="w-full"
                onClick={handleGitHubSignIn}
              >
                <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                {t("sign_in_github")}
              </Button>
            )}

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or</span>
              </div>
            </div>

            <form action={enterDemoMode}>
              <Button
                type="submit"
                variant="outline"
                size="lg"
                className="w-full"
              >
                <Eye className="h-5 w-5 mr-2" />
                {t("try_demo")}
              </Button>
            </form>
            <p className="text-xs text-muted-foreground">
              {t("try_demo_help")}
            </p>
          </div>

          <p className="text-xs text-muted-foreground/60">
            Free for the first 10 users. Open registration.
          </p>

          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("back_to_home")}
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
