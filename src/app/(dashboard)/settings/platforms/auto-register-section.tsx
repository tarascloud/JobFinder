"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  autoRegisterPlatform,
  markPlatformVerified,
  getPlatformRegistrationStatus,
  getMyJfEmail,
} from "@/actions/auto-register";
import type { RegistrationResult } from "@/actions/auto-register";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Loader2,
  Bot,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Mail,
  Phone,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from "lucide-react";

type PlatformRegStatus = Awaited<ReturnType<typeof getPlatformRegistrationStatus>>[number];

function statusBadge(status: string | undefined, t: (k: string) => string) {
  if (!status) return null;
  switch (status) {
    case "active":
      return (
        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          {t("status_registered")}
        </Badge>
      );
    case "needs_verification":
      return (
        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
          <Mail className="h-3 w-3 mr-1" />
          {t("status_needs_verification")}
        </Badge>
      );
    case "needs_attention":
      return (
        <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
          <AlertTriangle className="h-3 w-3 mr-1" />
          {t("status_needs_attention")}
        </Badge>
      );
    case "pending":
      return (
        <Badge className="bg-muted text-muted-foreground border-border">
          <Clock className="h-3 w-3 mr-1" />
          {t("status_pending")}
        </Badge>
      );
    case "failed":
      return (
        <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
          <XCircle className="h-3 w-3 mr-1" />
          {t("status_failed")}
        </Badge>
      );
    default:
      return <Badge className="bg-muted text-muted-foreground">{status}</Badge>;
  }
}

export function AutoRegisterSection() {
  const t = useTranslations("platforms_auto");
  const tCommon = useTranslations("common");

  const [platforms, setPlatforms] = useState<PlatformRegStatus[]>([]);
  const [jfEmail, setJfEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState<string | null>(null);
  const [resultDialog, setResultDialog] = useState<{
    platform: string;
    result: RegistrationResult;
  } | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [verifying, setVerifying] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [data, email] = await Promise.all([
      getPlatformRegistrationStatus(),
      getMyJfEmail(),
    ]);
    setPlatforms(data);
    setJfEmail(email);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleRegister(platform: string) {
    setRegistering(platform);
    const res = await autoRegisterPlatform(platform);
    setRegistering(null);
    if (res.ok && res.result) {
      setResultDialog({ platform, result: res.result });
    } else {
      setResultDialog({
        platform,
        result: {
          status: "failed",
          message: res.error ?? "Unknown error",
          log: [],
        },
      });
    }
    await load();
  }

  async function handleVerify(accountId: number) {
    setVerifying(accountId);
    await markPlatformVerified(accountId);
    await load();
    setVerifying(null);
  }

  function toggleLog(platform: string) {
    setExpandedLogs((prev) => {
      const next = new Set(prev);
      if (next.has(platform)) {
        next.delete(platform);
      } else {
        next.add(platform);
      }
      return next;
    });
  }

  // Only show platforms that support auto-register OR have an existing account
  const relevantPlatforms = platforms.filter(
    (p) => p.supportsAutoRegister || p.account
  );

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            {t("title")}
          </CardTitle>
          <Button
            size="sm"
            variant="ghost"
            onClick={load}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* JF email info */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-sm">
            <Mail className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-blue-400 font-medium">{t("jf_email_label")}</p>
              <p className="text-muted-foreground">
                {jfEmail
                  ? t("jf_email_desc", { email: jfEmail })
                  : t("jf_email_missing")}
              </p>
            </div>
          </div>

          {relevantPlatforms.length === 0 && !loading && (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t("no_platforms")}
            </p>
          )}

          {relevantPlatforms.map((p) => (
            <div
              key={p.platform}
              className="flex flex-col gap-2 p-3 rounded-lg border border-border"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{p.label}</p>

                  {/* Status info */}
                  {p.account ? (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {p.account.email}
                      {p.account.registeredAt && (
                        <span className="ml-2 opacity-60">
                          {new Date(p.account.registeredAt).toLocaleDateString()}
                        </span>
                      )}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground/60 mt-0.5">
                      {p.requiresCaptcha && (
                        <span className="mr-2">⚠ {t("captcha_warning")}</span>
                      )}
                      {p.requiresEmailVerification && (
                        <span className="mr-2">✉ {t("email_verification_required")}</span>
                      )}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {p.account && statusBadge(p.account.status, t)}

                  {/* Action buttons */}
                  {!p.account ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRegister(p.platform)}
                      disabled={registering === p.platform || !jfEmail}
                    >
                      {registering === p.platform ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                          {t("registering")}
                        </>
                      ) : (
                        <>
                          <Bot className="h-3.5 w-3.5 mr-1" />
                          {t("auto_register")}
                        </>
                      )}
                    </Button>
                  ) : p.account.status === "needs_verification" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleVerify(p.account!.id)}
                      disabled={verifying === p.account.id}
                    >
                      {verifying === p.account.id ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                      )}
                      {t("mark_verified")}
                    </Button>
                  ) : p.account.status === "needs_attention" || p.account.status === "failed" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRegister(p.platform)}
                      disabled={registering === p.platform}
                    >
                      <RefreshCw className="h-3.5 w-3.5 mr-1" />
                      {t("retry")}
                    </Button>
                  ) : null}
                </div>
              </div>

              {/* Registration log toggle */}
              {p.account?.registrationLog && p.account.registrationLog.length > 0 && (
                <div>
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => toggleLog(p.platform)}
                  >
                    {expandedLogs.has(p.platform) ? (
                      <ChevronUp className="h-3 w-3" />
                    ) : (
                      <ChevronDown className="h-3 w-3" />
                    )}
                    {t("show_log")}
                  </button>
                  {expandedLogs.has(p.platform) && (
                    <pre className="mt-1 text-xs text-muted-foreground bg-muted/50 rounded p-2 overflow-auto max-h-32 whitespace-pre-wrap">
                      {p.account.registrationLog.join("\n")}
                    </pre>
                  )}
                </div>
              )}

              {/* Phone required warning */}
              {p.requiresPhone && !p.account && (
                <div className="flex items-center gap-1.5 text-xs text-yellow-400/80 mt-1">
                  <Phone className="h-3 w-3 flex-shrink-0" />
                  {t("phone_required_note")}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Result dialog */}
      <Dialog
        open={resultDialog !== null}
        onOpenChange={() => setResultDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {resultDialog &&
                (resultDialog.result.status === "failed"
                  ? t("result_failed")
                  : resultDialog.result.status === "needs_verification"
                    ? t("result_needs_verification")
                    : resultDialog.result.status === "captcha_required"
                      ? t("result_captcha")
                      : t("result_success"))}
            </DialogTitle>
          </DialogHeader>

          {resultDialog && (
            <div className="space-y-3">
              <p className="text-sm">{resultDialog.result.message}</p>

              {resultDialog.result.requiresManual &&
                resultDialog.result.manualInstructions && (
                  <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-400">
                    <p className="font-medium mb-1">{t("manual_instructions_label")}</p>
                    <p>{resultDialog.result.manualInstructions}</p>
                  </div>
                )}

              {resultDialog.result.log.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    {t("show_log")}
                  </summary>
                  <pre className="mt-1 text-muted-foreground bg-muted/50 rounded p-2 overflow-auto max-h-40 whitespace-pre-wrap">
                    {resultDialog.result.log.join("\n")}
                  </pre>
                </details>
              )}
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setResultDialog(null)}>{tCommon("cancel")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
