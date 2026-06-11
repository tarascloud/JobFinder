"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  getPlatformAccounts,
  addPlatformAccount,
  updatePlatformAccount,
  deletePlatformAccount,
  testPlatformConnection,
  getServiceIntegrationPlatforms,
  getAvailablePlatformNames,
} from "@/actions/platform-accounts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectOption } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Trash2,
  Plug,
  Eye,
  EyeOff,
  Loader2,
  Link2,
  CheckCircle2,
  AlertTriangle,
  Info,
  Shield,
  Pencil,
  User,
} from "lucide-react";
import SettingsTabs from "../settings-tabs";
import { AutoRegisterSection } from "./auto-register-section";

const ALL_PLATFORM_LABELS: Record<string, string> = {
  linkedin: "LinkedIn",
  indeed: "Indeed",
  glassdoor: "Glassdoor",
  wellfound: "Wellfound",
  arcdev: "Arc.dev",
  djinni: "Djinni",
  dou: "DOU",
  workua: "Work.ua",
  robotaua: "Robota.ua",
  remoteok: "RemoteOK",
  weworkremotely: "WeWorkRemotely",
  dice: "Dice",
  simplyhired: "SimplyHired",
  himalayas: "Himalayas",
  infojobs: "InfoJobs",
  tecnoempleo: "Tecnoempleo",
  jobatus: "Jobatus",
  computrabajo: "Computrabajo",
  "hn-whohiring": "HN Who's Hiring",
  ziprecruiter: "ZipRecruiter",
  nodesk: "NoDesk",
  relocateme: "RelocateMe",
  "4dayweek": "4 Day Week",
  euroremotejobs: "EuroRemoteJobs",
  "career-pages": "Career Pages (111 companies)",
};

const AUTH_TYPES = [
  { value: "password", label: "Email + Password" },
  { value: "google_oauth", label: "Google OAuth" },
];

type PlatformAccount = {
  id: number;
  platform: string;
  authType: string;
  email: string | null;
  status: string;
  lastLogin: Date | null;
};

function statusColor(status: string) {
  switch (status) {
    case "active":
      return "bg-status-success/20 text-status-success border-status-success/30";
    case "needs_attention":
      return "bg-status-warning/20 text-status-warning border-status-warning/30";
    case "failed":
      return "bg-status-error/20 text-status-error border-status-error/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

export default function PlatformsPage() {
  const t = useTranslations("platforms");
  const tCommon = useTranslations("common");

  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [integratedPlatforms, setIntegratedPlatforms] = useState<Set<string>>(new Set());
  const [visiblePlatforms, setVisiblePlatforms] = useState<{ value: string; label: string }[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<PlatformAccount | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [testingId, setTestingId] = useState<number | null>(null);

  // Form state
  const [platform, setPlatform] = useState("linkedin");
  const [authType, setAuthType] = useState("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const load = useCallback(async () => {
    const [accountsData, integrations, availableNames] = await Promise.all([
      getPlatformAccounts(),
      getServiceIntegrationPlatforms(),
      getAvailablePlatformNames(),
    ]);
    if (!("error" in accountsData)) {
      setAccounts(accountsData.accounts);
    }
    setIntegratedPlatforms(new Set(integrations));
    setVisiblePlatforms(
      availableNames.map((name) => ({
        value: name,
        label: ALL_PLATFORM_LABELS[name] || name,
      }))
    );
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function resetForm() {
    setPlatform(visiblePlatforms[0]?.value || "linkedin");
    setAuthType("password");
    setEmail("");
    setPassword("");
    setShowPassword(false);
    setError("");
    setEditingAccount(null);
  }

  function openAddDialog(platformValue?: string) {
    resetForm();
    if (platformValue) setPlatform(platformValue);
    setDialogOpen(true);
  }

  function openEditDialog(account: PlatformAccount) {
    setEditingAccount(account);
    setPlatform(account.platform);
    setAuthType(account.authType);
    setEmail(account.email || "");
    setPassword("");
    setShowPassword(false);
    setError("");
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (editingAccount) {
      const result = await updatePlatformAccount(editingAccount.id, {
        email,
        password: password || undefined,
        authType,
      });
      if ("error" in result && result.error) {
        setError(result.error);
      } else {
        setDialogOpen(false);
        resetForm();
        await load();
      }
    } else {
      const result = await addPlatformAccount({
        platform,
        authType,
        email,
        password: password || undefined,
      });
      if ("error" in result && result.error) {
        setError(result.error);
      } else {
        setDialogOpen(false);
        resetForm();
        await load();
      }
    }

    setLoading(false);
  }

  async function handleDelete(id: number) {
    if (!confirm(t("delete_confirm"))) return;
    await deletePlatformAccount(id);
    await load();
  }

  async function handleTest(id: number) {
    setTestingId(id);
    await testPlatformConnection(id);
    await load();
    setTestingId(null);
  }

  // Sort platforms: JF account available first, then personal account, then not configured
  const sortedPlatforms = [...visiblePlatforms].sort((a, b) => {
    const aAccount = accounts.find((acc) => acc.platform === a.value);
    const bAccount = accounts.find((acc) => acc.platform === b.value);
    const aJF = integratedPlatforms.has(a.value);
    const bJF = integratedPlatforms.has(b.value);

    // Priority: has personal account (2) > JF only (1) > nothing (0)
    const aScore = aAccount ? 2 : aJF ? 1 : 0;
    const bScore = bAccount ? 2 : bJF ? 1 : 0;
    if (aScore !== bScore) return bScore - aScore;
    return 0;
  });

  return (
    <div className="space-y-6">
      <SettingsTabs active="platforms" />

      {/* Platform Status Overview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            {t("title")}
          </CardTitle>
          <Button
            size="sm"
            onClick={() => openAddDialog()}
          >
            <Plus className="h-4 w-4 mr-1" />
            {t("add")}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {sortedPlatforms.map((p) => {
              const account = accounts.find((a) => a.platform === p.value);
              const hasJFAccount = integratedPlatforms.has(p.value);
              const isLinkedIn = p.value === "linkedin";

              return (
                <div
                  key={p.value}
                  className="flex items-center justify-between p-3 rounded-lg border border-border"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{p.label}</p>

                      {/* Account type description */}
                      {account ? (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <User className="h-3 w-3 flex-shrink-0" />
                          {t("using_personal_account")}
                          {account.email && (
                            <span className="text-foreground/70">{account.email}</span>
                          )}
                        </p>
                      ) : hasJFAccount ? (
                        <p className="text-xs text-status-success/80 flex items-center gap-1 mt-0.5">
                          <Shield className="h-3 w-3 flex-shrink-0" />
                          {t("using_jf_account")}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground/60 mt-0.5">
                          {t("not_configured_desc")}
                        </p>
                      )}

                      {isLinkedIn && !account && (
                        <p className="text-xs text-blue-400 flex items-center gap-1 mt-0.5">
                          <Info className="h-3 w-3 flex-shrink-0" />
                          {t("linkedin_recommendation")}
                        </p>
                      )}
                    </div>

                    {/* Status badges */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {hasJFAccount && (
                        <Badge className="bg-status-success/15 text-status-success border-status-success/30">
                          <Shield className="h-3 w-3 mr-1" />
                          {t("available_via_jf")}
                        </Badge>
                      )}
                      {account ? (
                        <Badge className={statusColor(account.status)}>
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          {account.status === "active"
                            ? t("status_connected")
                            : account.status === "failed"
                              ? t("status_failed")
                              : account.status}
                        </Badge>
                      ) : !hasJFAccount ? (
                        <Badge className="bg-status-warning/10 text-status-warning border-status-warning/20">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {t("status_not_configured")}
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                    {account ? (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleTest(account.id)}
                          disabled={testingId === account.id}
                        >
                          {testingId === account.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Plug className="h-4 w-4" />
                          )}
                          <span className="ml-1 hidden sm:inline">
                            {t("test_connection")}
                          </span>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openEditDialog(account)}
                        >
                          <Pencil className="h-4 w-4" />
                          <span className="ml-1 hidden sm:inline">
                            {t("modify_credentials")}
                          </span>
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(account.id)}
                        >
                          <Trash2 className="h-4 w-4 text-status-error" />
                        </Button>
                      </>
                    ) : hasJFAccount ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openAddDialog(p.value)}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        {t("add_personal_credentials")}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openAddDialog(p.value)}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        {t("setup")}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Platform Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingAccount ? t("modify_credentials") : t("add")}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {!editingAccount && (
              <div className="space-y-2">
                <Label>{t("platform")}</Label>
                <Select
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value)}
                >
                  {visiblePlatforms.map((p) => (
                    <SelectOption key={p.value} value={p.value}>
                      {p.label}
                    </SelectOption>
                  ))}
                </Select>
              </div>
            )}

            {editingAccount && (
              <div className="text-sm text-muted-foreground">
                {ALL_PLATFORM_LABELS[editingAccount.platform] || editingAccount.platform}
              </div>
            )}

            <div className="space-y-2">
              <Label>{t("auth_type")}</Label>
              <Select
                value={authType}
                onChange={(e) => setAuthType(e.target.value)}
              >
                {AUTH_TYPES.map((a) => (
                  <SelectOption key={a.value} value={a.value}>
                    {a.label}
                  </SelectOption>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("email")}</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            {authType === "password" && (
              <div className="space-y-2">
                <Label>
                  {t("password")}
                  {editingAccount && (
                    <span className="text-xs text-muted-foreground ml-2">
                      {t("password_leave_empty")}
                    </span>
                  )}
                </Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                    placeholder={editingAccount ? "••••••••" : ""}
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Show info when platform has JF account */}
            {!editingAccount && integratedPlatforms.has(platform) && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-status-success/10 border border-status-success/20">
                <Shield className="h-4 w-4 text-status-success mt-0.5 flex-shrink-0" />
                <p className="text-xs text-status-success">
                  {t("jf_account_info")}
                </p>
              </div>
            )}

            {error && <p className="text-sm text-status-error">{error}</p>}

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setDialogOpen(false)}
              >
                {tCommon("cancel")}
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? tCommon("loading") : tCommon("save")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Auto-registration section */}
      <AutoRegisterSection />
    </div>
  );
}
