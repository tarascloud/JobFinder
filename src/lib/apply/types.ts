export interface ApplyContext {
  vacancy: {
    url: string;
    title: string;
    company: string;
    platform: string;
  };
  profile: {
    name: string;
    email: string;
    phone?: string;
    resumeUrl: string;
    portfolioUrls: string[];
  };
  coverLetter: string;
  qaAnswers: Map<string, string>; // question -> answer mapping from Q&A base
}

export interface ApplyResult {
  success: boolean;
  screenshotPath?: string;
  newQuestions?: string[]; // screening questions without answers
  log: string[];
  error?: string;
}
