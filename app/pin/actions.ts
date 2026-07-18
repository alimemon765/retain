"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, AUTH_MAX_AGE, authToken } from "@/lib/auth";

export async function verifyPin(pin: string): Promise<{ error: string } | never> {
  const expected = process.env.APP_PIN;
  if (!expected) redirect("/");
  if (pin !== expected) return { error: "Wrong PIN" };

  const store = await cookies();
  store.set(AUTH_COOKIE, await authToken(expected), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: AUTH_MAX_AGE,
    path: "/",
  });
  redirect("/");
}
