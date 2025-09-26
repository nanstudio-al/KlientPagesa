import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Users, 
  Server, 
  FileText, 
  BarChart3,
  CreditCard 
} from "lucide-react";

const menuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Klientët",
    url: "/clients",
    icon: Users,
  },
  {
    title: "Shërbimet",
    url: "/services",
    icon: Server,
  },
  {
    title: "Faturat",
    url: "/invoices",
    icon: FileText,
  },
  {
    title: "Pagesat",
    url: "/payments",
    icon: CreditCard,
  },
  {
    title: "Raporte",
    url: "/reports",
    icon: BarChart3,
  },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar data-testid="sidebar-main">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menaxhim</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const isActive = location === item.url || 
                  (item.url !== "/" && location.startsWith(item.url));
                
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <Link href={item.url} data-testid={`link-${item.title.toLowerCase()}`}>
                        <item.icon />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}