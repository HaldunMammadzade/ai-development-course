import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/auth-form";
import { copy } from "@/lib/copy";

export const metadata: Metadata = { title: copy.auth.resetTitle };

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" && params.token.length > 0 ? params.token : null;
  return <ResetPasswordForm token={token} />;
}
