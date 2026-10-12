import { redirect } from "next/navigation";
import { isApiError } from "./errors";
import { copy } from "@/lib/copy";

export async function readPageData<T>(load: () => Promise<T>): Promise<T | string> {
  try {
    return await load();
  } catch (error) {
    if (isApiError(error) && error.status === 401) {
      redirect("/login");
    }
    return isApiError(error) ? error.message : copy.errors.generic;
  }
}
