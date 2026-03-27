import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isDemoMode } from "@/lib/current-user";
import { LoginForm } from "./login-form";

const githubEnabled = !!(
  (process.env.GITHUB_CLIENT_ID || process.env.GITHUB_ID) &&
  (process.env.GITHUB_CLIENT_SECRET || process.env.GITHUB_SECRET)
);

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/profile");
  }
  if (await isDemoMode()) {
    redirect("/profile");
  }
  return <LoginForm githubEnabled={githubEnabled} />;
}
