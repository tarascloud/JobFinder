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
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
import { getEmailResponses, linkEmailToApplication } from "@/actions/emails";
import { getApplications } from "@/actions/applications";

interface EmailResponse {
  id: number;
  fromEmail: string;
  subject: string;
  body: string | null;
  responseType: string;
  matched: boolean;
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

export default function EmailsPage() {
  const t = useTranslations("emails");
  const [activeTab, setActiveTab] = useState("all");
  const [emails, setEmails] = useState<EmailResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [linkingId, setLinkingId] = useState<number | null>(null);
  const [applications, setApplications] = useState<ApplicationOption[]>([]);

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

  function formatDate(date: Date) {
    return new Date(date).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
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
            {emails.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Mail className="h-12 w-12 text-muted-foreground/60 mx-auto mb-3" />
                  <p className="text-muted-foreground text-lg">{t("no_emails")}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {/* Desktop header */}
                <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  <div className="col-span-1">{t("type")}</div>
                  <div className="col-span-3">{t("from")}</div>
                  <div className="col-span-4">{t("subject")}</div>
                  <div className="col-span-2">{t("matched_to")}</div>
                  <div className="col-span-2 text-right">{t("date")}</div>
                </div>

                {emails.map((email) => {
                  const TypeIcon = typeIcons[email.responseType] || AlertCircle;
                  return (
                    <Card key={email.id} className="hover:border-border transition-colors">
                      <CardContent className="p-4">
                        <div className="md:grid md:grid-cols-12 md:gap-4 md:items-center space-y-2 md:space-y-0">
                          {/* Type badge */}
                          <div className="col-span-1">
                            <Badge color={typeColors[email.responseType] || "yellow"}>
                              <TypeIcon className="h-3 w-3 mr-1 inline" />
                              {t(`type_${email.responseType}`)}
                            </Badge>
                          </div>

                          {/* From */}
                          <div className="col-span-3">
                            <span className="text-sm text-foreground/80 truncate block">
                              {email.fromEmail}
                            </span>
                          </div>

                          {/* Subject */}
                          <div className="col-span-4">
                            <span className="text-sm text-foreground truncate block">
                              {email.subject}
                            </span>
                          </div>

                          {/* Matched application */}
                          <div className="col-span-2">
                            {email.matched && email.applicationId ? (
                              <Link
                                href={`/vacancies/${email.applicationId}`}
                                className="text-sm text-primary hover:text-primary/80 flex items-center gap-1"
                              >
                                <ExternalLink className="h-3 w-3" />
                                {email.vacancyTitle || email.vacancyCompany || t("linked")}
                              </Link>
                            ) : (
                              <Dialog
                                open={linkingId === email.id}
                                onOpenChange={(open) => !open && setLinkingId(null)}
                              >
                                <DialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openLinkDialog(email.id)}
                                    className="text-muted-foreground hover:text-foreground"
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

                          {/* Date */}
                          <div className="col-span-2 text-right">
                            <span className="text-sm text-muted-foreground">
                              {formatDate(email.receivedAt)}
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
