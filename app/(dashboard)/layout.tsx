import { SWRProvider } from "@/components/swr-provider";
import { UserMenu } from "@/components/user-menu";

export const experimental_ppr = true;

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SWRProvider>
      <div className="flex min-h-svh flex-col">
        {/* Global user menu for pages without AppSidebar */}
        <div className="fixed right-4 top-3 z-50">
          <UserMenu />
        </div>
        {children}
      </div>
    </SWRProvider>
  );
}
