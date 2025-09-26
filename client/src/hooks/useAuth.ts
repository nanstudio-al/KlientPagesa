// Custom authentication hook for username/password system
import { useQuery } from "@tanstack/react-query";

type AuthUser = {
  id: string;
  username: string;
  role: "admin" | "user";
  email: string | null;
  firstName: string | null;
  lastName: string | null;
};

export function useAuth() {
  const { data: user, isLoading } = useQuery<AuthUser>({
    queryKey: ["/api/auth/me"],
    retry: false,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}