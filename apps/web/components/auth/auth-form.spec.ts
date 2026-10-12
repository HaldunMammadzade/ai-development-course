import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { LoginForm, RegisterForm } from "./auth-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => undefined, refresh: () => undefined, replace: () => undefined }),
}));

describe("auth forms", () => {
  it("posts credentials so a submit cannot place the password in the URL", () => {
    for (const form of [createElement(LoginForm), createElement(RegisterForm)]) {
      const markup = renderToStaticMarkup(form);
      expect(markup).toContain('method="post"');
      expect(markup).not.toContain('method="get"');
    }
  });
});
