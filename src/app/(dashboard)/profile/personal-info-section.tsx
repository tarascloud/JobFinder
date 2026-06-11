"use client";

import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

interface PersonalInfoSectionProps {
  firstName: string;
  setFirstName: (v: string) => void;
  lastName: string;
  setLastName: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  location: string;
  setLocation: (v: string) => void;
  linkedinUrl: string;
  setLinkedinUrl: (v: string) => void;
  githubUrl: string;
  setGithubUrl: (v: string) => void;
  dedicatedPortfolioUrl: string;
  setDedicatedPortfolioUrl: (v: string) => void;
}

export default function PersonalInfoSection({
  firstName,
  setFirstName,
  lastName,
  setLastName,
  phone,
  setPhone,
  location,
  setLocation,
  linkedinUrl,
  setLinkedinUrl,
  githubUrl,
  setGithubUrl,
  dedicatedPortfolioUrl,
  setDedicatedPortfolioUrl,
}: PersonalInfoSectionProps) {
  const t = useTranslations("profile");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("personal_info")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="pi-first-name" className="block text-sm text-muted-foreground mb-1.5">{t("first_name")}</label>
            <Input id="pi-first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div>
            <label htmlFor="pi-last-name" className="block text-sm text-muted-foreground mb-1.5">{t("last_name")}</label>
            <Input id="pi-last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>
        <div>
          <label htmlFor="pi-phone" className="block text-sm text-muted-foreground mb-1.5">{t("phone")}</label>
          <Input id="pi-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+34 612 345 678" />
        </div>
        <div>
          <label htmlFor="pi-location" className="block text-sm text-muted-foreground mb-1.5">{t("location")}</label>
          <Input id="pi-location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Madrid, Spain" />
        </div>
        <div>
          <label htmlFor="pi-linkedin" className="block text-sm text-muted-foreground mb-1.5">{t("linkedin_url")}</label>
          <Input id="pi-linkedin" type="url" value={linkedinUrl} onChange={(e) => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/yourname" />
        </div>
        <div>
          <label htmlFor="pi-github" className="block text-sm text-muted-foreground mb-1.5">{t("github_url")}</label>
          <Input id="pi-github" type="url" value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} placeholder="https://github.com/yourname" />
        </div>
        <div>
          <label htmlFor="pi-portfolio" className="block text-sm text-muted-foreground mb-1.5">{t("portfolio_url")}</label>
          <Input id="pi-portfolio" type="url" value={dedicatedPortfolioUrl} onChange={(e) => setDedicatedPortfolioUrl(e.target.value)} placeholder="https://yoursite.dev" />
        </div>
      </CardContent>
    </Card>
  );
}
