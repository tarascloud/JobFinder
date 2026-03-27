"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Mail, Copy, Check, Plus, Trash2, Settings, RefreshCw, MessageCircle, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { updateProfile, type AnalyzedProfile, type ExperienceEntry, type EducationEntry } from "@/actions/profile";
import { getApplyEmailInfo } from "@/actions/apply-email";
import { resetOnboarding } from "@/actions/onboarding";
import { getTelegramSettings, updateTelegramUsername, disconnectTelegram } from "@/actions/telegram-profile";
import ResumeSection from "./resume-section";
import SkillsSection from "./skills-section";
import LanguagesSection, {
  type LanguageEntry,
  parseLanguages,
  serializeLanguages,
} from "./languages-section";
import ProfileForm from "./profile-form";

export default function ProfilePage() {
  const router = useRouter();
  const t = useTranslations("profile");

  // Profile state — empty by default, loaded from DB on mount
  const [headline, setHeadline] = useState("");
  const [summary, setSummary] = useState("");
  const [yearsOfExperience, setYearsOfExperience] = useState("");
  const [skills, setSkills] = useState<string[]>([]);
  const [languageEntries, setLanguageEntries] = useState<LanguageEntry[]>([]);
  const [portfolioUrl, setPortfolioUrl] = useState("");
  const [resumeUrl, setResumeUrl] = useState("");
  const [resumeFilename, setResumeFilename] = useState("");
  const [profileLoaded, setProfileLoaded] = useState(false);

  // LinkedIn Easy Apply fields
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [education, setEducation] = useState("");
  const [educationField, setEducationField] = useState("");
  const [educationSchool, setEducationSchool] = useState("");
  const [educationHistory, setEducationHistory] = useState<EducationEntry[]>([]);
  const [currentCompany, setCurrentCompany] = useState("");
  const [currentTitle, setCurrentTitle] = useState("");
  const [experience, setExperience] = useState<ExperienceEntry[]>([]);
  const [certifications, setCertifications] = useState("");
  const [noticePeriod, setNoticePeriod] = useState("");
  const [visaRequired, setVisaRequired] = useState(false);
  const [workAuthorization, setWorkAuthorization] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [dedicatedPortfolioUrl, setDedicatedPortfolioUrl] = useState("");

  // Apply email tracking
  const [applyEmail, setApplyEmail] = useState("");
  const [forwardEmail, setForwardEmail] = useState("");
  const [copied, setCopied] = useState(false);

  // Track which fields have accepted AI changes (for feedback buttons)
  const [acceptedChanges, setAcceptedChanges] = useState<Set<string>>(new Set());

  // Telegram state
  const [telegramUsername, setTelegramUsername] = useState("");
  const [telegramConnected, setTelegramConnected] = useState(false);
  const [telegramSaving, setTelegramSaving] = useState(false);
  const [telegramError, setTelegramError] = useState("");

  // Re-onboarding state
  const [resettingOnboarding, setResettingOnboarding] = useState(false);

  // Load profile from DB on mount
  useEffect(() => {
    async function loadProfile() {
      const { getProfile } = await import("@/actions/profile");
      const profile = await getProfile();
      if (profile) {
        setHeadline(profile.headline || "");
        setSummary(profile.summary || "");
        setYearsOfExperience(profile.yearsExperience?.toString() || "");
        setSkills(profile.skills || []);
        setLanguageEntries(parseLanguages(profile.languages || []));
        setPortfolioUrl((profile.portfolioUrls || [])[0] || "");
        setResumeUrl(profile.resumeUrl || "");
        setResumeFilename(profile.resumeFilename || "");
        // LinkedIn Easy Apply fields
        setFirstName(profile.firstName || "");
        setLastName(profile.lastName || "");
        setPhone(profile.phone || "");
        setLocation(profile.location || "");
        setEducation(profile.education || "");
        setEducationField(profile.educationField || "");
        setEducationSchool(profile.educationSchool || "");
        try { setEducationHistory(profile.educationHistory ? JSON.parse(profile.educationHistory) : []); } catch { setEducationHistory([]); }
        setCurrentCompany(profile.currentCompany || "");
        setCurrentTitle(profile.currentTitle || "");
        try { setExperience(profile.experience ? JSON.parse(profile.experience) : []); } catch { setExperience([]); }
        setCertifications(profile.certifications || "");
        setNoticePeriod(profile.noticePeriod || "");
        setVisaRequired(profile.visaRequired || false);
        setWorkAuthorization(profile.workAuthorization || "");
        setLinkedinUrl(profile.linkedinUrl || "");
        setGithubUrl(profile.githubUrl || "");
        setDedicatedPortfolioUrl(profile.portfolioUrl || "");
      }
      setProfileLoaded(true);
    }
    loadProfile();

    // Load apply email info
    getApplyEmailInfo().then((info) => {
      setApplyEmail(info.applyEmail);
      setForwardEmail(info.forwardEmail);
    }).catch(() => {});

    // Load Telegram settings
    getTelegramSettings().then((settings) => {
      setTelegramUsername(settings.telegramUsername);
      setTelegramConnected(settings.isConnected);
    }).catch(() => {});
  }, []);

  function handleAcceptChange(field: string, profile: AnalyzedProfile) {
    setAcceptedChanges((prev) => new Set(prev).add(field));

    switch (field) {
      case "headline":
        setHeadline(profile.headline);
        break;
      case "summary":
        setSummary(profile.summary);
        break;
      case "yearsExperience":
        setYearsOfExperience(profile.yearsExperience != null ? String(profile.yearsExperience) : "");
        break;
      case "skills":
        setSkills(profile.skills);
        break;
      case "languages":
        setLanguageEntries(parseLanguages(profile.languages));
        break;
      case "portfolioUrls":
        if (profile.portfolioUrls.length > 0) setPortfolioUrl(profile.portfolioUrls[0]);
        break;
    }
  }

  function handleAcceptAllChanges(profile: AnalyzedProfile) {
    setHeadline(profile.headline);
    setSummary(profile.summary);
    setYearsOfExperience(profile.yearsExperience != null ? String(profile.yearsExperience) : "");
    setSkills(profile.skills);
    if (profile.languages) {
      setLanguageEntries(parseLanguages(profile.languages));
    }
    if (profile.portfolioUrls && profile.portfolioUrls.length > 0) {
      setPortfolioUrl(profile.portfolioUrls[0]);
    }
    setAcceptedChanges(new Set(["headline", "summary", "yearsExperience", "skills", "languages", "portfolioUrls"]));
  }

  async function handleSave() {
    try {
      await updateProfile({
        headline,
        summary,
        yearsExperience: yearsOfExperience ? parseInt(yearsOfExperience) : null,
        skills,
        languages: serializeLanguages(languageEntries),
        portfolioUrls: portfolioUrl ? [portfolioUrl] : [],
        resumeUrl: resumeUrl || null,
        resumeFilename: resumeFilename || null,
        // LinkedIn Easy Apply fields
        firstName: firstName || null,
        lastName: lastName || null,
        phone: phone || null,
        location: location || null,
        education: education || null,
        educationField: educationField || null,
        educationSchool: educationSchool || null,
        educationHistory: educationHistory.length > 0 ? JSON.stringify(educationHistory) : null,
        currentCompany: currentCompany || null,
        currentTitle: currentTitle || null,
        experience: experience.length > 0 ? JSON.stringify(experience) : null,
        certifications: certifications || null,
        noticePeriod: noticePeriod || null,
        visaRequired,
        workAuthorization: workAuthorization || null,
        linkedinUrl: linkedinUrl || null,
        githubUrl: githubUrl || null,
        portfolioUrl: dedicatedPortfolioUrl || null,
      });
      router.push("/vacancies");
    } catch {
      // Stay on the profile page if save fails
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">{t("title")}</h1>

      {/* JF Email Card */}
      {applyEmail && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4" />
              {t("apply_email_title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md bg-muted px-3 py-2 text-sm font-mono">
                {applyEmail}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText(applyEmail);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("apply_email_desc")}
            </p>
            <div className="text-xs text-muted-foreground">
              {t("apply_email_forward")}: <span className="font-medium text-foreground">{forwardEmail}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Telegram Card */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="h-4 w-4" />
            {t("telegram_title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground shrink-0">@</span>
            <Input
              value={telegramUsername}
              onChange={(e) => {
                setTelegramUsername(e.target.value.replace(/^@/, ""));
                setTelegramError("");
              }}
              placeholder={t("telegram_username_placeholder")}
              className="flex-1"
            />
            <Button
              variant="outline"
              size="sm"
              disabled={telegramSaving}
              onClick={async () => {
                setTelegramSaving(true);
                setTelegramError("");
                const result = await updateTelegramUsername(telegramUsername);
                if ("error" in result) {
                  setTelegramError(result.error ?? "");
                } else {
                  // If username changed, connection is reset
                  setTelegramConnected(false);
                }
                setTelegramSaving(false);
              }}
            >
              {telegramSaving ? t("telegram_saving") : t("telegram_save")}
            </Button>
          </div>
          {telegramError && (
            <p className="text-xs text-red-400">{telegramError}</p>
          )}
          {telegramConnected ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-green-500">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {t("telegram_connected")}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={async () => {
                  await disconnectTelegram();
                  setTelegramConnected(false);
                }}
              >
                {t("telegram_disconnect")}
              </Button>
            </div>
          ) : telegramUsername ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertCircle className="h-3.5 w-3.5 text-orange-400" />
              {t("telegram_connect_instruction")}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <ResumeSection
        resumeUrl={resumeUrl}
        setResumeUrl={setResumeUrl}
        resumeFilename={resumeFilename}
        setResumeFilename={setResumeFilename}
        onAcceptChange={handleAcceptChange}
        onAcceptAllChanges={handleAcceptAllChanges}
        headline={headline}
        summary={summary}
        yearsOfExperience={yearsOfExperience}
        skills={skills}
        serializedLanguages={serializeLanguages(languageEntries)}
        portfolioUrl={portfolioUrl}
      />

      {/* Re-run Onboarding */}
      <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3">
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            setResettingOnboarding(true);
            const result = await resetOnboarding();
            if (result.ok) {
              router.push("/onboarding");
            } else {
              setResettingOnboarding(false);
            }
          }}
          disabled={resettingOnboarding}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${resettingOnboarding ? "animate-spin" : ""}`} />
          {t("rerun_onboarding")}
        </Button>
        <span className="text-xs text-muted-foreground">{t("rerun_onboarding_desc")}</span>
      </div>

      {/* Platform accounts link */}
      <Link
        href="/settings/platforms"
        className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Settings className="h-4 w-4 shrink-0" />
        <span>
          Configure your job platform accounts{" "}
          <span className="text-foreground font-medium">Settings &gt; Platforms</span>
        </span>
      </Link>

      <ProfileForm
        headline={headline}
        setHeadline={setHeadline}
        summary={summary}
        setSummary={setSummary}
        yearsOfExperience={yearsOfExperience}
        setYearsOfExperience={setYearsOfExperience}
        headlineAccepted={acceptedChanges.has("headline")}
        summaryAccepted={acceptedChanges.has("summary")}
      />

      <SkillsSection
        skills={skills}
        setSkills={setSkills}
        isAccepted={acceptedChanges.has("skills")}
      />

      <LanguagesSection
        languageEntries={languageEntries}
        setLanguageEntries={setLanguageEntries}
      />

      {/* Portfolio */}
      <Card>
        <CardHeader>
          <CardTitle>
            {t("portfolio")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">{t("portfolio")}</label>
            <Input
              type="url"
              value={portfolioUrl}
              onChange={(e) => setPortfolioUrl(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Personal Info (LinkedIn Easy Apply) */}
      <Card>
        <CardHeader>
          <CardTitle>{t("personal_info")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-1.5">{t("first_name")}</label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1.5">{t("last_name")}</label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">{t("phone")}</label>
            <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+34 612 345 678" />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">{t("location")}</label>
            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Madrid, Spain" />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">{t("linkedin_url")}</label>
            <Input type="url" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/yourname" />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">{t("github_url")}</label>
            <Input type="url" value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} placeholder="https://github.com/yourname" />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">{t("portfolio_url")}</label>
            <Input type="url" value={dedicatedPortfolioUrl} onChange={(e) => setDedicatedPortfolioUrl(e.target.value)} placeholder="https://yoursite.dev" />
          </div>
        </CardContent>
      </Card>

      {/* Education */}
      <Card>
        <CardHeader>
          <CardTitle>{t("education_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">{t("education_degree")}</label>
            <select
              value={education}
              onChange={(e) => setEducation(e.target.value)}
              className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">{t("select_option")}</option>
              <option value="High School">High School</option>
              <option value="Associate">Associate</option>
              <option value="Bachelor's">Bachelor&apos;s</option>
              <option value="Master's">Master&apos;s</option>
              <option value="PhD">PhD</option>
              <option value="MBA">MBA</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">{t("education_field")}</label>
            <Input value={educationField} onChange={(e) => setEducationField(e.target.value)} placeholder="Computer Science, Engineering, etc." />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">{t("education_school")}</label>
            <Input value={educationSchool} onChange={(e) => setEducationSchool(e.target.value)} />
          </div>

          {/* Education History (multiple entries) */}
          <div className="border-t border-border pt-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-foreground">{t("education_history")}</label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEducationHistory([...educationHistory, { degree: "", field: "", school: "", dateFrom: "", dateTo: "" }])}
              >
                <Plus className="h-3 w-3 mr-1" /> {t("add")}
              </Button>
            </div>
            {educationHistory.map((entry, idx) => (
              <div key={idx} className="rounded-lg border border-border p-3 mb-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">#{idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => setEducationHistory(educationHistory.filter((_, i) => i !== idx))}
                    className="text-destructive hover:text-destructive/80"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder={t("education_degree")}
                    value={entry.degree}
                    onChange={(e) => { const u = [...educationHistory]; u[idx] = { ...u[idx], degree: e.target.value }; setEducationHistory(u); }}
                  />
                  <Input
                    placeholder={t("education_field")}
                    value={entry.field}
                    onChange={(e) => { const u = [...educationHistory]; u[idx] = { ...u[idx], field: e.target.value }; setEducationHistory(u); }}
                  />
                </div>
                <Input
                  placeholder={t("education_school")}
                  value={entry.school}
                  onChange={(e) => { const u = [...educationHistory]; u[idx] = { ...u[idx], school: e.target.value }; setEducationHistory(u); }}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder={t("date_from")}
                    value={entry.dateFrom}
                    onChange={(e) => { const u = [...educationHistory]; u[idx] = { ...u[idx], dateFrom: e.target.value }; setEducationHistory(u); }}
                  />
                  <Input
                    placeholder={t("date_to")}
                    value={entry.dateTo}
                    onChange={(e) => { const u = [...educationHistory]; u[idx] = { ...u[idx], dateTo: e.target.value }; setEducationHistory(u); }}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Work Experience */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t("experience_title")}</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setExperience([...experience, { company: "", title: "", dateFrom: "", dateTo: "", description: "" }])}
            >
              <Plus className="h-3 w-3 mr-1" /> {t("add")}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {experience.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("no_experience")}</p>
          )}
          {experience.map((entry, idx) => (
            <div key={idx} className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">#{idx + 1}</span>
                <button
                  type="button"
                  onClick={() => setExperience(experience.filter((_, i) => i !== idx))}
                  className="text-destructive hover:text-destructive/80"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder={t("exp_company")}
                  value={entry.company}
                  onChange={(e) => { const u = [...experience]; u[idx] = { ...u[idx], company: e.target.value }; setExperience(u); }}
                />
                <Input
                  placeholder={t("exp_title")}
                  value={entry.title}
                  onChange={(e) => { const u = [...experience]; u[idx] = { ...u[idx], title: e.target.value }; setExperience(u); }}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder={t("date_from")}
                  value={entry.dateFrom}
                  onChange={(e) => { const u = [...experience]; u[idx] = { ...u[idx], dateFrom: e.target.value }; setExperience(u); }}
                />
                <Input
                  placeholder={t("date_to")}
                  value={entry.dateTo}
                  onChange={(e) => { const u = [...experience]; u[idx] = { ...u[idx], dateTo: e.target.value }; setExperience(u); }}
                />
              </div>
              <textarea
                placeholder={t("exp_description")}
                value={entry.description}
                onChange={(e) => { const u = [...experience]; u[idx] = { ...u[idx], description: e.target.value }; setExperience(u); }}
                rows={2}
                className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Work Info */}
      <Card>
        <CardHeader>
          <CardTitle>{t("work_info")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">{t("current_company")}</label>
            <Input value={currentCompany} onChange={(e) => setCurrentCompany(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">{t("current_title")}</label>
            <Input value={currentTitle} onChange={(e) => setCurrentTitle(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">{t("certifications")}</label>
            <textarea
              value={certifications}
              onChange={(e) => setCertifications(e.target.value)}
              rows={2}
              placeholder="AWS Solutions Architect, PMP, CKA..."
              className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">{t("notice_period")}</label>
            <select
              value={noticePeriod}
              onChange={(e) => setNoticePeriod(e.target.value)}
              className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">{t("select_option")}</option>
              <option value="Immediately">Immediately</option>
              <option value="2 weeks">2 weeks</option>
              <option value="1 month">1 month</option>
              <option value="2 months">2 months</option>
              <option value="3 months">3 months</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Work Authorization */}
      <Card>
        <CardHeader>
          <CardTitle>{t("authorization_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="visaRequired"
              checked={visaRequired}
              onChange={(e) => setVisaRequired(e.target.checked)}
              className="h-4 w-4 rounded border-input bg-muted text-primary focus:ring-ring"
            />
            <label htmlFor="visaRequired" className="text-sm text-foreground">{t("visa_required")}</label>
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">{t("work_authorization")}</label>
            <select
              value={workAuthorization}
              onChange={(e) => setWorkAuthorization(e.target.value)}
              className="w-full rounded-lg border border-input bg-muted px-3 py-2 text-sm text-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="">{t("select_option")}</option>
              <option value="EU citizen">EU citizen</option>
              <option value="Work permit">Work permit</option>
              <option value="Student visa">Student visa</option>
              <option value="Need sponsorship">Need sponsorship</option>
              <option value="Permanent resident">Permanent resident</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button size="lg" onClick={handleSave}>
          {t("save_profile")}
        </Button>
      </div>
    </div>
  );
}
