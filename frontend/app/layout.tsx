import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Search } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/nav/AppSidebar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "서울 자전거 피해 사고 인사이트",
  description: "서울 자전거 피해 사고 패턴·치사율·블랙스팟 인사이트 대시보드",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="bg-gray-100 flex h-full flex-col overflow-hidden">
        <TooltipProvider>
          <SidebarProvider className="h-full min-h-0">
            <AppSidebar />
            <SidebarInset className="flex h-full min-h-0 flex-col border border-gray-200">
              <div className="flex h-14 shrink-0 items-center gap-3 border-b border-gray-200 px-4">
                <SidebarTrigger className="size-8" />
                <div className="bg-gray-200 h-5 w-px" />
                <div className="text-muted-foreground focus-within:text-foreground flex h-8 w-full max-w-sm items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2.5">
                  <Search className="size-4 shrink-0" />
                  <input
                    type="text"
                    placeholder="검색..."
                    className="h-full w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                  <kbd className="text-muted-foreground bg-background shrink-0 rounded-md border border-gray-200 px-1.5 py-0.5 text-[10px] font-medium">
                    ⌘K
                  </kbd>
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
            </SidebarInset>
          </SidebarProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
