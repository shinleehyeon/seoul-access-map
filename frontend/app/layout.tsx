import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  title: "서울시 교통약자·자전거 안전 공백",
  description: "자전거전용도로·어린이·노인 보호구역과 교통사고 다발지점 비교 대시보드",
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
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
            </SidebarInset>
          </SidebarProvider>
        </TooltipProvider>
      </body>
    </html>
  );
}
