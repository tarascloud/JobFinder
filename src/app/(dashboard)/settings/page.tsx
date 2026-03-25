"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { getGuests, inviteGuest, revokeInvite, removeUser } from "@/actions/guests";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Trash2, Mail, Users } from "lucide-react";
import SettingsTabs from "./settings-tabs";

export default function SettingsPage() {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [invites, setInvites] = useState<{ email: string; invitedBy: string; createdAt: Date }[]>([]);
  const [users, setUsers] = useState<{ id: number; email: string; name: string | null; role: string; createdAt: Date }[]>([]);

  const load = useCallback(async () => {
    const data = await getGuests();
    if ("error" in data) return;
    setInvites(data.invites ?? []);
    setUsers(data.users ?? []);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await inviteGuest(email);
    if ("error" in result && result.error) setError(result.error);
    else { setEmail(""); await load(); }
    setLoading(false);
  }

  async function handleRevoke(email: string) {
    await revokeInvite(email);
    await load();
  }

  async function handleRemove(userId: number) {
    if (!confirm(t("remove_confirm"))) return;
    await removeUser(userId);
    await load();
  }

  return (
    <div className="space-y-6">
      <SettingsTabs active="users" />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5" />
            {t("invite_users")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("invite_description")}
          </p>
          <form onSubmit={handleInvite} className="flex gap-2">
            <Input
              type="email"
              placeholder={t("invite_email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1"
              required
            />
            <Button type="submit" disabled={loading}>
              <Mail className="h-4 w-4 mr-1" />
              {loading ? tCommon("loading") : t("invite_button")}
            </Button>
          </form>
          {error && <p className="text-sm text-red-400">{error}</p>}

          {invites.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-foreground/80">{t("pending_invites")}</h3>
              {invites.map((inv) => (
                <div key={inv.email} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div>
                    <p className="text-sm">{inv.email}</p>
                    <p className="text-xs text-muted-foreground">{inv.invitedBy}</p>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => handleRevoke(inv.email)}>
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t("users")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("no_users")}</p>
          ) : (
            <div className="space-y-2">
              {users.map((u) => (
                <div key={u.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="text-sm font-medium">{u.name || u.email}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                    <Badge>{u.role}</Badge>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => handleRemove(u.id)}>
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
