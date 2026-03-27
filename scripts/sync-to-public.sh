#!/bin/bash
# ─────────────────────────────────────────────────────────────
# Sync jf-private → jf-public (open source version)
# Excludes secrets, personal data, generated files
# Scans for leaked secrets before syncing
# ─────────────────────────────────────────────────────────────

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

PRIVATE_DIR="/Users/taras/Documents/taras-code/jf-private"
PUBLIC_DIR="/Users/taras/Documents/taras-code/jf-public"

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}  JobFinder: sync private → public${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# ── Validate directories ──────────────────────────────────────
if [ ! -d "$PRIVATE_DIR" ]; then
  echo -e "${RED}ERROR: Private repo not found: $PRIVATE_DIR${NC}"
  exit 1
fi

if [ ! -d "$PUBLIC_DIR" ]; then
  echo -e "${RED}ERROR: Public repo not found: $PUBLIC_DIR${NC}"
  echo -e "${YELLOW}Create it first: mkdir -p $PUBLIC_DIR && cd $PUBLIC_DIR && git init${NC}"
  exit 1
fi

# ── Step 1: rsync with excludes ──────────────────────────────
echo -e "\n${YELLOW}[1/3] Syncing files...${NC}"

rsync -av --delete \
  --exclude='.git/' \
  --exclude='.env' \
  --exclude='.env.local' \
  --exclude='.env.production' \
  --exclude='.env.development' \
  --exclude='.env*.local' \
  --exclude='secrets/' \
  --exclude='node_modules/' \
  --exclude='.next/' \
  --exclude='public/resumes/' \
  --exclude='public/screenshots/' \
  --exclude='scripts/seed-demo.sql' \
  --exclude='.turbo/' \
  --exclude='*.tsbuildinfo' \
  --exclude='.vercel/' \
  --exclude='prisma/*.db' \
  --exclude='prisma/*.db-journal' \
  "$PRIVATE_DIR/" "$PUBLIC_DIR/" \
  | tail -5

echo -e "${GREEN}  Sync complete.${NC}"

# ── Step 2: scan for secrets ─────────────────────────────────
echo -e "\n${YELLOW}[2/3] Scanning for secrets...${NC}"

SECRETS_FOUND=0
SCAN_DIR="$PUBLIC_DIR"

scan_pattern() {
  local label="$1"
  local pattern="$2"
  local matches
  matches=$(grep -rn --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" --include="*.yml" --include="*.yaml" --include="*.sh" --include="*.env*" --include="*.md" -E "$pattern" "$SCAN_DIR" \
    --exclude-dir=node_modules \
    --exclude-dir=.next \
    --exclude-dir=.git \
    --exclude="package-lock.json" \
    --exclude="sync-to-public.sh" \
    --exclude=".env.example" \
    --exclude="docker-compose.yml" \
    --exclude-dir="setup" \
    --exclude="apply-email.ts" \
    2>/dev/null || true)

  if [ -n "$matches" ]; then
    echo -e "${RED}  FOUND: $label${NC}"
    echo "$matches" | head -5
    if [ "$(echo "$matches" | wc -l)" -gt 5 ]; then
      echo "  ... and more"
    fi
    SECRETS_FOUND=$((SECRETS_FOUND + 1))
  fi
}

# Email addresses (personal)
scan_pattern "Personal email (tpedchenko)" "tpedchenko@gmail\.com"

# Telegram IDs
scan_pattern "Telegram user ID" "289736191"

# IP addresses (private network)
scan_pattern "Private IP address" "192\.168\.[0-9]+\.[0-9]+"

# Tailscale IP
scan_pattern "Tailscale IP" "100\.106\.[0-9]+\.[0-9]+"

# API keys / tokens (generic patterns)
scan_pattern "API key in code" "(OPENAI_API_KEY|GOOGLE_API_KEY|GROQ_API_KEY|GEMINI_API_KEY|OLLAMA_URL)\s*[:=]\s*['\"][^'\"]{10,}"

# Bearer tokens
scan_pattern "Bearer token" "Bearer\s+[A-Za-z0-9_\-\.]{20,}"

# Database URLs with credentials
scan_pattern "Database URL with credentials" "postgresql://[^:]+:[^@]+@"

# NEXTAUTH_SECRET
scan_pattern "NEXTAUTH_SECRET value" "NEXTAUTH_SECRET\s*[:=]\s*['\"][^'\"]{5,}"

# Private keys
scan_pattern "Private key" "-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----"

# Slack / Discord webhooks
scan_pattern "Webhook URL" "hooks\.(slack|discord)\.com/services/"

# Cloudflare tokens
scan_pattern "Cloudflare token" "(CF_API_TOKEN|CLOUDFLARE_API_TOKEN|cf_clearance)\s*[:=]"

# Telegram bot token
scan_pattern "Telegram bot token" "[0-9]{8,10}:[A-Za-z0-9_-]{35}"

# Generic secrets in .env format
scan_pattern "SECRET= in code" "(SECRET|PASSWORD|TOKEN|PRIVATE_KEY)\s*=\s*['\"]?[A-Za-z0-9/+=_\-]{16,}"

# AWS keys
scan_pattern "AWS access key" "AKIA[0-9A-Z]{16}"

# Google OAuth client secret
scan_pattern "Google client secret" "GOCSPX-[A-Za-z0-9_-]+"

# Encryption keys
scan_pattern "Encryption key" "ENCRYPTION_KEY\s*[:=]\s*['\"][^'\"]{5,}"

echo ""

if [ "$SECRETS_FOUND" -gt 0 ]; then
  echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${RED}  BLOCKED: $SECRETS_FOUND secret pattern(s) found!${NC}"
  echo -e "${RED}  Fix the issues above before syncing to public.${NC}"
  echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  exit 1
fi

echo -e "${GREEN}  No secrets found.${NC}"

# ── Step 3: show diff summary ────────────────────────────────
echo -e "\n${YELLOW}[3/3] Changes in public repo:${NC}"

cd "$PUBLIC_DIR"

if [ -d ".git" ]; then
  # Show summary of changes
  CHANGES=$(git status --porcelain 2>/dev/null || true)
  if [ -z "$CHANGES" ]; then
    echo -e "${GREEN}  No changes detected.${NC}"
  else
    ADDED=$(echo "$CHANGES" | grep -c "^??" || true)
    MODIFIED=$(echo "$CHANGES" | grep -c "^ M\|^M " || true)
    DELETED=$(echo "$CHANGES" | grep -c "^ D\|^D " || true)
    echo -e "  ${GREEN}+$ADDED new${NC}  |  ${YELLOW}~$MODIFIED modified${NC}  |  ${RED}-$DELETED deleted${NC}"
    echo ""
    echo -e "${CYAN}  Files changed:${NC}"
    echo "$CHANGES" | head -30
    if [ "$(echo "$CHANGES" | wc -l)" -gt 30 ]; then
      echo "  ... and more ($(echo "$CHANGES" | wc -l) total)"
    fi
  fi
else
  echo -e "${YELLOW}  Public repo has no .git — cannot show diff.${NC}"
fi

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Sync complete! Review the diff above, then:${NC}"
echo -e "${CYAN}  cd $PUBLIC_DIR${NC}"
echo -e "${CYAN}  git add -A && git commit -m 'sync from private' && git push${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
