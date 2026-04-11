export type UserRow = {
  id: number;
  email: string;
  name: string | null;
  role: string;
  applicationLimit: number;
  createdAt: Date;
};

export type UserStatsData = {
  vacancyCount: number;
  applicationsByStatus: Record<string, number>;
  totalApplications: number;
  searchProfileCount: number;
  lastActiveAt: Date | null;
};

export type AdminEmailRow = {
  id: number;
  fromEmail: string;
  toEmail: string;
  subject: string;
  body: string;
  bodyText: string | null;
  bodyHtml: string | null;
  messageId: string | null;
  platform: string | null;
  category: string;
  read: boolean;
  createdAt: Date;
};
