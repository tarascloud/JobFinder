import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isDemoMode } from "@/lib/current-user";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/profile");
  }
  if (await isDemoMode()) {
    redirect("/profile");
  }
  return <LoginForm />;
}
