import { getDashboardSnapshot } from "@/lib/store/repository";

export function getDashboardData() {
  return getDashboardSnapshot();
}
