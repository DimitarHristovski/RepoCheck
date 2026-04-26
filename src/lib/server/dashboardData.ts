import { unstable_noStore as noStore } from "next/cache";
import { getDashboardSnapshot } from "@/lib/store/repository";

export function getDashboardData() {
  noStore();
  return getDashboardSnapshot();
}
