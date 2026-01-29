import { redirect } from "next/navigation";
import { auth } from "@/app/(auth)/auth";
import { SettingsPage } from "./settings-page";

export default async function Settings() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return <SettingsPage />;
}
