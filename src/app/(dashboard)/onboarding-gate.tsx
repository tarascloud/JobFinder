"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

interface Props {
  needsOnboarding: boolean;
  children: React.ReactNode;
}

export default function OnboardingGate({ needsOnboarding, children }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (needsOnboarding && !pathname.startsWith("/onboarding")) {
      router.replace("/onboarding");
    }
  }, [needsOnboarding, pathname, router]);

  return <>{children}</>;
}
