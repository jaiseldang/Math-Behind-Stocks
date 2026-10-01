/** Stand-in for next/navigation: the current hash route's path. */
import { useRoute } from "./router";

export function usePathname(): string {
  return useRoute().path;
}
