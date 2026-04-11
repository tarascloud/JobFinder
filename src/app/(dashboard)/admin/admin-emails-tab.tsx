"use client";

import { useTranslations } from "next-intl";
import {
  Mail,
  Eye,
  Reply,
  Forward,
  Trash2,
  ChevronDown,
  ChevronUp,
  Send,
  X,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { sanitizeHtml } from "@/lib/sanitize-html";
import type { AdminEmailRow } from "./types";

interface AdminEmailsTabProps {
  adminEmails: AdminEmailRow[];
  adminEmailsLoading: boolean;
  emailFilter: string;
  expandedEmail: number | null;
  unreadCount: number;
  composeMode: "reply" | "forward" | null;
  composeTo: string;
  composeSubject: string;
  composeBody: string;
  sending: boolean;
  onFilterChange: (cat: string) => void;
  onExpandEmail: (id: number | null) => void;
  onMarkRead: (id: number) => void;
  onReply: (email: AdminEmailRow) => void;
  onForward: (email: AdminEmailRow) => void;
  onDelete: (id: number) => void;
  onComposeTo: (v: string) => void;
  onComposeSubject: (v: string) => void;
  onComposeBody: (v: string) => void;
  onSend: () => void;
  onCancelCompose: () => void;
}

const EMAIL_CATEGORIES = ["all", "registration", "confirmation", "notification", "other"] as const;

export function AdminEmailsTab({
  adminEmails,
  adminEmailsLoading,
  emailFilter,
  expandedEmail,
  composeMode,
  composeTo,
  composeSubject,
  composeBody,
  sending,
  onFilterChange,
  onExpandEmail,
  onMarkRead,
  onReply,
  onForward,
  onDelete,
  onComposeTo,
  onComposeSubject,
  onComposeBody,
  onSend,
  onCancelCompose,
}: AdminEmailsTabProps) {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {t("emails_title")}
            {adminEmails.length > 0 && (
              <Badge variant="secondary" className="ml-auto">{adminEmails.length}</Badge>
            )}
          </CardTitle>
          <div className="flex gap-2 mt-3 flex-wrap">
            {EMAIL_CATEGORIES.map((cat) => (
              <Button
                key={cat}
                size="sm"
                variant={emailFilter === cat ? "default" : "outline"}
                onClick={() => onFilterChange(cat)}
              >
                {t(`email_filter_${cat}`)}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {adminEmailsLoading ? (
            <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
          ) : adminEmails.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("no_admin_emails")}</p>
          ) : (
            <div className="space-y-2">
              {adminEmails.map((email) => {
                const isExpanded = expandedEmail === email.id;
                return (
                  <div
                    key={email.id}
                    className={`rounded-lg border ${
                      email.read ? "border-border" : "border-primary/30 bg-primary/5"
                    }`}
                  >
                    <button
                      type="button"
                      className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors cursor-pointer text-left"
                      onClick={() => onExpandEmail(isExpanded ? null : email.id)}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className={`text-sm truncate ${email.read ? "text-muted-foreground" : "font-semibold"}`}>
                            {email.subject}
                          </p>
                          {!email.read && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{email.fromEmail}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {email.platform && (
                          <Badge variant="outline" className="text-[10px] capitalize">{email.platform}</Badge>
                        )}
                        <Badge variant="secondary" className="text-[10px]">
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
                          <div><span className="font-medium">{t("email_from")}:</span> {email.fromEmail}</div>
                          <div><span className="font-medium">{t("email_date")}:</span> {new Date(email.createdAt).toLocaleString()}</div>
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
                            <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onMarkRead(email.id); }}>
                              <Eye className="h-3.5 w-3.5 mr-1.5" />
                              {t("email_mark_read")}
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onReply(email); }}>
                            <Reply className="h-3.5 w-3.5 mr-1.5" />
                            {t("email_reply")}
                          </Button>
                          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onForward(email); }}>
                            <Forward className="h-3.5 w-3.5 mr-1.5" />
                            {t("email_forward")}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-400 hover:text-red-300 ml-auto"
                            onClick={(e) => { e.stopPropagation(); onDelete(email.id); }}
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

      {/* Compose Dialog */}
      {composeMode && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-lg shadow-lg w-full max-w-xl space-y-4 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {composeMode === "reply" ? t("email_reply") : t("email_forward")}
              </h3>
              <Button size="icon" variant="ghost" onClick={onCancelCompose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-muted-foreground">{t("email_to")}</label>
                <input
                  type="email"
                  value={composeTo}
                  onChange={(e) => onComposeTo(e.target.value)}
                  className="w-full mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">{t("email_subject")}</label>
                <input
                  type="text"
                  value={composeSubject}
                  onChange={(e) => onComposeSubject(e.target.value)}
                  className="w-full mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <textarea
                  value={composeBody}
                  onChange={(e) => onComposeBody(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[200px] font-mono"
                  placeholder={t("email_compose_placeholder")}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onCancelCompose}>{tCommon("cancel")}</Button>
                <Button onClick={onSend} disabled={sending || !composeTo || !composeSubject}>
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  {sending ? tCommon("loading") : t("email_send")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
