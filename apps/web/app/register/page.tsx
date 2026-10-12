import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/auth-form";
import { copy } from "@/lib/copy";

export const metadata: Metadata = { title: copy.auth.registerTitle };

export default function RegisterPage() {
  return <RegisterForm />;
}
