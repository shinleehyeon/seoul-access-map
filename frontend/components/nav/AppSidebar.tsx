"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Map as MapIcon } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const NAV_ITEMS = [
  { href: "/", label: "대시보드", icon: LayoutDashboard },
  { href: "/map", label: "지도", icon: MapIcon },
];

export function AppSidebar() {
  const pathname = usePathname();
  const onMap = pathname === "/map";

  return (
    <Sidebar collapsible="icon" variant="inset" className="bg-gray-100">
      <SidebarHeader className="px-4 py-4">
        <span className="flex items-center gap-2 text-base font-semibold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-rose-800 text-white">
            안
          </span>
          교통안전 공백
        </span>
      </SidebarHeader>
      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sm text-gray-400">메뉴</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {NAV_ITEMS.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    tooltip={item.label}
                    className="h-11 rounded-lg text-base data-[active=true]:bg-gray-200 data-[active=true]:font-medium [&_svg]:size-5"
                  >
                    <Link href={item.href}>
                      <item.icon />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* 지도 페이지에서 Dashboard가 필터·목록을 포털로 꽂는 슬롯 */}
        <SidebarGroup className="min-h-0 flex-1 group-data-[collapsible=icon]:hidden">
          <div
            id="map-sidebar-panel-slot"
            className={onMap ? "flex h-full min-h-0 flex-col" : "hidden"}
          />
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
