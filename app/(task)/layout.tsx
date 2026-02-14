import Script from "next/script";
import { DataStreamProvider } from "@/components/data-stream-provider";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SWRProvider } from "@/components/swr-provider";

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
            {children}
          </SidebarProvider>
        </DataStreamProvider>
      </SWRProvider>
    </>
  );
}
