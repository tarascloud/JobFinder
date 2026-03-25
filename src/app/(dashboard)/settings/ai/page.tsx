"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectOption } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Bot, CheckCircle2, XCircle, Loader2, ThumbsUp, ThumbsDown, Brain } from "lucide-react";
import SettingsTabs from "../settings-tabs";
import {
  getAISettings,
  updateAISettings,
  testAIConnection,
  type AIProvider,
} from "@/actions/ai-settings";
import { getAiFeedbackStats, getRecentFeedback } from "@/actions/ai-feedback";

const PROVIDERS: { value: AIProvider; key: string }[] = [
  { value: "ollama", key: "ollama" },
  { value: "gemini", key: "gemini" },
  { value: "groq", key: "groq" },
];

export default function AISettingsPage() {
  const t = useTranslations("ai_settings");
  const tf = useTranslations("ai_feedback");
  const tCommon = useTranslations("common");

  const [feedbackStats, setFeedbackStats] = useState<{
    totalLikes: number;
    totalDislikes: number;
    byField: { field: string; likes: number; dislikes: number }[];
  } | null>(null);
  const [recentFeedback, setRecentFeedback] = useState<
    { id: number; field: string; content: string; rating: string; comment: string | null; createdAt: Date }[]
  >([]);

  const [provider, setProvider] = useState<AIProvider>("ollama");
  const [ollamaUrl, setOllamaUrl] = useState("http://ollama:11434");
  const [ollamaModel, setOllamaModel] = useState(
    "qwen2.5:14b-instruct-q4_K_M"
  );
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [groqApiKey, setGroqApiKey] = useState("");

  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<Record<string, "ok" | "fail" | "testing" | null>>({
    ollama: null,
    gemini: null,
    groq: null,
  });

  const load = useCallback(async () => {
    const [settings, statsResult, recentResult] = await Promise.all([
      getAISettings(),
      getAiFeedbackStats(),
      getRecentFeedback(10),
    ]);
    setProvider(settings.provider);
    setOllamaUrl(settings.ollamaUrl);
    setOllamaModel(settings.ollamaModel);
    setGeminiApiKey(settings.geminiApiKey || "");
    setGroqApiKey(settings.groqApiKey || "");

    if ("totalLikes" in statsResult) {
      setFeedbackStats(statsResult as { totalLikes: number; totalDislikes: number; byField: { field: string; likes: number; dislikes: number }[] });
    }
    if ("feedback" in recentResult) {
      setRecentFeedback(recentResult.feedback as typeof recentFeedback);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSave() {
    setSaving(true);
    const result = await updateAISettings({
      provider,
      ollamaUrl,
      ollamaModel,
      geminiApiKey: geminiApiKey || null,
      groqApiKey: groqApiKey || null,
    });
    setSaving(false);
    if (result.success) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  }

  async function handleTest(p: AIProvider) {
    setTestResult((prev) => ({ ...prev, [p]: "testing" }));
    const result = await testAIConnection(p, {
      ollamaUrl: p === "ollama" ? ollamaUrl : undefined,
      geminiApiKey: p === "gemini" ? geminiApiKey : undefined,
      groqApiKey: p === "groq" ? groqApiKey : undefined,
    });
    setTestResult((prev) => ({
      ...prev,
      [p]: result.success ? "ok" : "fail",
    }));
    setTimeout(
      () => setTestResult((prev) => ({ ...prev, [p]: null })),
      5000
    );
  }

  function renderTestIcon(p: AIProvider) {
    const status = testResult[p];
    if (status === "testing")
      return <Loader2 className="h-4 w-4 animate-spin" />;
    if (status === "ok")
      return <CheckCircle2 className="h-4 w-4 text-green-400" />;
    if (status === "fail")
      return <XCircle className="h-4 w-4 text-red-400" />;
    return null;
  }

  return (
    <div className="space-y-6">
      <SettingsTabs active="ai" />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            {t("title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            {t("default_local")}
          </p>

          {/* Active provider selector */}
          <div className="space-y-2">
            <Label>{t("provider")}</Label>
            <Select
              value={provider}
              onChange={(e) => setProvider(e.target.value as AIProvider)}
            >
              {PROVIDERS.map((p) => (
                <SelectOption key={p.value} value={p.value}>
                  {t(p.key)}
                </SelectOption>
              ))}
            </Select>
          </div>

          {/* Ollama settings */}
          <div className="space-y-3 rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium flex items-center gap-2">
                {t("ollama")}
                {provider === "ollama" && (
                  <Badge variant="default">Active</Badge>
                )}
              </h3>
              <div className="flex items-center gap-2">
                {renderTestIcon("ollama")}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTest("ollama")}
                  disabled={testResult.ollama === "testing"}
                >
                  {t("test")}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("ollama_url")}</Label>
              <Input
                value={ollamaUrl}
                onChange={(e) => setOllamaUrl(e.target.value)}
                placeholder="http://ollama:11434"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("ollama_model")}</Label>
              <Input
                value={ollamaModel}
                onChange={(e) => setOllamaModel(e.target.value)}
                placeholder="qwen2.5:14b-instruct-q4_K_M"
              />
            </div>
          </div>

          {/* Gemini settings */}
          <div className="space-y-3 rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium flex items-center gap-2">
                {t("gemini")}
                {provider === "gemini" && (
                  <Badge variant="default">Active</Badge>
                )}
              </h3>
              <div className="flex items-center gap-2">
                {renderTestIcon("gemini")}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTest("gemini")}
                  disabled={testResult.gemini === "testing"}
                >
                  {t("test")}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("api_key")}</Label>
              <Input
                type="password"
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                placeholder="AIza..."
              />
            </div>
          </div>

          {/* Groq settings */}
          <div className="space-y-3 rounded-lg border border-border p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium flex items-center gap-2">
                {t("groq")}
                {provider === "groq" && (
                  <Badge variant="default">Active</Badge>
                )}
              </h3>
              <div className="flex items-center gap-2">
                {renderTestIcon("groq")}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTest("groq")}
                  disabled={testResult.groq === "testing"}
                >
                  {t("test")}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t("api_key")}</Label>
              <Input
                type="password"
                value={groqApiKey}
                onChange={(e) => setGroqApiKey(e.target.value)}
                placeholder="gsk_..."
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? tCommon("loading") : t("save")}
            </Button>
            {saved && (
              <span className="text-sm text-green-400">{t("saved")}</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* AI Feedback Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6 text-center">
            <ThumbsUp className="h-8 w-8 text-green-400 mx-auto mb-2" />
            <p className="text-2xl font-bold">{feedbackStats?.totalLikes ?? 0}</p>
            <p className="text-sm text-muted-foreground">{tf("total_likes")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <ThumbsDown className="h-8 w-8 text-red-400 mx-auto mb-2" />
            <p className="text-2xl font-bold">{feedbackStats?.totalDislikes ?? 0}</p>
            <p className="text-sm text-muted-foreground">{tf("total_dislikes")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <Brain className="h-8 w-8 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold">
              {feedbackStats && (feedbackStats.totalLikes + feedbackStats.totalDislikes) > 0
                ? Math.round((feedbackStats.totalLikes / (feedbackStats.totalLikes + feedbackStats.totalDislikes)) * 100)
                : 0}%
            </p>
            <p className="text-sm text-muted-foreground">{tf("approval_rate")}</p>
          </CardContent>
        </Card>
      </div>

      {feedbackStats && feedbackStats.byField.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{tf("by_field")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {feedbackStats.byField.map((item) => (
                <div key={item.field} className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <span className="text-sm font-medium">{tf(`field_${item.field.replace(".", "_")}`)}</span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-sm text-green-400">
                      <ThumbsUp className="h-3.5 w-3.5" /> {item.likes}
                    </span>
                    <span className="flex items-center gap-1 text-sm text-red-400">
                      <ThumbsDown className="h-3.5 w-3.5" /> {item.dislikes}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{tf("recent_feedback")}</CardTitle>
        </CardHeader>
        <CardContent>
          {recentFeedback.length === 0 ? (
            <p className="text-sm text-muted-foreground">{tf("no_feedback")}</p>
          ) : (
            <div className="space-y-3">
              {recentFeedback.map((item) => (
                <div key={item.id} className="p-3 rounded-lg border border-border space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge color={item.rating === "like" ? "green" : "red"}>
                      {item.rating === "like" ? tf("like") : tf("dislike")}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{tf(`field_${item.field.replace(".", "_")}`)}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/80 line-clamp-2">{item.content}</p>
                  {item.comment && (
                    <p className="text-xs text-muted-foreground italic">{item.comment}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
