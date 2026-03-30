"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import {
  getUsers,
  changeUserRole,
  removeUser,
  getUserStats,
  updateApplicationLimit,
} from "@/actions/admin";
import {
  getAdminEmails,
  markAdminEmailAsRead,
  getAdminEmailUnreadCount,
  sendEmail,
  deleteAdminEmail,
} from "@/actions/admin-emails";
import { ALL_PLATFORMS, type PlatformStatus, type PlatformMeta } from "@/lib/platforms";
import {
  getServiceCredentials,
  saveServiceCredentials,
  checkPlatformIntegration,
  getAllPlatformStatuses,
  getPlatformMetadata,
  getEnabledPlatforms,
  togglePlatform,
} from "@/actions/admin-platforms";
import {
  getTelegramBotStatus,
  setupTelegramWebhook,
  removeTelegramWebhook,
  getTelegramConnectedUsers,
} from "@/actions/admin-telegram";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectOption } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Trash2,
  Users,
  BarChart3,
  Globe,
  ChevronDown,
  ChevronUp,
  Mail,
  Eye,
  Reply,
  Forward,
  Send,
  X,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Save,
  Shield,
  ExternalLink,
  MessageCircle,
  Bot,
  Link2,
  Unlink,
} from "lucide-react";
import { sanitizeHtml } from "@/lib/sanitize-html";

type UserRow = {
  id: number;
  email: string;
  name: string | null;
  role: string;
  applicationLimit: number;
  createdAt: Date;
};

type UserStatsData = {
  vacancyCount: number;
  applicationsByStatus: Record<string, number>;
  totalApplications: number;
  searchProfileCount: number;
  lastActiveAt: Date | null;
};

type PlatformCheckResult = PlatformStatus & {
  checking?: boolean;
  vacancyCount?: number;
};

type AdminEmailRow = {
  id: number;
  fromEmail: string;
  toEmail: string;
  subject: string;
  body: string;
  bodyText: string | null;
  bodyHtml: string | null;
  messageId: string | null;
  platform: string | null;
  category: string;
  read: boolean;
  createdAt: Date;
};

export default function AdminPage() {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");

  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedUser, setExpandedUser] = useState<number | null>(null);
  const [userStats, setUserStats] = useState<Record<number, UserStatsData>>({});
  const [statsLoading, setStatsLoading] = useState<number | null>(null);
  const [platformStatuses, setPlatformStatuses] = useState<Record<string, PlatformCheckResult>>({});
  const [platformMeta, setPlatformMeta] = useState<Record<string, PlatformMeta>>({});
  const [enabledPlatforms, setEnabledPlatforms] = useState<Record<string, boolean>>({});
  const [platformsLoading, setPlatformsLoading] = useState(false);
  const [platformsCheckingAll, setPlatformsCheckingAll] = useState(false);
  const [serviceEmail, setServiceEmail] = useState("");
  const [servicePassword, setServicePassword] = useState("");
  const [credentialsLoading, setCredentialsLoading] = useState(false);
  const [credentialsSaved, setCredentialsSaved] = useState(false);
  const [adminEmails, setAdminEmails] = useState<AdminEmailRow[]>([]);
  const [adminEmailsLoading, setAdminEmailsLoading] = useState(false);
  const [emailFilter, setEmailFilter] = useState("all");
  const [expandedEmail, setExpandedEmail] = useState<number | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [composeMode, setComposeMode] = useState<"reply" | "forward" | null>(null);
  const [composeEmail, setComposeEmail] = useState<AdminEmailRow | null>(null);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [sending, setSending] = useState(false);

  // Telegram bot state
  const [telegramStatus, setTelegramStatus] = useState<{
    configured: boolean;
    connected: boolean;
    botUsername: string | null;
    webhookUrl: string | null;
    connectedUsers: number;
  } | null>(null);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [telegramUsers, setTelegramUsers] = useState<{
    id: number;
    email: string;
    name: string | null;
    telegramUsername: string | null;
    telegramChatId: string | null;
  }[]>([]);
  const [webhookSetupLoading, setWebhookSetupLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getUsers();
      if ("error" in data) {
        setError(data.error as string);
      } else {
        setUsers(data.users ?? []);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    // Load unread count for the emails tab badge
    getAdminEmailUnreadCount()
      .then((data) => {
        if ("count" in data) setUnreadCount(data.count);
      })
      .catch(() => {});
  }, [load]);

  async function loadPlatformData() {
    setPlatformsLoading(true);
    try {
      const [creds, meta, enabled] = await Promise.all([
        getServiceCredentials(),
        getPlatformMetadata(),
        getEnabledPlatforms(),
      ]);
      if (creds) {
        setServiceEmail(creds.email);
        setServicePassword(creds.password);
      }
      if (meta) {
        setPlatformMeta(meta);
      }
      if (enabled) {
        setEnabledPlatforms(enabled);
      }
    } catch {
      // silently fail
    }
    setPlatformsLoading(false);
  }

  async function handleSaveCredentials() {
    setCredentialsLoading(true);
    setCredentialsSaved(false);
    try {
      const result = await saveServiceCredentials(serviceEmail, servicePassword);
      if (result.ok) {
        setCredentialsSaved(true);
        setTimeout(() => setCredentialsSaved(false), 3000);
      }
    } catch {
      // silently fail
    }
    setCredentialsLoading(false);
  }

  async function handleCheckPlatform(platform: string) {
    setPlatformStatuses((prev) => ({
      ...prev,
      [platform]: { ...prev[platform], platform, checking: true, status: "checking", lastCheck: null, message: "" },
    }));
    try {
      const result = await checkPlatformIntegration(platform);
      setPlatformStatuses((prev) => ({
        ...prev,
        [platform]: {
          platform,
          status: result.status,
          lastCheck: new Date().toISOString(),
          message: result.message,
          vacancyCount: result.vacancyCount,
          checking: false,
        },
      }));
    } catch {
      setPlatformStatuses((prev) => ({
        ...prev,
        [platform]: {
          platform,
          status: "error",
          lastCheck: new Date().toISOString(),
          message: "Check failed",
          checking: false,
        },
      }));
    }
  }

  async function handleCheckAllPlatforms() {
    setPlatformsCheckingAll(true);
    // Mark all as checking
    const initial: Record<string, PlatformCheckResult> = {};
    for (const p of ALL_PLATFORMS) {
      initial[p] = { platform: p, status: "checking", lastCheck: null, message: "", checking: true };
    }
    setPlatformStatuses(initial);

    try {
      const results = await getAllPlatformStatuses();
      const updated: Record<string, PlatformCheckResult> = {};
      for (const r of results) {
        updated[r.platform] = { ...r, checking: false };
      }
      setPlatformStatuses(updated);
    } catch {
      // silently fail
    }
    setPlatformsCheckingAll(false);
  }

  async function loadAdminEmails(category?: string) {
    setAdminEmailsLoading(true);
    try {
      const data = await getAdminEmails({
        category: category || emailFilter,
      });
      if ("emails" in data) {
        setAdminEmails(data.emails as AdminEmailRow[]);
      }
      const countData = await getAdminEmailUnreadCount();
      if ("count" in countData) {
        setUnreadCount(countData.count);
      }
    } catch {
      // silently fail
    }
    setAdminEmailsLoading(false);
  }

  async function handleMarkRead(emailId: number) {
    try {
      await markAdminEmailAsRead(emailId);
      setAdminEmails((prev) =>
        prev.map((e) => (e.id === emailId ? { ...e, read: true } : e))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // silently fail
    }
  }

  async function handleRoleChange(userId: number, newRole: string) {
    const result = await changeUserRole(userId, newRole);
    if (result && "error" in result) {
      setError(result.error ?? "");
    } else {
      await load();
    }
  }

  async function handleRemove(userId: number) {
    if (!confirm(t("remove_confirm"))) return;
    const result = await removeUser(userId);
    if (result && "error" in result) {
      setError(result.error ?? "");
    } else {
      await load();
    }
  }

  async function handleLimitChange(userId: number, value: string) {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 1 || num > 100) return;
    const result = await updateApplicationLimit(userId, num);
    if (result && "error" in result) {
      setError(result.error ?? "");
    } else {
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, applicationLimit: num } : u
        )
      );
    }
  }

  async function toggleUserStats(userId: number) {
    if (expandedUser === userId) {
      setExpandedUser(null);
      return;
    }
    setExpandedUser(userId);
    if (!userStats[userId]) {
      setStatsLoading(userId);
      try {
        const stats = await getUserStats(userId);
        setUserStats((prev) => ({ ...prev, [userId]: stats }));
      } catch {
        // silently fail
      }
      setStatsLoading(null);
    }
  }

  async function handleDeleteAdminEmail(emailId: number) {
    if (!confirm(t("email_delete_confirm"))) return;
    try {
      await deleteAdminEmail(emailId);
      setAdminEmails((prev) => prev.filter((e) => e.id !== emailId));
      if (expandedEmail === emailId) setExpandedEmail(null);
    } catch {
      // silently fail
    }
  }

  function handleReply(email: AdminEmailRow) {
    setComposeMode("reply");
    setComposeEmail(email);
    setComposeTo(email.fromEmail);
    setComposeSubject(email.subject.startsWith("Re:") ? email.subject : `Re: ${email.subject}`);
    setComposeBody("");
  }

  function handleForward(email: AdminEmailRow) {
    setComposeMode("forward");
    setComposeEmail(email);
    setComposeTo("");
    setComposeSubject(email.subject.startsWith("Fwd:") ? email.subject : `Fwd: ${email.subject}`);
    const fwdBody = email.bodyText || email.body || "";
    setComposeBody(`\n\n---------- Forwarded message ----------\nFrom: ${email.fromEmail}\nSubject: ${email.subject}\nDate: ${new Date(email.createdAt).toLocaleString()}\n\n${fwdBody.substring(0, 5000)}`);
  }

  async function handleSendEmail() {
    if (!composeTo || !composeSubject) return;
    setSending(true);
    try {
      const result = await sendEmail({
        to: composeTo,
        subject: composeSubject,
        body: composeBody,
        inReplyTo: composeMode === "reply" ? composeEmail?.messageId || undefined : undefined,
      });
      if (result && "error" in result) {
        setError(result.error ?? "");
      } else {
        setComposeMode(null);
        setComposeEmail(null);
        setComposeTo("");
        setComposeSubject("");
        setComposeBody("");
      }
    } catch {
      setError("Failed to send email");
    }
    setSending(false);
  }

  async function loadTelegramData() {
    setTelegramLoading(true);
    try {
      const [status, users] = await Promise.all([
        getTelegramBotStatus(),
        getTelegramConnectedUsers(),
      ]);
      setTelegramStatus(status);
      setTelegramUsers(users.users);
    } catch {
      // silently fail
    }
    setTelegramLoading(false);
  }

  async function handleSetupWebhook() {
    setWebhookSetupLoading(true);
    try {
      const result = await setupTelegramWebhook();
      if (result.ok) {
        await loadTelegramData();
      } else {
        setError(result.error || "Failed to setup webhook");
      }
    } catch {
      setError("Failed to setup webhook");
    }
    setWebhookSetupLoading(false);
  }

  async function handleRemoveWebhook() {
    setWebhookSetupLoading(true);
    try {
      await removeTelegramWebhook();
      await loadTelegramData();
    } catch {
      setError("Failed to remove webhook");
    }
    setWebhookSetupLoading(false);
  }

  function roleBadgeVariant(role: string) {
    switch (role) {
      case "owner":
        return "default";
      case "user":
        return "secondary";
      case "guest":
        return "outline";
      default:
        return "outline";
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">{tCommon("loading")}</p>
      </div>
    );
  }

  if (error && users.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("description")}
        </p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">
            <Users className="h-4 w-4 mr-1.5" />
            {t("tab_users")}
          </TabsTrigger>
          <TabsTrigger value="stats">
            <BarChart3 className="h-4 w-4 mr-1.5" />
            {t("tab_stats")}
          </TabsTrigger>
          <TabsTrigger
            value="platforms"
            onClick={() => {
              if (!serviceEmail && !platformsLoading) loadPlatformData();
            }}
          >
            <Globe className="h-4 w-4 mr-1.5" />
            {t("tab_platforms")}
          </TabsTrigger>
          <TabsTrigger
            value="admin-emails"
            onClick={() => {
              if (adminEmails.length === 0) loadAdminEmails();
            }}
          >
            <Mail className="h-4 w-4 mr-1.5" />
            {t("tab_emails")}
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-1.5 text-[10px] px-1.5 py-0">
                {unreadCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="telegram"
            onClick={() => {
              if (!telegramStatus && !telegramLoading) loadTelegramData();
            }}
          >
            <MessageCircle className="h-4 w-4 mr-1.5" />
            {t("tab_telegram")}
          </TabsTrigger>
        </TabsList>

        {/* Users tab */}
        <TabsContent value="users">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {t("all_users")}
                <Badge variant="secondary" className="ml-auto">
                  {users.length}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {users.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("no_users")}
                </p>
              ) : (
                <div className="space-y-3">
                  {users.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between gap-4 p-3 rounded-lg border border-border"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="h-9 w-9 rounded-full bg-primary flex items-center justify-center text-sm font-medium text-primary-foreground shrink-0">
                          {(u.name || u.email).charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {u.name || u.email}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {u.email}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(u.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={roleBadgeVariant(u.role)}>
                          {u.role}
                        </Badge>

                        <Select
                          value={u.role}
                          onChange={(e) =>
                            handleRoleChange(u.id, e.target.value)
                          }
                          className="w-24"
                        >
                          <SelectOption value="owner">
                            {t("role_owner")}
                          </SelectOption>
                          <SelectOption value="user">
                            {t("role_user")}
                          </SelectOption>
                          <SelectOption value="guest">
                            {t("role_guest")}
                          </SelectOption>
                        </Select>

                        <div className="flex items-center gap-1">
                          <label className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {t("application_limit")}
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={u.applicationLimit}
                            onChange={(e) =>
                              setUsers((prev) =>
                                prev.map((usr) =>
                                  usr.id === u.id
                                    ? { ...usr, applicationLimit: parseInt(e.target.value, 10) || u.applicationLimit }
                                    : usr
                                )
                              )
                            }
                            onBlur={(e) => handleLimitChange(u.id, e.target.value)}
                            className="w-14 rounded-md border border-border bg-background px-2 py-1 text-sm text-center"
                          />
                        </div>

                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleRemove(u.id)}
                          title={tCommon("delete")}
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
        </TabsContent>

        {/* User Stats tab */}
        <TabsContent value="stats">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                {t("user_stats_title")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {users.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("no_users")}
                </p>
              ) : (
                <div className="space-y-2">
                  {users.map((u) => {
                    const isExpanded = expandedUser === u.id;
                    const stats = userStats[u.id];
                    const isLoading = statsLoading === u.id;

                    return (
                      <div
                        key={u.id}
                        className="rounded-lg border border-border"
                      >
                        <button
                          type="button"
                          className="w-full flex items-center justify-between gap-4 p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => toggleUserStats(u.id)}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-sm font-medium text-primary-foreground shrink-0">
                              {(u.name || u.email).charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 text-left">
                              <p className="text-sm font-medium truncate">
                                {u.name || u.email}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {u.email}
                              </p>
                            </div>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                        </button>

                        {isExpanded && (
                          <div className="px-3 pb-3 border-t border-border pt-3">
                            {isLoading ? (
                              <p className="text-sm text-muted-foreground">
                                {tCommon("loading")}
                              </p>
                            ) : stats ? (
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <div className="rounded-md bg-muted/50 p-2.5">
                                  <p className="text-xs text-muted-foreground">
                                    {t("stat_vacancies")}
                                  </p>
                                  <p className="text-lg font-semibold">
                                    {stats.vacancyCount}
                                  </p>
                                </div>
                                <div className="rounded-md bg-muted/50 p-2.5">
                                  <p className="text-xs text-muted-foreground">
                                    {t("stat_applications")}
                                  </p>
                                  <p className="text-lg font-semibold">
                                    {stats.totalApplications}
                                  </p>
                                  {Object.keys(stats.applicationsByStatus)
                                    .length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-1">
                                      {Object.entries(
                                        stats.applicationsByStatus
                                      ).map(([status, count]) => (
                                        <Badge
                                          key={status}
                                          variant="outline"
                                          className="text-[10px] px-1.5 py-0"
                                        >
                                          {status}: {count}
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div className="rounded-md bg-muted/50 p-2.5">
                                  <p className="text-xs text-muted-foreground">
                                    {t("stat_search_profiles")}
                                  </p>
                                  <p className="text-lg font-semibold">
                                    {stats.searchProfileCount}
                                  </p>
                                </div>
                                <div className="rounded-md bg-muted/50 p-2.5">
                                  <p className="text-xs text-muted-foreground">
                                    {t("stat_last_active")}
                                  </p>
                                  <p className="text-sm font-medium">
                                    {stats.lastActiveAt
                                      ? new Date(
                                          stats.lastActiveAt
                                        ).toLocaleDateString()
                                      : t("stat_never")}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">
                                {t("stats_error")}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Platform Integrations tab */}
        <TabsContent value="platforms">
          <div className="space-y-4">
            {/* Service Account Credentials */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  {t("service_credentials_title")}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("service_credentials_desc")}
                </p>
              </CardHeader>
              <CardContent>
                {platformsLoading ? (
                  <p className="text-sm text-muted-foreground">
                    {tCommon("loading")}
                  </p>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-3 items-end">
                    <div className="flex-1 min-w-0">
                      <label className="text-sm text-muted-foreground block mb-1">
                        {t("service_email_label")}
                      </label>
                      <input
                        type="email"
                        value={serviceEmail}
                        onChange={(e) => setServiceEmail(e.target.value)}
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                        placeholder="jf@taras.cloud"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <label className="text-sm text-muted-foreground block mb-1">
                        {t("service_password_label")}
                      </label>
                      <input
                        type="password"
                        value={servicePassword}
                        onChange={(e) => setServicePassword(e.target.value)}
                        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                        placeholder="••••••••"
                      />
                    </div>
                    <Button
                      onClick={handleSaveCredentials}
                      disabled={credentialsLoading || !serviceEmail}
                      className="shrink-0"
                    >
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

            {/* All Platforms Grid */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Globe className="h-5 w-5" />
                  {t("platform_registrations_title")}
                  <Badge variant="secondary" className="ml-1">
                    {ALL_PLATFORMS.length}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto"
                    onClick={handleCheckAllPlatforms}
                    disabled={platformsCheckingAll}
                  >
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
                  {[...ALL_PLATFORMS].sort((a, b) => {
                    // Sort: enabled/active first, then by reliability (reliable > moderate > unreliable > defunct)
                    const aEnabled = enabledPlatforms[a] ?? true;
                    const bEnabled = enabledPlatforms[b] ?? true;
                    if (aEnabled !== bEnabled) return aEnabled ? -1 : 1;

                    const reliabilityOrder: Record<string, number> = {
                      reliable: 0,
                      moderate: 1,
                      unreliable: 2,
                      defunct: 3,
                    };
                    const aMeta = platformMeta[a];
                    const bMeta = platformMeta[b];
                    const aRel = reliabilityOrder[aMeta?.reliability ?? "moderate"] ?? 1;
                    const bRel = reliabilityOrder[bMeta?.reliability ?? "moderate"] ?? 1;
                    if (aRel !== bRel) return aRel - bRel;

                    // Within same group, sort by check status: connected > blocked > not checked > unreachable
                    const statusOrder: Record<string, number> = {
                      connected: 0,
                      blocked: 1,
                      checking: 2,
                      "": 3, // not checked
                      unreachable: 4,
                      error: 5,
                    };
                    const aStatus = statusOrder[platformStatuses[a]?.status ?? ""] ?? 3;
                    const bStatus = statusOrder[platformStatuses[b]?.status ?? ""] ?? 3;
                    return aStatus - bStatus;
                  }).map((platform) => {
                    const info = platformStatuses[platform];
                    const meta = platformMeta[platform];
                    const isChecking = info?.checking;

                    return (
                      <div
                        key={platform}
                        className="rounded-lg border border-border p-3 flex flex-col gap-2"
                      >
                        {/* Header: toggle + name + status badge */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={async () => {
                                const newVal = !(enabledPlatforms[platform] ?? true);
                                setEnabledPlatforms(prev => ({ ...prev, [platform]: newVal }));
                                await togglePlatform(platform, newVal);
                              }}
                              className={`w-8 h-4 rounded-full transition-colors relative ${
                                (enabledPlatforms[platform] ?? true) ? "bg-primary" : "bg-muted"
                              }`}
                            >
                              <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
                                (enabledPlatforms[platform] ?? true) ? "left-4" : "left-0.5"
                              }`} />
                            </button>
                            <span className={`text-sm font-medium capitalize ${
                              (enabledPlatforms[platform] ?? true) ? "" : "text-muted-foreground line-through"
                            }`}>
                              {platform}
                            </span>
                          </div>
                          {info ? (
                            <PlatformStatusBadge status={info.status} t={t} />
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              {t("status_not_checked")}
                            </Badge>
                          )}
                        </div>

                        {/* Metadata badges */}
                        {meta && (
                          <div className="flex flex-wrap gap-1">
                            <ReliabilityBadge reliability={meta.reliability} t={t} />
                            {meta.requiresAuth && (
                              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                {t("auth_required")}
                              </Badge>
                            )}
                          </div>
                        )}

                        {/* Note from metadata */}
                        {meta?.note && (
                          <p className="text-[11px] text-muted-foreground leading-tight">
                            {meta.note}
                          </p>
                        )}

                        {/* Registration link */}
                        {meta?.registrationUrl && (
                          <a
                            href={meta.registrationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                          >
                            <ExternalLink className="h-3 w-3" />
                            {t("register")}
                            {serviceEmail && (
                              <span className="text-muted-foreground ml-1">
                                ({serviceEmail})
                              </span>
                            )}
                          </a>
                        )}

                        {/* Scrape result */}
                        {info?.status === "connected" && !isChecking && (
                          <p className="text-xs text-green-400 font-medium">
                            {t("vacancies_found", { count: info.vacancyCount ?? 0 })}
                          </p>
                        )}

                        {info?.message && info.status !== "connected" && !isChecking && (
                          <p className="text-xs text-muted-foreground truncate" title={info.message}>
                            {info.message}
                          </p>
                        )}

                        {info?.lastCheck && !isChecking && (
                          <p className="text-[10px] text-muted-foreground">
                            {t("last_check")}: {new Date(info.lastCheck).toLocaleTimeString()}
                          </p>
                        )}

                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full mt-auto"
                          onClick={() => handleCheckPlatform(platform)}
                          disabled={isChecking}
                        >
                          {isChecking ? (
                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                          ) : (
                            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                          )}
                          {t("check_integration")}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        {/* Admin Emails tab */}
        <TabsContent value="admin-emails">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                {t("emails_title")}
                {adminEmails.length > 0 && (
                  <Badge variant="secondary" className="ml-auto">
                    {adminEmails.length}
                  </Badge>
                )}
              </CardTitle>
              <div className="flex gap-2 mt-3 flex-wrap">
                {["all", "registration", "confirmation", "notification", "other"].map(
                  (cat) => (
                    <Button
                      key={cat}
                      size="sm"
                      variant={emailFilter === cat ? "default" : "outline"}
                      onClick={() => {
                        setEmailFilter(cat);
                        loadAdminEmails(cat);
                      }}
                    >
                      {t(`email_filter_${cat}`)}
                    </Button>
                  )
                )}
              </div>
            </CardHeader>
            <CardContent>
              {adminEmailsLoading ? (
                <p className="text-sm text-muted-foreground">
                  {tCommon("loading")}
                </p>
              ) : adminEmails.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("no_admin_emails")}
                </p>
              ) : (
                <div className="space-y-2">
                  {adminEmails.map((email) => {
                    const isExpanded = expandedEmail === email.id;
                    return (
                      <div
                        key={email.id}
                        className={`rounded-lg border ${
                          email.read
                            ? "border-border"
                            : "border-primary/30 bg-primary/5"
                        }`}
                      >
                        <button
                          type="button"
                          className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors cursor-pointer text-left"
                          onClick={() =>
                            setExpandedEmail(isExpanded ? null : email.id)
                          }
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p
                                className={`text-sm truncate ${
                                  email.read
                                    ? "text-muted-foreground"
                                    : "font-semibold"
                                }`}
                              >
                                {email.subject}
                              </p>
                              {!email.read && (
                                <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {email.fromEmail}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {email.platform && (
                              <Badge variant="outline" className="text-[10px] capitalize">
                                {email.platform}
                              </Badge>
                            )}
                            <Badge
                              variant="secondary"
                              className="text-[10px]"
                            >
                              {t(`email_cat_${email.category}`)}
                            </Badge>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {new Date(email.createdAt).toLocaleDateString()}
                            </span>
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="px-3 pb-3 border-t border-border pt-3 space-y-3">
                            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                              <div>
                                <span className="font-medium">{t("email_from")}:</span>{" "}
                                {email.fromEmail}
                              </div>
                              <div>
                                <span className="font-medium">{t("email_date")}:</span>{" "}
                                {new Date(email.createdAt).toLocaleString()}
                              </div>
                            </div>
                            {email.bodyHtml ? (
                              <div
                                className="bg-muted/50 rounded-md p-3 text-sm max-h-96 overflow-y-auto prose prose-sm prose-invert max-w-none"
                                dangerouslySetInnerHTML={{ __html: sanitizeHtml(email.bodyHtml) }}
                              />
                            ) : email.bodyText ? (
                              <div className="bg-muted/50 rounded-md p-3 text-sm whitespace-pre-wrap max-h-64 overflow-y-auto font-mono text-xs">
                                {email.bodyText}
                              </div>
                            ) : (
                              <div className="bg-muted/50 rounded-md p-3 text-sm whitespace-pre-wrap max-h-64 overflow-y-auto font-mono text-xs">
                                {email.body || "(empty)"}
                              </div>
                            )}
                            <div className="flex items-center gap-2">
                              {!email.read && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMarkRead(email.id);
                                  }}
                                >
                                  <Eye className="h-3.5 w-3.5 mr-1.5" />
                                  {t("email_mark_read")}
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleReply(email);
                                }}
                              >
                                <Reply className="h-3.5 w-3.5 mr-1.5" />
                                {t("email_reply")}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleForward(email);
                                }}
                              >
                                <Forward className="h-3.5 w-3.5 mr-1.5" />
                                {t("email_forward")}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-red-400 hover:text-red-300 ml-auto"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteAdminEmail(email.id);
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                {t("email_delete")}
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Telegram tab */}
        <TabsContent value="telegram">
          <div className="space-y-4">
            {/* Bot Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  {t("telegram_bot_status")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {telegramLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {tCommon("loading")}
                  </div>
                ) : telegramStatus ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">{t("telegram_token")}:</span>
                      {telegramStatus.configured ? (
                        <Badge variant="default" className="bg-green-600">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          {t("telegram_configured")}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-red-400 border-red-400/50">
                          <XCircle className="h-3 w-3 mr-1" />
                          {t("telegram_not_configured")}
                        </Badge>
                      )}
                    </div>

                    {telegramStatus.configured && (
                      <>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-muted-foreground">{t("telegram_connection")}:</span>
                          {telegramStatus.connected ? (
                            <Badge variant="default" className="bg-green-600">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              {t("status_connected")}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-red-400 border-red-400/50">
                              <XCircle className="h-3 w-3 mr-1" />
                              {t("telegram_disconnected")}
                            </Badge>
                          )}
                        </div>

                        {telegramStatus.botUsername && (
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground">{t("telegram_bot_username")}:</span>
                            <a
                              href={`https://t.me/${telegramStatus.botUsername}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-primary hover:underline flex items-center gap-1"
                            >
                              @{telegramStatus.botUsername}
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          </div>
                        )}

                        <div className="flex items-center gap-3">
                          <span className="text-sm text-muted-foreground">{t("telegram_webhook")}:</span>
                          {telegramStatus.webhookUrl ? (
                            <div className="flex items-center gap-2">
                              <Badge variant="default" className="bg-green-600">
                                <Link2 className="h-3 w-3 mr-1" />
                                {t("telegram_webhook_active")}
                              </Badge>
                              <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                                {telegramStatus.webhookUrl}
                              </code>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleRemoveWebhook}
                                disabled={webhookSetupLoading}
                              >
                                {webhookSetupLoading ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Unlink className="h-3 w-3 mr-1" />
                                )}
                                {t("telegram_remove_webhook")}
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-orange-400 border-orange-400/50">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                {t("telegram_no_webhook")}
                              </Badge>
                              <Button
                                size="sm"
                                variant="default"
                                onClick={handleSetupWebhook}
                                disabled={webhookSetupLoading}
                              >
                                {webhookSetupLoading ? (
                                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                ) : (
                                  <Link2 className="h-3 w-3 mr-1" />
                                )}
                                {t("telegram_setup_webhook")}
                              </Button>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <span className="text-sm text-muted-foreground">{t("telegram_connected_users")}:</span>
                          <Badge variant="secondary">{telegramStatus.connectedUsers}</Badge>
                        </div>
                      </>
                    )}

                    {!telegramStatus.configured && (
                      <p className="text-sm text-muted-foreground">
                        {t("telegram_setup_hint")}
                      </p>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={loadTelegramData}
                      disabled={telegramLoading}
                    >
                      <RefreshCw className={`h-3 w-3 mr-1 ${telegramLoading ? "animate-spin" : ""}`} />
                      {t("telegram_refresh")}
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            {/* Connected Users */}
            {telegramUsers.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    {t("telegram_users_title")}
                    <Badge variant="secondary" className="ml-auto">
                      {telegramUsers.length}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {telegramUsers.map((u) => (
                      <div
                        key={u.id}
                        className="flex items-center justify-between gap-4 p-3 rounded-lg border border-border"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {u.name || u.email}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {u.email}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {u.telegramUsername && (
                            <span className="text-sm text-muted-foreground">
                              @{u.telegramUsername}
                            </span>
                          )}
                          {u.telegramChatId ? (
                            <Badge variant="default" className="bg-green-600 text-[10px]">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              {t("telegram_linked")}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-orange-400 border-orange-400/50 text-[10px]">
                              {t("telegram_pending")}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Compose Reply/Forward Dialog */}
      {composeMode && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-lg shadow-lg w-full max-w-xl space-y-4 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {composeMode === "reply" ? t("email_reply") : t("email_forward")}
              </h3>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setComposeMode(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-muted-foreground">{t("email_to")}</label>
                <input
                  type="email"
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  className="w-full mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">{t("email_subject")}</label>
                <input
                  type="text"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  className="w-full mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <textarea
                  value={composeBody}
                  onChange={(e) => setComposeBody(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[200px] font-mono"
                  placeholder={t("email_compose_placeholder")}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setComposeMode(null)}
                >
                  {tCommon("cancel")}
                </Button>
                <Button
                  onClick={handleSendEmail}
                  disabled={sending || !composeTo || !composeSubject}
                >
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  {sending ? tCommon("loading") : t("email_send")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Small helper for platform status badges */
function PlatformStatusBadge({ status, t }: { status: string; t: (key: string) => string }) {
  switch (status) {
    case "connected":
      return (
        <Badge variant="default" className="text-[10px] gap-1">
          <CheckCircle2 className="h-3 w-3" />
          {t("status_connected")}
        </Badge>
      );
    case "blocked":
      return (
        <Badge variant="destructive" className="text-[10px] gap-1">
          <XCircle className="h-3 w-3" />
          {t("status_blocked")}
        </Badge>
      );
    case "unreachable":
      return (
        <Badge variant="destructive" className="text-[10px] gap-1">
          <AlertTriangle className="h-3 w-3" />
          {t("status_unreachable")}
        </Badge>
      );
    case "checking":
      return (
        <Badge variant="secondary" className="text-[10px] gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          {t("status_checking")}
        </Badge>
      );
    case "error":
      return (
        <Badge variant="outline" className="text-[10px] gap-1 text-red-400">
          <XCircle className="h-3 w-3" />
          {t("status_error")}
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-[10px]">
          {status}
        </Badge>
      );
  }
}

/** Reliability tier badge */
function ReliabilityBadge({
  reliability,
  t,
}: {
  reliability: "reliable" | "moderate" | "unreliable" | "defunct";
  t: (key: string) => string;
}) {
  switch (reliability) {
    case "reliable":
      return (
        <Badge variant="default" className="text-[10px] px-1.5 py-0 bg-green-600">
          {t("reliability_reliable")}
        </Badge>
      );
    case "moderate":
      return (
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
          {t("reliability_moderate")}
        </Badge>
      );
    case "unreliable":
      return (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-orange-400 border-orange-400/50">
          {t("reliability_unreliable")}
        </Badge>
      );
    case "defunct":
      return (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-red-400 border-red-400/50">
          {t("reliability_defunct")}
        </Badge>
      );
  }
}
