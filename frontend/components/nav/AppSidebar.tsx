"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LayoutDashboard, Lightbulb, Map as MapIcon } from "lucide-react";
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
  { href: "/intervention", label: "해결 방안", icon: Lightbulb },
];

export function AppSidebar() {
  const pathname = usePathname();
  const onMap = pathname === "/map";
  const [filterOpen, setFilterOpen] = useState(true);

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
              {NAV_ITEMS.map((item) =>
                item.href === "/map" ? (
                  <SidebarMenuItem key={item.href}>
                    <div
                      data-active={pathname === item.href}
                      className="hover:bg-accent hover:text-accent-foreground data-[active=true]:bg-gray-200 data-[active=true]:font-medium relative flex h-11 items-center gap-2.5 rounded-lg text-base [&_svg]:size-5"
                    >
                      <Link
                        href={item.href}
                        className="flex h-full min-w-0 flex-1 items-center gap-2.5 pl-2"
                      >
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => setFilterOpen((v) => !v)}
                        aria-label="필터 펼치기/접기"
                        className="flex h-full shrink-0 items-center pr-2 pl-1"
                      >
                        <ChevronDown
                          className={`transition-transform ${filterOpen ? "rotate-180" : ""}`}
                        />
                      </button>
                    </div>
                    <div
                      id="map-sidebar-panel-slot"
                      className={
                        onMap && filterOpen
                          ? "ml-4 mt-2 flex min-h-0 flex-col border-l border-gray-300 pt-1 pl-3 group-data-[collapsible=icon]:hidden"
                          : "hidden"
                      }
                    />
                  </SidebarMenuItem>
                ) : (
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
                )
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
