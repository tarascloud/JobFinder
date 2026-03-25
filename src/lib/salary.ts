/**
 * Salary normalization utilities.
 * Converts salaries from various currencies/periods to EUR annual for comparison.
 */

const EUR_RATES: Record<string, number> = {
  EUR: 1,
  USD: 0.92,
  GBP: 1.17,
  CHF: 1.04,
  SEK: 0.087,
  NOK: 0.086,
  DKK: 0.13,
  PLN: 0.23,
  CZK: 0.041,
  UAH: 0.024,
  CAD: 0.68,
  AUD: 0.6,
  JPY: 0.0061,
  INR: 0.011,
  BRL: 0.17,
};

export type SalaryPeriod = "hourly" | "monthly" | "annual";

export function normalizeToEur(amount: number, currency: string): number {
  const upper = currency.toUpperCase().trim();
  const rate = EUR_RATES[upper];
  if (!rate) return amount; // unknown currency — return as-is
  return Math.round(amount * rate);
}

export function normalizeToAnnual(
  amount: number,
  period: SalaryPeriod
): number {
  switch (period) {
    case "hourly":
      return Math.round(amount * 2080); // 40h/week * 52 weeks
    case "monthly":
      return Math.round(amount * 12);
    case "annual":
      return amount;
  }
}

export function normalizeToEurAnnual(
  amount: number,
  currency: string,
  period: SalaryPeriod
): number {
  return normalizeToEur(normalizeToAnnual(amount, period), currency);
}

interface ParsedSalary {
  min: number | null;
  max: number | null;
  currency: string;
  period: SalaryPeriod;
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  $: "USD",
  "\u20AC": "EUR",
  "\u00A3": "GBP",
  "CHF": "CHF",
  "Fr": "CHF",
  "kr": "SEK", // could be NOK/DKK too, default to SEK
  "z\u0142": "PLN",
  "K\u010D": "CZK",
  "\u20B4": "UAH",
  "C$": "CAD",
  "A$": "AUD",
  "\u00A5": "JPY",
  "\u20B9": "INR",
  "R$": "BRL",
};

const CURRENCY_CODES = Object.keys(EUR_RATES);

/**
 * Parse salary text like "$120k-$150k/year", "60,000 - 80,000 EUR", "€4,500/mo" etc.
 */
export function parseSalaryText(text: string): ParsedSalary {
  const result: ParsedSalary = {
    min: null,
    max: null,
    currency: "EUR",
    period: "annual",
  };

  if (!text) return result;

  const normalized = text.trim();

  // Detect period
  const lowerText = normalized.toLowerCase();
  if (
    lowerText.includes("/hr") ||
    lowerText.includes("/hour") ||
    lowerText.includes("per hour") ||
    lowerText.includes("hourly") ||
    lowerText.includes("p/h")
  ) {
    result.period = "hourly";
  } else if (
    lowerText.includes("/mo") ||
    lowerText.includes("/month") ||
    lowerText.includes("per month") ||
    lowerText.includes("monthly") ||
    lowerText.includes("p/m") ||
    lowerText.includes("/mes")
  ) {
    result.period = "monthly";
  }
  // Default: annual

  // Detect currency from symbol
  let detectedCurrency: string | null = null;
  for (const [symbol, code] of Object.entries(CURRENCY_SYMBOLS)) {
    if (normalized.includes(symbol)) {
      detectedCurrency = code;
      break;
    }
  }

  // Detect currency from code (e.g. "EUR", "USD")
  if (!detectedCurrency) {
    const upperText = normalized.toUpperCase();
    for (const code of CURRENCY_CODES) {
      if (upperText.includes(code)) {
        detectedCurrency = code;
        break;
      }
    }
  }

  if (detectedCurrency) {
    result.currency = detectedCurrency;
  }

  // Extract numbers — handle "k" suffix (120k = 120000)
  const numberPattern = /[\d,]+(?:\.\d+)?k?/gi;
  const matches = normalized.match(numberPattern);

  if (matches) {
    const numbers = matches
      .map((m) => {
        const isK = m.toLowerCase().endsWith("k");
        const cleanStr = m.replace(/[,k]/gi, "");
        const num = parseFloat(cleanStr);
        return isNaN(num) ? null : isK ? num * 1000 : num;
      })
      .filter((n): n is number => n !== null && n > 0);

    if (numbers.length >= 2) {
      result.min = Math.min(numbers[0], numbers[1]);
      result.max = Math.max(numbers[0], numbers[1]);
    } else if (numbers.length === 1) {
      // Single number — could be min or exact
      result.min = numbers[0];
      result.max = numbers[0];
    }
  }

  return result;
}

/**
 * Compute EUR annual salary values for a vacancy.
 * Returns null if no salary data available.
 */
export function computeEurSalary(
  salaryMin: number | null,
  salaryMax: number | null,
  salaryCurrency: string | null,
  salaryText: string | null
): { minEur: number | null; maxEur: number | null } {
  // If we have structured data, use it
  if ((salaryMin || salaryMax) && salaryCurrency) {
    const currency = salaryCurrency.toUpperCase();
    return {
      minEur: salaryMin ? normalizeToEur(salaryMin, currency) : null,
      maxEur: salaryMax ? normalizeToEur(salaryMax, currency) : null,
    };
  }

  // Fall back to parsing salary text
  if (salaryText) {
    const parsed = parseSalaryText(salaryText);
    if (parsed.min || parsed.max) {
      return {
        minEur: parsed.min
          ? normalizeToEurAnnual(parsed.min, parsed.currency, parsed.period)
          : null,
        maxEur: parsed.max
          ? normalizeToEurAnnual(parsed.max, parsed.currency, parsed.period)
          : null,
      };
    }
  }

  return { minEur: null, maxEur: null };
}

/**
 * Format EUR salary for display (e.g., "~92,000 EUR")
 */
export function formatEurSalary(
  minEur: number | null,
  maxEur: number | null
): string | null {
  if (!minEur && !maxEur) return null;
  if (minEur && maxEur && minEur !== maxEur) {
    return `${minEur.toLocaleString()}-${maxEur.toLocaleString()} EUR`;
  }
  const val = maxEur ?? minEur;
  return val ? `~${val.toLocaleString()} EUR` : null;
}
