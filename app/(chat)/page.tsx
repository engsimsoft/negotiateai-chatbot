import { redirect } from "next/navigation";

import { auth } from "@/app/(auth)/auth";

export default async function Page() {
  const session = await auth();

  if (!session || !session.user) {
    redirect("/login");
  }

  // Redirect authenticated users to dashboard
  redirect("/dashboard");
}
