import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/landing/landing-page";

export default async function RootPage() {
  const cookieStore = await cookies();
  const hasSession =
    cookieStore.get("authjs.session-token")?.value ||
    cookieStore.get("__Secure-authjs.session-token")?.value ||
    cookieStore.get("demo_token")?.value;

  if (hasSession) {
    redirect("/profile");
  }

  return <LandingPage />;
}
