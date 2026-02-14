import Script from "next/script";
import { DataStreamProvider } from "@/components/data-stream-provider";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SWRProvider } from "@/components/swr-provider";
import { UserMenu } from "@/components/user-menu";

export const experimental_ppr = true;

export default async function TaskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Script
        src="https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js"
        strategy="beforeInteractive"
      />
      <SWRProvider>
        <DataStreamProvider>
          {/* SidebarProvider needed for Artifact component (useSidebar context) */}
          <SidebarProvider defaultOpen={false}>
            {/* Global user menu for pages without AppSidebar */}
            <div className="fixed right-4 top-3 z-50">
              <UserMenu />
            </div>
            {children}
          </SidebarProvider>
        </DataStreamProvider>
      </SWRProvider>
    </>
  );
}
