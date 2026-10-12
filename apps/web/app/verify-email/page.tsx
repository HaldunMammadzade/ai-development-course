import type { Metadata } from "next";
import { VerifyEmailForm } from "@/components/auth/auth-form";
import { copy } from "@/lib/copy";

export const metadata: Metadata = { title: copy.auth.verifyTitle };

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" && params.token.length > 0 ? params.token : null;
  return <VerifyEmailForm token={token} />;
}
