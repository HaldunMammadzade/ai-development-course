import { cookies } from "next/headers";
import { apiGet } from "@/lib/api/client";

export async function loadAdmin(path: string): Promise<unknown> {
  return apiGet(path, await cookieHeader());
}

async function cookieHeader(): Promise<string> {
  const jar = await cookies();
  return jar
    .getAll()
    .map((item) => `${item.name}=${item.value}`)
    .join("; ");
}

export function adminWindow(value: string | undefined): "today" | "7d" | "30d" {
  return value === "today" || value === "30d" ? value : "7d";
}
