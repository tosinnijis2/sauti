import Link from "next/link";
import { CountrySelect } from "./country-select";
import { AuthForm, AuthSubmit } from "./auth-form";
import {
  loginAction,
  registerAction,
} from "@/app/actions/auth";

type AuthCardProps = {
  mode: "login" | "register";
  error?: string;
  success?: string;
  defaultEmail?: string;
  returnTo?: string;
  notice?: string;
};

export function AuthCard({
  mode,
  error,
  success,
  defaultEmail,
  returnTo,
  notice,
}: AuthCardProps) {
  const isLogin = mode === "login";

  const inputClass =
    "rounded-xl border border-[#eadfdf] px-4 py-3 outline-none transition focus:border-[#fe7a7c]";

  return (
    <main className="grid min-h-screen place-items-center bg-[#20141d] px-6 py-12">
      <section className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
        <Link
          href="/"
          className="text-3xl font-black text-[#fe7a7c]"
        >
          Sauti.
        </Link>

        <h1 className="mt-8 text-3xl font-bold text-[#20141d]">
          {isLogin ? "Welcome back" : "Create your account"}
        </h1>

        <p className="mt-2 text-sm text-[#6f626b]">
          {isLogin
            ? "Sign in to manage your marketplace activity."
            : "Start listing products and comparing market prices."}
        </p>

        {success && (
          <div
            role="status"
            className="mt-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800"
          >
            {success}
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
          >
            {error}
          </div>
        )}

        <AuthForm
          mode={mode}
          error={error}
          action={isLogin ? loginAction : registerAction}
        >
          {isLogin && <input type="hidden" name="next" value={returnTo ?? "/dashboard"} />}
          {notice && <p role="status" className="text-sm text-[#47715f]">{notice}</p>}
          {!isLogin && (
            <label className="grid gap-2 text-sm font-bold text-[#20141d]">
              Full name
              <input
                name="name"
                type="text"
                className={inputClass}
                autoComplete="name"
                maxLength={100}
                required
              />
            </label>
          )}

          {!isLogin && (
            <label className="grid gap-2 text-sm font-bold text-[#20141d]">
              Phone
              <input
                name="phone"
                type="tel"
                className={inputClass}
                autoComplete="tel"
                maxLength={30}
                required
              />
            </label>
          )}

          <label className="grid gap-2 text-sm font-bold text-[#20141d]">
            Email
            <input
              name="email"
              type="email"
              className={inputClass}
              autoComplete="email"
              defaultValue={isLogin ? defaultEmail : undefined}
              maxLength={254}
              required
            />
          </label>

          <label className="grid gap-2 text-sm font-bold text-[#20141d]">
            Password
            <input
              name="password"
              type="password"
              className={inputClass}
              autoComplete={isLogin ? "current-password" : "new-password"}
              minLength={isLogin ? undefined : 8}
              required
            />
          </label>

          {!isLogin && (
            <label className="grid gap-2 text-sm font-bold text-[#20141d]">
              Confirm password
              <input
                name="confirmPassword"
                type="password"
                className={inputClass}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>
          )}

          {!isLogin && (
            <label className="grid gap-2 text-sm font-bold text-[#20141d]">
              Location
              <input
                name="location"
                type="text"
                className={inputClass}
                autoComplete="address-level2"
                maxLength={120}
                required
              />
            </label>
          )}

          {!isLogin && <CountrySelect />}
          <AuthSubmit login={isLogin} />
          {isLogin && <Link href="/forgot-password" className="text-center text-sm underline">Forgot password?</Link>}
        </AuthForm>

        <p className="mt-6 text-center text-sm text-[#6f626b]">
          {isLogin
            ? "New to Sauti? "
            : "Already have an account? "}

          <Link
            href={isLogin ? "/register" : "/login"}
            className="font-bold text-[#20141d] underline"
          >
            {isLogin ? "Create one" : "Sign in"}
          </Link>
        </p>
      </section>
    </main>
  );
}
