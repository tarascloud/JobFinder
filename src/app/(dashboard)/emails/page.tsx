"use client";

import { useState, useEffect, useTransition } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  Mail,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Calendar,
  ExternalLink,
  LinkIcon,
  ChevronDown,
  ChevronUp,
  Reply,
  Forward,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getEmailResponses, linkEmailToApplication, markEmailAsRead, sendUserEmail, deleteUserEmail } from "@/actions/emails";
import { getApplications } from "@/actions/applications";

interface EmailResponse {
  id: number;
  fromEmail: string;
  subject: string;
  body: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  messageId: string | null;
  responseType: string;
  matched: boolean;
  read: boolean;
  applicationId: number | null;
  receivedAt: Date;
  vacancyTitle?: string | null;
  vacancyCompany?: string | null;
}

interface ApplicationOption {
  id: number;
  vacancy: {
    id: number;
    title: string;
    company: string | null;
  };
}

const typeColors: Record<string, "green" | "red" | "blue" | "yellow" | "purple"> = {
  interview: "green",
  positive: "blue",
  rejection: "red",
  info: "yellow",
};

const typeIcons: Record<string, typeof CheckCircle2> = {
  interview: Calendar,
  positive: CheckCircle2,
  rejection: XCircle,
  info: AlertCircle,
};

function linkifyBody(text: string) {
  const urlRegex = /(https?:\/\/[^\s<>"')\]]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) => {
    if (urlRegex.test(part)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="nofollow noopener"
          className="text-primary hover:underline break-all"
        >
          {part}
        </a>
      );
    }
    // Reset regex lastIndex since we reuse it
    urlRegex.lastIndex = 0;
    return part;
  });
}

export default function EmailsPage() {
  const t = useTranslations("emails");
  const [activeTab, setActiveTab] = useState("all");
  const [emails, setEmails] = useState<EmailResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [linkingId, setLinkingId] = useState<number | null>(null);
  const [applications, setApplications] = useState<ApplicationOption[]>([]);
  const [expandedEmail, setExpandedEmail] = useState<number | null>(null);
  const [composeMode, setComposeMode] = useState<"reply" | "forward" | null>(null);
  const [composeEmailRef, setComposeEmailRef] = useState<EmailResponse | null>(null);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    loadEmails();
  }, [activeTab]);

  async function loadEmails() {
    startTransition(async () => {
      const matchedFilter =
        activeTab === "matched" ? true : activeTab === "unmatched" ? false : undefined;
      const result = await getEmailResponses({ matched: matchedFilter });
      if ("emails" in result) {
        setEmails(result.emails ?? []);
        setTotal(result.total ?? 0);
      }
    });
  }

  async function toggleExpand(email: EmailResponse) {
    if (expandedEmail === email.id) {
      setExpandedEmail(null);
      return;
    }
    setExpandedEmail(email.id);
    // Mark as read on expand
    if (!email.read) {
      const result = await markEmailAsRead(email.id);
      if (result && "success" in result) {
        setEmails((prev) =>
          prev.map((e) => (e.id === email.id ? { ...e, read: true } : e))
        );
      }
    }
  }

  async function handleDelete(emailId: number) {
    if (!confirm(t("delete_confirm"))) return;
    const result = await deleteUserEmail(emailId);
    if (result && "success" in result) {
      setEmails((prev) => prev.filter((e) => e.id !== emailId));
      setTotal((prev) => prev - 1);
      if (expandedEmail === emailId) setExpandedEmail(null);
    }
  }

  async function openLinkDialog(emailId: number) {
    setLinkingId(emailId);
    const result = await getApplications({ limit: 50 });
    if ("applications" in result && result.applications) {
      setApplications(
        result.applications.map((a: ApplicationOption) => ({
          id: a.id,
          vacancy: a.vacancy,
        }))
      );
    }
  }

  async function handleLink(emailId: number, applicationId: number) {
    const result = await linkEmailToApplication(emailId, applicationId);
    if ("success" in result) {
      setLinkingId(null);
      await loadEmails();
    }
  }

  function handleReply(email: EmailResponse) {
    setComposeMode("reply");
    setComposeEmailRef(email);
    setComposeTo(email.fromEmail);
    setComposeSubject(email.subject.startsWith("Re:") ? email.subject : `Re: ${email.subject}`);
    setComposeBody("");
  }

  function handleForward(email: EmailResponse) {
    setComposeMode("forward");
    setComposeEmailRef(email);
    setComposeTo("");
    setComposeSubject(email.subject.startsWith("Fwd:") ? email.subject : `Fwd: ${email.subject}`);
    const fwdBody = email.bodyText || email.body || "";
    setComposeBody(`\n\n---------- Forwarded message ----------\nFrom: ${email.fromEmail}\nSubject: ${email.subject}\nDate: ${new Date(email.receivedAt).toLocaleString()}\n\n${fwdBody.substring(0, 5000)}`);
  }

  async function handleSendEmail() {
    if (!composeTo || !composeSubject) return;
    setSending(true);
    try {
      const result = await sendUserEmail({
        to: composeTo,
        subject: composeSubject,
        body: composeBody,
        inReplyTo: composeMode === "reply" ? composeEmailRef?.messageId || undefined : undefined,
      });
      if (result && "error" in result) {
        // silent
      } else {
        setComposeMode(null);
        setComposeEmailRef(null);
        setComposeTo("");
        setComposeSubject("");
        setComposeBody("");
      }
    } catch {
      // silent
    }
    setSending(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("title")}</h1>
        <span className="text-sm text-muted-foreground">
          {total} {t("total")}
        </span>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">{t("tab_all")}</TabsTrigger>
          <TabsTrigger value="matched">{t("tab_matched")}</TabsTrigger>
          <TabsTrigger value="unmatched">{t("tab_unmatched")}</TabsTrigger>
        </TabsList>

        {["all", "matched", "unmatched"].map((tab) => (
          <TabsContent key={tab} value={tab}>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  {t("title")}
                  {emails.length > 0 && (
                    <Badge variant="secondary" className="ml-auto">
                      {emails.length}
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {emails.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("no_emails")}</p>
                ) : (
                  <div className="space-y-2">
                    {emails.map((email) => {
                      const TypeIcon = typeIcons[email.responseType] || AlertCircle;
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
                            onClick={() => toggleExpand(email)}
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
                              <Badge color={typeColors[email.responseType] || "yellow"}>
                                <TypeIcon className="h-3 w-3 mr-1 inline" />
                                {t(`type_${email.responseType}`)}
                              </Badge>
                              {email.matched && email.applicationId && (
                                <Badge variant="outline" className="text-[10px]">
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  {email.vacancyTitle || email.vacancyCompany || t("linked")}
                                </Badge>
                              )}
                              <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {new Date(email.receivedAt).toLocaleDateString()}
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
                                  <span className="font-medium">{t("from")}:</span>{" "}
                                  {email.fromEmail}
                                </div>
                                <div>
                                  <span className="font-medium">{t("date")}:</span>{" "}
                                  {new Date(email.receivedAt).toLocaleString()}
                                </div>
                              </div>
                              {email.bodyHtml ? (
                                <div
                                  className="bg-muted/50 rounded-md p-3 text-sm max-h-96 overflow-y-auto prose prose-sm prose-invert max-w-none"
                                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(email.bodyHtml) }}
                                />
                              ) : email.bodyText ? (
                                <div className="bg-muted/50 rounded-md p-3 text-sm whitespace-pre-wrap max-h-64 overflow-y-auto font-mono text-xs">
                                  {linkifyBody(email.bodyText)}
                                </div>
                              ) : (
                                <div className="bg-muted/50 rounded-md p-3 text-sm whitespace-pre-wrap max-h-64 overflow-y-auto font-mono text-xs">
                                  {email.body ? linkifyBody(email.body) : t("empty_body")}
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleReply(email);
                                  }}
                                >
                                  <Reply className="h-3.5 w-3.5 mr-1.5" />
                                  {t("reply")}
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
                                  {t("forward")}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-400 hover:text-red-300 ml-auto"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(email.id);
                                  }}
                                >
                                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                                  {t("delete")}
                                </Button>
                              </div>
                              <div className="flex items-center gap-2">
                                {email.matched && email.applicationId ? (
                                  <Link
                                    href={`/vacancies/${email.applicationId}`}
                                    className="text-sm text-primary hover:text-primary/80 flex items-center gap-1"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    {t("view_application")}
                                  </Link>
                                ) : (
                                  <Dialog
                                    open={linkingId === email.id}
                                    onOpenChange={(open) => !open && setLinkingId(null)}
                                  >
                                    <DialogTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openLinkDialog(email.id);
                                        }}
                                      >
                                        <LinkIcon className="h-3 w-3 mr-1" />
                                        {t("link")}
                                      </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                      <DialogHeader>
                                        <DialogTitle>{t("link_to_application")}</DialogTitle>
                                      </DialogHeader>
                                      <div className="space-y-2 max-h-80 overflow-y-auto">
                                        {applications.map((app) => (
                                          <button
                                            key={app.id}
                                            onClick={() => handleLink(email.id, app.id)}
                                            className="w-full text-left p-3 rounded-lg border border-border hover:border-primary hover:bg-muted/50 transition-colors"
                                          >
                                            <div className="font-medium text-sm text-foreground">
                                              {app.vacancy.title}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                              {app.vacancy.company}
                                            </div>
                                          </button>
                                        ))}
                                        {applications.length === 0 && (
                                          <p className="text-muted-foreground text-sm text-center py-4">
                                            {t("no_applications")}
                                          </p>
                                        )}
                                      </div>
                                    </DialogContent>
                                  </Dialog>
                                )}
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
        ))}
      </Tabs>

      {/* Compose Reply/Forward Dialog */}
      {composeMode && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background border border-border rounded-lg shadow-lg w-full max-w-xl space-y-4 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                {composeMode === "reply" ? t("reply") : t("forward")}
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
                <label className="text-sm text-muted-foreground">{t("to")}</label>
                <input
                  type="email"
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  className="w-full mt-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
                  placeholder="email@example.com"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground">{t("subject")}</label>
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
                  placeholder={t("compose_placeholder")}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setComposeMode(null)}
                >
                  {t("cancel")}
                </Button>
                <Button
                  onClick={handleSendEmail}
                  disabled={sending || !composeTo || !composeSubject}
                >
                  <Send className="h-3.5 w-3.5 mr-1.5" />
                  {sending ? t("sending") : t("send")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
