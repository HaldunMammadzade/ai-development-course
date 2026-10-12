import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/auth-form";
import { copy } from "@/lib/copy";

export const metadata: Metadata = { title: copy.auth.loginTitle };

export default function LoginPage() {
  return <LoginForm />;
}
