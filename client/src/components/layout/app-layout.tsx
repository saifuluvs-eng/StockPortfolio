import { Sidebar } from "@/components/layout/sidebar";

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
