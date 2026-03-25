export interface ScrapedVacancy {
  platform: string;
  externalId: string;
  url: string;
  title: string;
  company: string;
  location: string | null;
  salaryText: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  remoteType: string | null;
  employmentType: string | null;
  description: string;
  language: string | null;
  postedAt: Date | null;
}

export interface SearchCriteria {
  jobTitles: string[];
  geographies: string[];
  remoteOnly: boolean;
  minSalary: number;
  currency: string;
}
