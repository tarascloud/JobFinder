export interface VacancyTags {
  stack: string[];
  level: string;
  industry: string;
  teamSize?: string;
}

// --- Level detection ---

const LEVEL_PATTERNS: [RegExp, string][] = [
  [/\b(vp|vice\s*president)\b/i, "vp"],
  [/\bcto\b/i, "cto"],
  [/\bdirector\b/i, "director"],
  [/\bprincipal\b/i, "staff"],
  [/\bstaff\b/i, "staff"],
  [/\b(tech\s*)?lead\b/i, "lead"],
  [/\bsenior|sr\.?\b/i, "senior"],
  [/\b(mid[\s-]?level|mid[\s-]?senior)\b/i, "mid"],
  [/\bjunior|jr\.?\b/i, "junior"],
  [/\bintern(ship)?\b/i, "junior"],
  [/\bentry[\s-]?level\b/i, "junior"],
];

function detectLevel(title: string, description: string): string {
  // Title takes priority
  for (const [pattern, level] of LEVEL_PATTERNS) {
    if (pattern.test(title)) return level;
  }
  // Fallback to description first 500 chars
  const descHead = description.slice(0, 500);
  for (const [pattern, level] of LEVEL_PATTERNS) {
    if (pattern.test(descHead)) return level;
  }
  // Heuristic: years of experience
  const yearsMatch = description.match(/(\d+)\+?\s*(?:years?|yrs?)\s+(?:of\s+)?experience/i);
  if (yearsMatch) {
    const years = parseInt(yearsMatch[1], 10);
    if (years >= 10) return "staff";
    if (years >= 7) return "senior";
    if (years >= 3) return "mid";
    if (years >= 0) return "junior";
  }
  return "mid"; // default
}

// --- Stack detection ---

const TECH_KEYWORDS: string[] = [
  // Languages
  "JavaScript", "TypeScript", "Python", "Java", "C#", "C++", "Go", "Golang", "Rust",
  "Ruby", "PHP", "Swift", "Kotlin", "Scala", "Elixir", "Clojure", "Haskell",
  "R", "Dart", "Lua", "Perl", "Objective-C", "COBOL", "Fortran", "Julia",
  // Frontend
  "React", "Angular", "Vue", "Vue.js", "Svelte", "Next.js", "Nuxt", "Remix",
  "Astro", "Gatsby", "Ember", "Backbone", "jQuery", "HTMX", "Alpine.js",
  "Tailwind", "Bootstrap", "Material UI", "Chakra UI", "Ant Design",
  "CSS", "SASS", "SCSS", "Less", "Styled Components",
  // Backend
  "Node.js", "Express", "Fastify", "NestJS", "Deno", "Bun",
  "Django", "Flask", "FastAPI", "Spring", "Spring Boot",
  "Rails", "Ruby on Rails", "Laravel", "Symfony",
  "ASP.NET", ".NET", ".NET Core", "Entity Framework",
  "GraphQL", "REST", "gRPC", "WebSocket",
  // Mobile
  "React Native", "Flutter", "SwiftUI", "Jetpack Compose", "Xamarin",
  "iOS", "Android", "Cordova", "Ionic",
  // Databases
  "PostgreSQL", "MySQL", "MongoDB", "Redis", "Elasticsearch",
  "DynamoDB", "Cassandra", "CockroachDB", "SQLite", "Oracle",
  "SQL Server", "MariaDB", "Neo4j", "InfluxDB", "TimescaleDB",
  "Prisma", "TypeORM", "Sequelize", "Drizzle", "Knex",
  // Cloud & DevOps
  "AWS", "Azure", "GCP", "Google Cloud",
  "Docker", "Kubernetes", "K8s", "Terraform", "Ansible", "Pulumi",
  "CI/CD", "GitHub Actions", "GitLab CI", "Jenkins", "CircleCI",
  "Cloudflare", "Vercel", "Netlify", "Heroku", "Fly.io",
  "Nginx", "Apache", "Caddy",
  // Data & ML
  "TensorFlow", "PyTorch", "Scikit-learn", "Pandas", "NumPy",
  "Spark", "Kafka", "Airflow", "dbt", "Snowflake", "BigQuery",
  "Hadoop", "Flink", "Databricks", "MLflow", "Hugging Face",
  "OpenAI", "LangChain", "LLM", "RAG",
  // Tools & Other
  "Git", "Linux", "Unix", "Bash",
  "RabbitMQ", "SQS", "Pub/Sub", "NATS",
  "Figma", "Storybook", "Playwright", "Cypress", "Jest", "Vitest",
  "Selenium", "Puppeteer",
  "OAuth", "JWT", "SSO", "SAML",
  "Microservices", "Monorepo", "Serverless", "Lambda",
  "WebAssembly", "WASM", "WebRTC",
  "Blockchain", "Solidity", "Web3", "Ethereum",
  "Three.js", "WebGL", "Unity", "Unreal",
  "Agile", "Scrum", "Kanban",
];

// Build case-insensitive word-boundary regex map for efficient matching
const TECH_REGEX_MAP: { canonical: string; regex: RegExp }[] = TECH_KEYWORDS.map(
  (kw) => ({
    canonical: kw,
    regex: new RegExp(
      `\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "[\\s\\-]?")}\\b`,
      "i"
    ),
  })
);

function detectStack(description: string): string[] {
  const found = new Set<string>();
  for (const { canonical, regex } of TECH_REGEX_MAP) {
    if (regex.test(description)) {
      found.add(canonical);
    }
  }
  return Array.from(found).slice(0, 30); // cap at 30
}

// --- Industry detection ---

const INDUSTRY_PATTERNS: [RegExp, string][] = [
  [/\b(fintech|financial\s+technology|banking|payments?|trading|invest(ment|ing)|insurance|insurtech)\b/i, "fintech"],
  [/\b(healthtech|health\s*care|medical|biotech|pharma|telemedicine|clinical)\b/i, "healthtech"],
  [/\b(e-?commerce|retail|marketplace|shopify|shopping)\b/i, "ecommerce"],
  [/\b(saas|b2b|platform|software\s+as\s+a\s+service)\b/i, "saas"],
  [/\b(gaming|game\s+dev|game\s+studio|esports|unity|unreal)\b/i, "gaming"],
  [/\b(edtech|education|e-?learning|lms|learning\s+platform)\b/i, "edtech"],
  [/\b(adtech|advertising|marketing\s+tech|martech)\b/i, "adtech"],
  [/\b(proptech|real\s+estate|property)\b/i, "proptech"],
  [/\b(legaltech|legal\s+tech|law\s+firm)\b/i, "legaltech"],
  [/\b(logistics|supply\s+chain|shipping|freight|warehouse)\b/i, "logistics"],
  [/\b(travel|hospitality|booking|airline)\b/i, "travel"],
  [/\b(media|news|publishing|content|streaming)\b/i, "media"],
  [/\b(telecom|telecommunications|5g|networking)\b/i, "telecom"],
  [/\b(automotive|car|vehicle|ev|electric\s+vehicle|self[\s-]?driving)\b/i, "automotive"],
  [/\b(aerospace|space|satellite|defense|defence)\b/i, "aerospace"],
  [/\b(agri[\s-]?tech|agriculture|farming)\b/i, "agritech"],
  [/\b(cleantech|climate|energy|renewable|sustainability)\b/i, "cleantech"],
  [/\b(hr[\s-]?tech|recruitment|talent|staffing)\b/i, "hrtech"],
  [/\b(devtools|developer\s+tools|infrastructure|cloud\s+platform)\b/i, "devtools"],
  [/\b(cybersecurity|security|infosec)\b/i, "cybersecurity"],
  [/\b(ai|artificial\s+intelligence|machine\s+learning|ml|deep\s+learning)\b/i, "ai"],
  [/\b(crypto|blockchain|web3|defi)\b/i, "crypto"],
  [/\b(foodtech|food\s+delivery|restaurant)\b/i, "foodtech"],
  [/\b(social|social\s+media|community)\b/i, "social"],
  [/\b(govtech|government|public\s+sector)\b/i, "govtech"],
  [/\b(consult(ing|ant)|professional\s+services)\b/i, "consulting"],
];

function detectIndustry(company: string, description: string): string {
  const text = `${company} ${description.slice(0, 1000)}`;
  for (const [pattern, industry] of INDUSTRY_PATTERNS) {
    if (pattern.test(text)) return industry;
  }
  return "other";
}

// --- Team size detection ---

const TEAM_SIZE_PATTERNS: [RegExp, string][] = [
  [/\b(startup|early[\s-]?stage|seed|pre[\s-]?seed|series[\s-]?a)\b/i, "startup"],
  [/\b(small\s+team|10[\s-]50\s+employees?|1[\s-]50)\b/i, "small"],
  [/\b(50[\s-]200|mid[\s-]?size|growing\s+team|scale[\s-]?up|series[\s-]?[bc])\b/i, "medium"],
  [/\b(enterprise|fortune\s+\d+|10[,.]?000\+?|large[\s-]?scale|global\s+company|multinational|corporation)\b/i, "enterprise"],
];

function detectTeamSize(company: string, description: string): string | undefined {
  const text = `${company} ${description.slice(0, 1000)}`;
  for (const [pattern, size] of TEAM_SIZE_PATTERNS) {
    if (pattern.test(text)) return size;
  }
  return undefined;
}

// --- Main export ---

export function tagVacancy(
  title: string,
  company: string,
  description: string
): VacancyTags {
  return {
    level: detectLevel(title, description),
    stack: detectStack(description),
    industry: detectIndustry(company, description),
    teamSize: detectTeamSize(company, description),
  };
}
