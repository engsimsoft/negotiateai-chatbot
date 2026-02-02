import { SWRProvider } from "@/components/swr-provider";

export const experimental_ppr = true;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SWRProvider>
      <div className="flex min-h-svh flex-col">{children}</div>
    </SWRProvider>
  );
}
