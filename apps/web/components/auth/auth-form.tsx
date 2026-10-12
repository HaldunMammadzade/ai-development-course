"use client";

import type { FormEvent, ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { RegisteredStudent } from "@platform/types";
import { Button } from "@/components/ui/button";
import { ApiError, isApiError, loginFailureMessage } from "@/lib/api/errors";
import { apiPost } from "@/lib/api/client";
import { copy } from "@/lib/copy";
import { hasRegistrationIssues, registrationIssues } from "@/lib/auth/registration";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await apiPost("/api/v1/auth/login", { email, password });
      router.push("/app/dashboard");
      router.refresh();
    } catch (caught) {
      setError(isApiError(caught) ? loginFailureMessage(caught) : copy.errors.network);
      setPending(false);
    }
  }

  return (
    <AuthCard title={copy.auth.loginTitle} lead={copy.auth.loginLead}>
      <form className="grid gap-4" method="post" onSubmit={onSubmit} noValidate>
        <Field label={copy.auth.email} name="email">
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label={copy.auth.password} name="password">
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={setPassword}
          />
        </Field>
        {error !== null ? <FormError>{error}</FormError> : null}
        {error === copy.errors.unverified ? (
          <Link
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            href="/verify-email"
          >
            {copy.auth.verifyTitle}
          </Link>
        ) : null}
        <Button type="submit" disabled={pending}>
          {pending ? copy.auth.working : copy.auth.submitLogin}
        </Button>
      </form>
      <Link
        className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
        href="/reset-password"
      >
        {copy.auth.forgot}
      </Link>
      <p className="text-sm text-muted-foreground">
        {copy.auth.noAccount}{" "}
        <Link
          className="font-medium text-foreground underline-offset-4 hover:underline"
          href="/register"
        >
          {copy.auth.goRegister}
        </Link>
      </p>
    </AuthCard>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [issues, setIssues] = useState(registrationIssues({ name: "", email: "", password: "" }));
  const [showIssues, setShowIssues] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextIssues = registrationIssues({ name, email, password });
    setIssues(nextIssues);
    setShowIssues(true);
    if (hasRegistrationIssues(nextIssues)) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/v1/auth/register", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-requested-with": "fetch",
        },
        body: JSON.stringify({
          name,
          email,
          password,
          locale: "az-AZ",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        }),
      });
      if (!response.ok) {
        const code = response.status === 409 ? "CONFLICT" : "VALIDATION";
        throw new ApiError(response.status, code);
      }
      const body = (await response.json()) as RegisteredStudent;
      if (body.emailVerified !== false) {
        throw new ApiError(502, "REQUEST_FAILED");
      }
      const token =
        process.env.NODE_ENV === "development"
          ? response.headers.get("x-development-verification-token")
          : null;
      if (token !== null && token.length > 0) {
        setDevToken(token);
        setPending(false);
        return;
      }
      router.push("/verify-email");
      router.refresh();
    } catch (caught) {
      setError(isApiError(caught) ? caught.message : copy.errors.network);
      setPending(false);
    }
  }

  if (devToken !== null) {
    return <DevVerify token={devToken} />;
  }

  const visible = showIssues ? issues : {};

  return (
    <AuthCard title={copy.auth.registerTitle} lead={copy.auth.registerLead}>
      <form className="grid gap-4" method="post" onSubmit={onSubmit} noValidate>
        <Field label={copy.auth.name} name="name" error={visible.name}>
          <input
            id="name"
            name="name"
            autoComplete="name"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label={copy.auth.email} name="email" error={visible.email}>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label={copy.auth.password} name="password" error={visible.password}>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            value={password}
            onChange={setPassword}
          />
        </Field>
        <ul className="grid gap-1 text-sm text-muted-foreground">
          {copy.auth.passwordRules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ul>
        {error !== null ? <FormError>{error}</FormError> : null}
        <Button type="submit" disabled={pending}>
          {pending ? copy.auth.working : copy.auth.submitRegister}
        </Button>
      </form>
      <p className="text-sm text-muted-foreground">
        {copy.auth.haveAccount}{" "}
        <Link
          className="font-medium text-foreground underline-offset-4 hover:underline"
          href="/login"
        >
          {copy.auth.goLogin}
        </Link>
      </p>
    </AuthCard>
  );
}

export function VerifyEmailForm({ token }: { token: string | null }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function verify(nextToken: string) {
    setPending(true);
    setError(null);
    try {
      await apiPost("/api/v1/auth/verify-email", { token: nextToken });
      setDone(true);
    } catch (caught) {
      setError(isApiError(caught) ? copy.errors.verifyInvalid : copy.errors.network);
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthCard title={copy.auth.verifyTitle} lead={copy.auth.verifyLead}>
      {done ? (
        <p className="text-sm leading-6">{copy.auth.verifyDone}</p>
      ) : (
        <>
          <p className="text-sm leading-6 text-muted-foreground">{copy.auth.verifyWaiting}</p>
          {token !== null ? (
            <Button disabled={pending} onClick={() => void verify(token)}>
              {pending ? copy.auth.working : copy.auth.submitVerify}
            </Button>
          ) : null}
          {error !== null ? <FormError>{error}</FormError> : null}
        </>
      )}
      <Link
        className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
        href="/login"
      >
        {copy.auth.goLogin}
      </Link>
    </AuthCard>
  );
}

export function ResetPasswordForm({ token }: { token: string | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [done, setDone] = useState(false);

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      await apiPost("/api/v1/auth/password-reset/request", { email });
      setAccepted(true);
    } catch (caught) {
      setError(isApiError(caught) ? caught.message : copy.errors.network);
    } finally {
      setPending(false);
    }
  }

  async function confirmReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (token === null) {
      return;
    }
    setPending(true);
    setError(null);
    try {
      await apiPost("/api/v1/auth/password-reset/confirm", { token, password });
      setDone(true);
    } catch (caught) {
      setError(isApiError(caught) ? copy.auth.resetInvalid : copy.errors.network);
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthCard title={copy.auth.resetTitle} lead={copy.auth.resetLead}>
      {done ? (
        <p className="text-sm leading-6">{copy.auth.resetDone}</p>
      ) : token !== null ? (
        <form className="grid gap-4" method="post" onSubmit={confirmReset} noValidate>
          <Field label={copy.auth.password} name="password">
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              value={password}
              onChange={setPassword}
            />
          </Field>
          {error !== null ? <FormError>{error}</FormError> : null}
          <Button type="submit" disabled={pending}>
            {pending ? copy.auth.working : copy.auth.resetSubmit}
          </Button>
        </form>
      ) : accepted ? (
        <p className="text-sm leading-6">{copy.auth.resetAccepted}</p>
      ) : (
        <form className="grid gap-4" method="post" onSubmit={requestReset} noValidate>
          <Field label={copy.auth.email} name="email">
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={inputClass}
            />
          </Field>
          {error !== null ? <FormError>{error}</FormError> : null}
          <Button type="submit" disabled={pending}>
            {pending ? copy.auth.working : copy.auth.resetRequest}
          </Button>
        </form>
      )}
      <Link
        className="text-sm font-medium text-foreground underline-offset-4 hover:underline"
        href="/login"
      >
        {copy.auth.goLogin}
      </Link>
    </AuthCard>
  );
}

function DevVerify({ token }: { token: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function verify() {
    setPending(true);
    try {
      await apiPost("/api/v1/auth/verify-email", { token });
      router.push("/login");
      router.refresh();
    } catch (caught) {
      setError(isApiError(caught) ? copy.errors.verifyInvalid : copy.errors.network);
      setPending(false);
    }
  }

  return (
    <AuthCard title={copy.auth.verifyTitle} lead={copy.auth.verifyDev}>
      {error !== null ? <FormError>{error}</FormError> : null}
      <Button disabled={pending} onClick={() => void verify()}>
        {pending ? copy.auth.working : copy.auth.submitVerify}
      </Button>
    </AuthCard>
  );
}

function AuthCard({ title, lead, children }: { title: string; lead: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-16">
      <p className="text-sm font-semibold tracking-wide text-primary">{copy.product}</p>
      <h1 className="mt-3 font-serif text-4xl tracking-tight">{title}</h1>
      <p className="mt-3 leading-7 text-muted-foreground">{lead}</p>
      <div className="mt-8 grid gap-5 rounded-lg border border-border bg-card p-6">{children}</div>
    </main>
  );
}

function Field({
  label,
  name,
  error,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-medium" htmlFor={name}>
      {label}
      {children}
      {error !== undefined ? <span className="font-normal text-destructive">{error}</span> : null}
    </label>
  );
}

function PasswordInput({
  id,
  name,
  autoComplete,
  value,
  onChange,
}: {
  id: string;
  name: string;
  autoComplete: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="grid gap-2">
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        required
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={inputClass}
      />
      <button
        type="button"
        className="justify-self-start text-xs font-medium text-muted-foreground underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? copy.auth.hidePassword : copy.auth.showPassword}
      </button>
    </div>
  );
}

function FormError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="text-sm text-destructive">
      {children}
    </p>
  );
}

const inputClass =
  "h-11 rounded-md border border-input bg-background px-3 text-base font-normal outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";
