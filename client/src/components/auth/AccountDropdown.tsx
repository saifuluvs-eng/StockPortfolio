import { useAuth } from "@/auth/AuthContext";
import { supabase } from "@/lib/supabase";
import { queryClient } from "@/main";
import { useLocation } from "wouter";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { User } from "lucide-react";

export default function AccountDropdown() {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();

  if (loading) {
    return <button className="p-2 rounded-lg hover:bg-foreground/10 disabled">…</button>;
  }

  if (!user) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="p-2 rounded-lg hover:bg-foreground/10 transition-colors flex items-center justify-center">
            <User size={20} className="text-foreground" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onClick={() => navigate("/account?mode=login")}>
            Sign in
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigate("/account?mode=signup")}>
            Sign up
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="p-2 rounded-lg hover:bg-foreground/10 transition-colors flex items-center justify-center">
          <User size={20} className="text-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem onClick={() => navigate("/account")}>
          Account
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={async () => {
            await supabase.auth.signOut();
            queryClient.clear();
            try {
              localStorage.removeItem("ctp_watchlist");
              localStorage.removeItem("ctp_filters");
            } catch {}
            window.location.replace("/#/dashboard");
          }}
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
