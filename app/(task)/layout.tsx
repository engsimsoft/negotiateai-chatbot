import Script from "next/script";
import { DataStreamProvider } from "@/components/data-stream-provider";
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
        <DataStreamProvider>{children}</DataStreamProvider>
      </SWRProvider>
    </>
  );
}
