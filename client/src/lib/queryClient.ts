import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getFirebaseIdToken } from "@/lib/firebase";
import { api } from "@/lib/api";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

async function buildHeaders(data?: unknown): Promise<HeadersInit> {
  const headers: Record<string, string> = {};

  if (data !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const token = await getFirebaseIdToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await api(url, {
    method,
    headers: await buildHeaders(data),
    body: data ? JSON.stringify(data) : undefined,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const token = await getFirebaseIdToken();
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    const [path] = queryKey as [string, ...unknown[]];
    const res = await api(path, { headers });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
