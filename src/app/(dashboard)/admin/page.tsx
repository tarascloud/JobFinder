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
import { type PlatformStatus, type PlatformMeta } from "@/lib/platforms";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Users, BarChart3, Globe, Mail, MessageCircle } from "lucide-react";
import { AdminUsersTab } from "./admin-users-tab";
import { AdminEmailsTab } from "./admin-emails-tab";
import { AdminPlatformsTab } from "./admin-platforms-tab";
import { AdminTelegramTab } from "./admin-telegram-tab";
import type { UserRow, UserStatsData, AdminEmailRow } from "./types";

type ALL_PLATFORMS = string;

type PlatformCheckResult = PlatformStatus & {
  checking?: boolean;
  vacancyCount?: number;
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

  // Platforms state
  const [platformStatuses, setPlatformStatuses] = useState<Record<string, PlatformCheckResult>>({});
  const [platformMeta, setPlatformMeta] = useState<Record<string, PlatformMeta>>({});
  const [enabledPlatforms, setEnabledPlatforms] = useState<Record<string, boolean>>({});
  const [platformsLoading, setPlatformsLoading] = useState(false);
  const [platformsCheckingAll, setPlatformsCheckingAll] = useState(false);
  const [serviceEmail, setServiceEmail] = useState("");
  const [servicePassword, setServicePassword] = useState("");
  const [credentialsLoading, setCredentialsLoading] = useState(false);
  const [credentialsSaved, setCredentialsSaved] = useState(false);

  // Emails state
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

  // Telegram state
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
    getAdminEmailUnreadCount()
      .then((data) => { if ("count" in data) setUnreadCount(data.count); })
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
      if (creds) { setServiceEmail(creds.email); setServicePassword(creds.password); }
      if (meta) setPlatformMeta(meta);
      if (enabled) setEnabledPlatforms(enabled);
    } catch { /* silently fail */ }
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
    } catch { /* silently fail */ }
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
        [platform]: { platform, status: result.status, lastCheck: new Date().toISOString(), message: result.message, vacancyCount: result.vacancyCount, checking: false },
      }));
    } catch {
      setPlatformStatuses((prev) => ({
        ...prev,
        [platform]: { platform, status: "error", lastCheck: new Date().toISOString(), message: "Check failed", checking: false },
      }));
    }
  }

  async function handleCheckAllPlatforms() {
    const { ALL_PLATFORMS: all } = await import("@/lib/platforms");
    setPlatformsCheckingAll(true);
    const initial: Record<string, PlatformCheckResult> = {};
    for (const p of all) {
      initial[p] = { platform: p, status: "checking", lastCheck: null, message: "", checking: true };
    }
    setPlatformStatuses(initial);
    try {
      const results = await getAllPlatformStatuses();
      const updated: Record<string, PlatformCheckResult> = {};
      for (const r of results) updated[r.platform] = { ...r, checking: false };
      setPlatformStatuses(updated);
    } catch { /* silently fail */ }
    setPlatformsCheckingAll(false);
  }

  async function loadAdminEmails(category?: string) {
    setAdminEmailsLoading(true);
    try {
      const data = await getAdminEmails({ category: category || emailFilter });
      if ("emails" in data) setAdminEmails(data.emails as AdminEmailRow[]);
      const countData = await getAdminEmailUnreadCount();
      if ("count" in countData) setUnreadCount(countData.count);
    } catch { /* silently fail */ }
    setAdminEmailsLoading(false);
  }

  async function handleMarkRead(emailId: number) {
    try {
      await markAdminEmailAsRead(emailId);
      setAdminEmails((prev) => prev.map((e) => (e.id === emailId ? { ...e, read: true } : e)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch { /* silently fail */ }
  }

  async function handleRoleChange(userId: number, newRole: string) {
    const result = await changeUserRole(userId, newRole);
    if (result && "error" in result) { setError(result.error ?? ""); } else { await load(); }
  }

  async function handleRemove(userId: number) {
    if (!confirm(t("remove_confirm"))) return;
    const result = await removeUser(userId);
    if (result && "error" in result) { setError(result.error ?? ""); } else { await load(); }
  }

  async function handleLimitChange(userId: number, value: string) {
    const num = parseInt(value, 10);
    if (isNaN(num) || num < 1 || num > 100) return;
    const result = await updateApplicationLimit(userId, num);
    if (result && "error" in result) {
      setError(result.error ?? "");
    } else {
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, applicationLimit: num } : u));
    }
  }

  async function toggleUserStats(userId: number) {
    if (expandedUser === userId) { setExpandedUser(null); return; }
    setExpandedUser(userId);
    if (!userStats[userId]) {
      setStatsLoading(userId);
      try {
        const stats = await getUserStats(userId);
        setUserStats((prev) => ({ ...prev, [userId]: stats }));
      } catch { /* silently fail */ }
      setStatsLoading(null);
    }
  }

  async function handleDeleteAdminEmail(emailId: number) {
    if (!confirm(t("email_delete_confirm"))) return;
    try {
      await deleteAdminEmail(emailId);
      setAdminEmails((prev) => prev.filter((e) => e.id !== emailId));
      if (expandedEmail === emailId) setExpandedEmail(null);
    } catch { /* silently fail */ }
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
      const [status, users] = await Promise.all([getTelegramBotStatus(), getTelegramConnectedUsers()]);
      setTelegramStatus(status);
      setTelegramUsers(users.users);
    } catch { /* silently fail */ }
    setTelegramLoading(false);
  }

  async function handleSetupWebhook() {
    setWebhookSetupLoading(true);
    try {
      const result = await setupTelegramWebhook();
      if (result.ok) { await loadTelegramData(); } else { setError(result.error || "Failed to setup webhook"); }
    } catch { setError("Failed to setup webhook"); }
    setWebhookSetupLoading(false);
  }

  async function handleRemoveWebhook() {
    setWebhookSetupLoading(true);
    try {
      await removeTelegramWebhook();
      await loadTelegramData();
    } catch { setError("Failed to remove webhook"); }
    setWebhookSetupLoading(false);
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
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("description")}</p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">
            <Users className="h-4 w-4 mr-1.5" />
            {t("tab_users")}
          </TabsTrigger>
          <TabsTrigger value="platforms" onClick={() => { if (!serviceEmail && !platformsLoading) loadPlatformData(); }}>
            <Globe className="h-4 w-4 mr-1.5" />
            {t("tab_platforms")}
          </TabsTrigger>
          <TabsTrigger value="admin-emails" onClick={() => { if (adminEmails.length === 0) loadAdminEmails(); }}>
            <Mail className="h-4 w-4 mr-1.5" />
            {t("tab_emails")}
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-1.5 text-[10px] px-1.5 py-0">{unreadCount}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="telegram" onClick={() => { if (!telegramStatus && !telegramLoading) loadTelegramData(); }}>
            <MessageCircle className="h-4 w-4 mr-1.5" />
            {t("tab_telegram")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <AdminUsersTab
            users={users}
            expandedUser={expandedUser}
            userStats={userStats}
            statsLoading={statsLoading}
            onRoleChange={handleRoleChange}
            onRemove={handleRemove}
            onLimitChange={handleLimitChange}
            onToggleStats={toggleUserStats}
            setUsers={setUsers}
          />
        </TabsContent>

        <TabsContent value="platforms">
          <AdminPlatformsTab
            platformsLoading={platformsLoading}
            platformsCheckingAll={platformsCheckingAll}
            serviceEmail={serviceEmail}
            servicePassword={servicePassword}
            credentialsLoading={credentialsLoading}
            credentialsSaved={credentialsSaved}
            platformStatuses={platformStatuses}
            platformMeta={platformMeta}
            enabledPlatforms={enabledPlatforms}
            onServiceEmailChange={setServiceEmail}
            onServicePasswordChange={setServicePassword}
            onSaveCredentials={handleSaveCredentials}
            onCheckPlatform={handleCheckPlatform}
            onCheckAllPlatforms={handleCheckAllPlatforms}
            onTogglePlatform={(platform, newVal) => {
              setEnabledPlatforms((prev) => ({ ...prev, [platform]: newVal }));
              togglePlatform(platform, newVal);
            }}
          />
        </TabsContent>

        <TabsContent value="admin-emails">
          <AdminEmailsTab
            adminEmails={adminEmails}
            adminEmailsLoading={adminEmailsLoading}
            emailFilter={emailFilter}
            expandedEmail={expandedEmail}
            unreadCount={unreadCount}
            composeMode={composeMode}
            composeTo={composeTo}
            composeSubject={composeSubject}
            composeBody={composeBody}
            sending={sending}
            onFilterChange={(cat) => { setEmailFilter(cat); loadAdminEmails(cat); }}
            onExpandEmail={setExpandedEmail}
            onMarkRead={handleMarkRead}
            onReply={handleReply}
            onForward={handleForward}
            onDelete={handleDeleteAdminEmail}
            onComposeTo={setComposeTo}
            onComposeSubject={setComposeSubject}
            onComposeBody={setComposeBody}
            onSend={handleSendEmail}
            onCancelCompose={() => setComposeMode(null)}
          />
        </TabsContent>

        <TabsContent value="telegram">
          <AdminTelegramTab
            telegramStatus={telegramStatus}
            telegramLoading={telegramLoading}
            telegramUsers={telegramUsers}
            webhookSetupLoading={webhookSetupLoading}
            onSetupWebhook={handleSetupWebhook}
            onRemoveWebhook={handleRemoveWebhook}
            onRefresh={loadTelegramData}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
