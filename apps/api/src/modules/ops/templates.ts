export type EmailTemplateName =
  | "verification"
  | "password_reset"
  | "subscription_activated"
  | "payment_failed"
  | "subscription_canceled";

export function renderEmail(input: {
  template: EmailTemplateName;
  publicUrl: string;
  token?: string;
}): { subject: string; text: string } | null {
  if (input.template === "verification" || input.template === "password_reset") {
    if (input.token === undefined) {
      return null;
    }
    const path = input.template === "verification" ? "/verify-email" : "/reset-password";
    const link = actionLink(input.publicUrl, path, input.token);
    if (link === null) {
      return null;
    }
    if (input.template === "verification") {
      return {
        subject: "E-poçtunuzu təsdiqləyin",
        text: `Hesabınızı təsdiqləmək üçün bu keçidi açın:\n${link}\nKeçid bir dəfə istifadə olunur və 24 saat etibarlıdır.`,
      };
    }
    return {
      subject: "Parolun bərpası",
      text: `Parolu yeniləmək üçün bu keçidi açın:\n${link}\nKeçid bir dəfə istifadə olunur və 1 saat etibarlıdır.`,
    };
  }
  if (input.template === "subscription_activated") {
    return {
      subject: "Abunəlik aktivdir",
      text: "Ödəniş qəbul olundu və abunəliyiniz aktivdir.",
    };
  }
  if (input.template === "payment_failed") {
    return {
      subject: "Ödəniş alınmadı",
      text: "Son ödəniş alınmadı. Abunəlik dövrün sonuna qədər davam edə bilər.",
    };
  }
  return {
    subject: "Abunəlik ləğv edildi",
    text: "Abunəlik dövrün sonunda dayandırılacaq. Öyrənmə tarixçəniz qalır.",
  };
}

function actionLink(publicUrl: string, path: string, token: string): string | null {
  let base: URL;
  try {
    base = new URL(publicUrl);
  } catch {
    return null;
  }
  if (base.username.length > 0 || base.password.length > 0) {
    return null;
  }
  if (base.protocol !== "https:" && base.protocol !== "http:") {
    return null;
  }
  const link = new URL(path, base);
  link.searchParams.set("token", token);
  return link.toString();
}
