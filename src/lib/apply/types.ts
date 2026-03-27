export interface ApplyContext {
  userId: number;
  platformAccountId: number;
  vacancy: {
    url: string;
    title: string;
    company: string;
    platform: string;
  };
  profile: {
    name: string;
    email: string; // personal email (login)
    applyEmail: string; // per-user tracking email ({userId}@jf.taras.cloud)
    phone?: string;
    resumeUrl: string;
    portfolioUrls: string[];
  };
  coverLetter: string;
  qaAnswers: Map<string, string>; // question -> answer mapping from Q&A base
}

export interface ApplyResult {
  success: boolean;
  paused?: boolean; // true when application paused waiting for Q&A answers
  screenshotPath?: string;
  newQuestions?: string[]; // screening questions without answers
  suggestedAnswers?: { question: string; answer: string; confidence: number }[]; // AI-suggested (0.5-0.7 confidence)
  log: string[];
  error?: string;
}
