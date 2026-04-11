"use client";

import { useTranslations } from "next-intl";
import { Trash2, Users, BarChart3, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectOption } from "@/components/ui/select";
import type { UserRow, UserStatsData } from "./types";

function roleBadgeVariant(role: string) {
  switch (role) {
    case "owner": return "default" as const;
    case "user": return "secondary" as const;
    default: return "outline" as const;
  }
}

interface AdminUsersTabProps {
  users: UserRow[];
  expandedUser: number | null;
  userStats: Record<number, UserStatsData>;
  statsLoading: number | null;
  onRoleChange: (userId: number, newRole: string) => void;
  onRemove: (userId: number) => void;
  onLimitChange: (userId: number, value: string) => void;
  onToggleStats: (userId: number) => void;
  setUsers: React.Dispatch<React.SetStateAction<UserRow[]>>;
}

export function AdminUsersTab({
  users,
  expandedUser,
  userStats,
  statsLoading,
  onRoleChange,
  onRemove,
  onLimitChange,
  onToggleStats,
  setUsers,
}: AdminUsersTabProps) {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");

  return (
    <div className="space-y-4">
      {/* Users list */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t("all_users")}
            <Badge variant="secondary" className="ml-auto">{users.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("no_users")}</p>
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
                      <p className="text-sm font-medium truncate">{u.name || u.email}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={roleBadgeVariant(u.role)}>{u.role}</Badge>
                    <Select
                      value={u.role}
                      onChange={(e) => onRoleChange(u.id, e.target.value)}
                      className="w-24"
                    >
                      <SelectOption value="owner">{t("role_owner")}</SelectOption>
                      <SelectOption value="user">{t("role_user")}</SelectOption>
                      <SelectOption value="guest">{t("role_guest")}</SelectOption>
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
                        onBlur={(e) => onLimitChange(u.id, e.target.value)}
                        className="w-14 rounded-md border border-border bg-background px-2 py-1 text-sm text-center"
                      />
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onRemove(u.id)}
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

      {/* Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            {t("user_stats_title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("no_users")}</p>
          ) : (
            <div className="space-y-2">
              {users.map((u) => {
                const isExpanded = expandedUser === u.id;
                const stats = userStats[u.id];
                const isLoading = statsLoading === u.id;
                return (
                  <div key={u.id} className="rounded-lg border border-border">
                    <button
                      type="button"
                      className="w-full flex items-center justify-between gap-4 p-3 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => onToggleStats(u.id)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-sm font-medium text-primary-foreground shrink-0">
                          {(u.name || u.email).charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 text-left">
                          <p className="text-sm font-medium truncate">{u.name || u.email}</p>
                          <p className="text-xs text-muted-foreground truncate">{u.email}</p>
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
                          <p className="text-sm text-muted-foreground">{tCommon("loading")}</p>
                        ) : stats ? (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div className="rounded-md bg-muted/50 p-2.5">
                              <p className="text-xs text-muted-foreground">{t("stat_vacancies")}</p>
                              <p className="text-lg font-semibold">{stats.vacancyCount}</p>
                            </div>
                            <div className="rounded-md bg-muted/50 p-2.5">
                              <p className="text-xs text-muted-foreground">{t("stat_applications")}</p>
                              <p className="text-lg font-semibold">{stats.totalApplications}</p>
                              {Object.keys(stats.applicationsByStatus).length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {Object.entries(stats.applicationsByStatus).map(([status, count]) => (
                                    <Badge key={status} variant="outline" className="text-[10px] px-1.5 py-0">
                                      {status}: {count}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="rounded-md bg-muted/50 p-2.5">
                              <p className="text-xs text-muted-foreground">{t("stat_search_profiles")}</p>
                              <p className="text-lg font-semibold">{stats.searchProfileCount}</p>
                            </div>
                            <div className="rounded-md bg-muted/50 p-2.5">
                              <p className="text-xs text-muted-foreground">{t("stat_last_active")}</p>
                              <p className="text-sm font-medium">
                                {stats.lastActiveAt
                                  ? new Date(stats.lastActiveAt).toLocaleDateString()
                                  : t("stat_never")}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">{t("stats_error")}</p>
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
    </div>
  );
}
