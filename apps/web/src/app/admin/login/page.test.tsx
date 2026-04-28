import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import AdminLoginPage, { metadata } from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: vi.fn()
  })
}));

describe("Admin login page", () => {
  it("renders email/password sign-in without signup or provisioning controls", () => {
    render(<AdminLoginPage />);

    expect(
      screen.getByRole("heading", {
        name: "Admin sign in"
      })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Sign in"
      })
    ).toBeInTheDocument();
    expect(screen.queryByText(/sign up/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/provision/i)).not.toBeInTheDocument();
  });

  it("marks admin login as noindex and nofollow", () => {
    expect(metadata.robots).toMatchObject({
      follow: false,
      index: false
    });
  });
});
