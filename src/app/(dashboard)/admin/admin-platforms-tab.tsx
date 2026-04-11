"use client";

import { useTranslations } from "next-intl";
import {
  Globe,
  Loader2,
  RefreshCw,
  Save,
  Shield,
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ALL_PLATFORMS, type PlatformStatus, type PlatformMeta } from "@/lib/platforms";

type PlatformCheckResult = PlatformStatus & {
  checking?: boolean;
  vacancyCount?: number;
};

interface AdminPlatformsTabProps {
  platformsLoading: boolean;
  platformsCheckingAll: boolean;
  serviceEmail: string;
  servicePassword: string;
  credentialsLoading: boolean;
  credentialsSaved: boolean;
  platformStatuses: Record<string, PlatformCheckResult>;
  platformMeta: Record<string, PlatformMeta>;
  enabledPlatforms: Record<string, boolean>;
  onServiceEmailChange: (v: string) => void;
  onServicePasswordChange: (v: string) => void;
  onSaveCredentials: () => void;
  onCheckPlatform: (platform: string) => void;
  onCheckAllPlatforms: () => void;
  onTogglePlatform: (platform: string, newVal: boolean) => void;
}

function PlatformStatusBadge({ status, t }: { status: string; t: (key: string) => string }) {
  switch (status) {
    case "connected":
      return <Badge variant="default" className="text-[10px] gap-1"><CheckCircle2 className="h-3 w-3" />{t("status_connected")}</Badge>;
    case "blocked":
      return <Badge variant="destructive" className="text-[10px] gap-1"><XCircle className="h-3 w-3" />{t("status_blocked")}</Badge>;
    case "unreachable":
      return <Badge variant="destructive" className="text-[10px] gap-1"><AlertTriangle className="h-3 w-3" />{t("status_unreachable")}</Badge>;
    case "checking":
      return <Badge variant="secondary" className="text-[10px] gap-1"><Loader2 className="h-3 w-3 animate-spin" />{t("status_checking")}</Badge>;
    case "error":
      return <Badge variant="outline" className="text-[10px] gap-1 text-red-400"><XCircle className="h-3 w-3" />{t("status_error")}</Badge>;
    default:
      return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
  }
}

function ReliabilityBadge({
  reliability,
  t,
}: {
  reliability: "reliable" | "moderate" | "unreliable" | "defunct";
  t: (key: string) => string;
}) {
  switch (reliability) {
    case "reliable":
      return <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-green-600">{t("reliability_reliable")}</Badge>;
    case "moderate":
      return <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{t("reliability_moderate")}</Badge>;
    case "unreliable":
      return <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-orange-400 border-orange-400/50">{t("reliability_unreliable")}</Badge>;
    case "defunct":
      return <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-red-400 border-red-400/50">{t("reliability_defunct")}</Badge>;
  }
}

export function AdminPlatformsTab({
  platformsLoading,
  platformsCheckingAll,
  serviceEmail,
  servicePassword,
  credentialsLoading,
  credentialsSaved,
  platformStatuses,
  platformMeta,
  enabledPlatforms,
  onServiceEmailChange,
  onServicePasswordChange,
  onSaveCredentials,
  onCheckPlatform,
  onCheckAllPlatforms,
  onTogglePlatform,
}: AdminPlatformsTabProps) {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");

  const sortedPlatforms = [...ALL_PLATFORMS].sort((a, b) => {
    const aEnabled = enabledPlatforms[a] ?? true;
    const bEnabled = enabledPlatforms[b] ?? true;
    if (aEnabled !== bEnabled) return aEnabled ? -1 : 1;
    const reliabilityOrder: Record<string, number> = { reliable: 0, moderate: 1, unreliable: 2, defunct: 3 };
    const aRel = reliabilityOrder[platformMeta[a]?.reliability ?? "moderate"] ?? 1;
    const bRel = reliabilityOrder[platformMeta[b]?.reliability ?? "moderate"] ?? 1;
    if (aRel !== bRel) return aRel - bRel;
    const statusOrder: Record<string, number> = { connected: 0, blocked: 1, checking: 2, "": 3, unreachable: 4, error: 5 };
    const aStatus = statusOrder[platformStatuses[a]?.status ?? ""] ?? 3;
    const bStatus = statusOrder[platformStatuses[b]?.status ?? ""] ?? 3;
    return aStatus - bStatus;
  });

  return (
    <div className="space-y-4">
      {/* Service credentials */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t("service_credentials_title")}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">{t("service_credentials_desc")}</p>
        </CardHeader>
        <CardContent>
          {platformsLoading ? (
            <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3 items-end">
              <div className="flex-1 min-w-0">
                <label className="text-sm text-muted-foreground block mb-1">{t("service_email_label")}</label>
                <input
                  type="email"
                  value={serviceEmail}
                  onChange={(e) => onServiceEmailChange(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  placeholder="jf@taras.cloud"
                />
              </div>
              <div className="flex-1 min-w-0">
                <label className="text-sm text-muted-foreground block mb-1">{t("service_password_label")}</label>
                <input
                  type="password"
                  value={servicePassword}
                  onChange={(e) => onServicePasswordChange(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  placeholder="••••••••"
                />
              </div>
              <Button onClick={onSaveCredentials} disabled={credentialsLoading || !serviceEmail} className="shrink-0">
                {credentialsLoading ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : credentialsSaved ? (
                  <CheckCircle2 className="h-4 w-4 mr-1.5 text-green-400" />
                ) : (
                  <Save className="h-4 w-4 mr-1.5" />
                )}
                {credentialsSaved ? t("credentials_saved") : tCommon("save")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Platforms grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {t("platform_registrations_title")}
            <Badge variant="secondary" className="ml-1">{ALL_PLATFORMS.length}</Badge>
            <Button size="sm" variant="outline" className="ml-auto" onClick={onCheckAllPlatforms} disabled={platformsCheckingAll}>
              {platformsCheckingAll ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              )}
              {t("check_all")}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sortedPlatforms.map((platform) => {
              const info = platformStatuses[platform];
              const meta = platformMeta[platform];
              const isChecking = info?.checking;
              const isEnabled = enabledPlatforms[platform] ?? true;

              return (
                <div key={platform} className="rounded-lg border border-border p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onTogglePlatform(platform, !isEnabled)}
                        className={`w-8 h-4 rounded-full transition-colors relative ${isEnabled ? "bg-primary" : "bg-muted"}`}
                      >
                        <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${isEnabled ? "left-4" : "left-0.5"}`} />
                      </button>
                      <span className={`text-sm font-medium capitalize ${isEnabled ? "" : "text-muted-foreground line-through"}`}>
                        {platform}
                      </span>
                    </div>
                    {info ? (
                      <PlatformStatusBadge status={info.status} t={t} />
                    ) : (
                      <Badge variant="outline" className="text-[10px]">{t("status_not_checked")}</Badge>
                    )}
                  </div>
                  {meta && (
                    <div className="flex flex-wrap gap-1">
                      <ReliabilityBadge reliability={meta.reliability} t={t} />
                      {meta.requiresAuth && (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">{t("auth_required")}</Badge>
                      )}
                    </div>
                  )}
                  {meta?.note && <p className="text-[11px] text-muted-foreground leading-tight">{meta.note}</p>}
                  {meta?.registrationUrl && (
                    <a
                      href={meta.registrationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {t("register")}
                      {serviceEmail && <span className="text-muted-foreground ml-1">({serviceEmail})</span>}
                    </a>
                  )}
                  {info?.status === "connected" && !isChecking && (
                    <p className="text-xs text-green-400 font-medium">{t("vacancies_found", { count: info.vacancyCount ?? 0 })}</p>
                  )}
                  {info?.message && info.status !== "connected" && !isChecking && (
                    <p className="text-xs text-muted-foreground truncate" title={info.message}>{info.message}</p>
                  )}
                  {info?.lastCheck && !isChecking && (
                    <p className="text-[10px] text-muted-foreground">{t("last_check")}: {new Date(info.lastCheck).toLocaleTimeString()}</p>
                  )}
                  <Button size="sm" variant="outline" className="w-full mt-auto" onClick={() => onCheckPlatform(platform)} disabled={isChecking}>
                    {isChecking ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                    {t("check_integration")}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
