"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  getPlatformAccounts,
  addPlatformAccount,
  deletePlatformAccount,
  testPlatformConnection,
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
} from "lucide-react";
import SettingsTabs from "../settings-tabs";

const PLATFORMS = [
  { value: "linkedin", label: "LinkedIn" },
  { value: "indeed", label: "Indeed" },
  { value: "glassdoor", label: "Glassdoor" },
  { value: "wellfound", label: "Wellfound" },
  { value: "arcdev", label: "Arc.dev" },
  { value: "djinni", label: "Djinni" },
  { value: "dou", label: "DOU" },
  { value: "remoteok", label: "RemoteOK" },
  { value: "weworkremotely", label: "WeWorkRemotely" },
];

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
      return "bg-green-500/20 text-green-400 border-green-500/30";
    case "needs_attention":
      return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
    case "failed":
      return "bg-red-500/20 text-red-400 border-red-500/30";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
}

function platformLabel(value: string) {
  return PLATFORMS.find((p) => p.value === value)?.label ?? value;
}

export default function PlatformsPage() {
  const t = useTranslations("platforms");
  const tCommon = useTranslations("common");

  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
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
    const data = await getPlatformAccounts();
    if ("error" in data) return;
    setAccounts(data.accounts);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function resetForm() {
    setPlatform("linkedin");
    setAuthType("password");
    setEmail("");
    setPassword("");
    setShowPassword(false);
    setError("");
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

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

  return (
    <div className="space-y-6">
      <SettingsTabs active="platforms" />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            {t("title")}
          </CardTitle>
          <Button
            size="sm"
            onClick={() => {
              resetForm();
              setDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1" />
            {t("add")}
          </Button>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("no_platforms")}</p>
          ) : (
            <div className="space-y-2">
              {accounts.map((acc) => (
                <div
                  key={acc.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-medium">
                        {platformLabel(acc.platform)}
                      </p>
                      <p className="text-xs text-muted-foreground">{acc.email}</p>
                    </div>
                    <Badge className={statusColor(acc.status)}>
                      {acc.status === "active"
                        ? t("status_connected")
                        : acc.status === "failed"
                          ? t("status_failed")
                          : acc.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleTest(acc.id)}
                      disabled={testingId === acc.id}
                    >
                      {testingId === acc.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plug className="h-4 w-4" />
                      )}
                      <span className="ml-1 hidden sm:inline">
                        {t("test_connection")}
                      </span>
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(acc.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Platform Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("add")}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <div className="space-y-2">
              <Label>{t("platform")}</Label>
              <Select
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
              >
                {PLATFORMS.map((p) => (
                  <SelectOption key={p.value} value={p.value}>
                    {p.label}
                  </SelectOption>
                ))}
              </Select>
            </div>

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
                <Label>{t("password")}</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
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

            {error && <p className="text-sm text-red-400">{error}</p>}

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
    </div>
  );
}
