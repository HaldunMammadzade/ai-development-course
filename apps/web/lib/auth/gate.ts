export function appGate(user: { emailVerified: boolean } | null): "login" | "verify" | "app" {
  if (user === null) {
    return "login";
  }
  if (!user.emailVerified) {
    return "verify";
  }
  return "app";
}
