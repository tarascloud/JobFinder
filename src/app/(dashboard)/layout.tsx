import { getCurrentUser, isDemoMode } from "@/lib/current-user";
import { needsOnboarding } from "@/lib/onboarding-check";
import DashboardShell from "./dashboard-shell";
import OnboardingGate from "./onboarding-gate";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let onboarding = false;
  let demo = false;
  let userRole = "user";

  try {
    demo = await isDemoMode();
    if (!demo) {
      const user = await getCurrentUser();
      if (user) {
        onboarding = await needsOnboarding(user.id);
        userRole = user.role;
      }
    }
    // Demo users skip onboarding
  } catch {
    // Not logged in — let auth middleware handle it
  }

  return (
    <DashboardShell isDemo={demo} userRole={userRole}>
      <OnboardingGate needsOnboarding={onboarding}>
        {children}
      </OnboardingGate>
    </DashboardShell>
  );
}
