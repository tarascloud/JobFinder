"use client";

import { useTranslations } from "next-intl";
import {
  Bot,
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Link2,
  Unlink,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface TelegramStatus {
  configured: boolean;
  connected: boolean;
  botUsername: string | null;
  webhookUrl: string | null;
  connectedUsers: number;
}

interface TelegramUser {
  id: number;
  email: string;
  name: string | null;
  telegramUsername: string | null;
  telegramChatId: string | null;
}

interface AdminTelegramTabProps {
  telegramStatus: TelegramStatus | null;
  telegramLoading: boolean;
  telegramUsers: TelegramUser[];
  webhookSetupLoading: boolean;
  onSetupWebhook: () => void;
  onRemoveWebhook: () => void;
  onRefresh: () => void;
}

export function AdminTelegramTab({
  telegramStatus,
  telegramLoading,
  telegramUsers,
  webhookSetupLoading,
  onSetupWebhook,
  onRemoveWebhook,
  onRefresh,
}: AdminTelegramTabProps) {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");

  return (
    <div className="space-y-4">
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
                    <CheckCircle2 className="h-3 w-3 mr-1" />{t("telegram_configured")}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-red-400 border-red-400/50">
                    <XCircle className="h-3 w-3 mr-1" />{t("telegram_not_configured")}
                  </Badge>
                )}
              </div>

              {telegramStatus.configured && (
                <>
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-muted-foreground">{t("telegram_connection")}:</span>
                    {telegramStatus.connected ? (
                      <Badge variant="default" className="bg-green-600">
                        <CheckCircle2 className="h-3 w-3 mr-1" />{t("status_connected")}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-red-400 border-red-400/50">
                        <XCircle className="h-3 w-3 mr-1" />{t("telegram_disconnected")}
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
                          <Link2 className="h-3 w-3 mr-1" />{t("telegram_webhook_active")}
                        </Badge>
                        <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                          {telegramStatus.webhookUrl}
                        </code>
                        <Button size="sm" variant="outline" onClick={onRemoveWebhook} disabled={webhookSetupLoading}>
                          {webhookSetupLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Unlink className="h-3 w-3 mr-1" />}
                          {t("telegram_remove_webhook")}
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-orange-400 border-orange-400/50">
                          <AlertTriangle className="h-3 w-3 mr-1" />{t("telegram_no_webhook")}
                        </Badge>
                        <Button size="sm" variant="default" onClick={onSetupWebhook} disabled={webhookSetupLoading}>
                          {webhookSetupLoading ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Link2 className="h-3 w-3 mr-1" />}
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
                <p className="text-sm text-muted-foreground">{t("telegram_setup_hint")}</p>
              )}

              <Button size="sm" variant="outline" onClick={onRefresh} disabled={telegramLoading}>
                <RefreshCw className={`h-3 w-3 mr-1 ${telegramLoading ? "animate-spin" : ""}`} />
                {t("telegram_refresh")}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {telegramUsers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              {t("telegram_users_title")}
              <Badge variant="secondary" className="ml-auto">{telegramUsers.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {telegramUsers.map((u) => (
                <div key={u.id} className="flex items-center justify-between gap-4 p-3 rounded-lg border border-border">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{u.name || u.email}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {u.telegramUsername && (
                      <span className="text-sm text-muted-foreground">@{u.telegramUsername}</span>
                    )}
                    {u.telegramChatId ? (
                      <Badge variant="default" className="bg-green-600 text-[10px]">
                        <CheckCircle2 className="h-3 w-3 mr-1" />{t("telegram_linked")}
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
  );
}
