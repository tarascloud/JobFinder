import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isDemoMode } from "@/lib/current-user";

export default async function RootPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/vacancies");
  }
  if (await isDemoMode()) {
    redirect("/vacancies");
  }
  redirect("/login");
}
