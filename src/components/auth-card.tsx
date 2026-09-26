import Link from "next/link";
import {
  loginAction,
  registerAction,
} from "@/app/actions/auth";

type AuthCardProps = {
  mode: "login" | "register";
  error?: string;
  success?: string;
  defaultEmail?: string;
};

export function AuthCard({
  mode,
  error,
  success,
  defaultEmail,
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

        <form
          action={isLogin ? loginAction : registerAction}
          className="mt-8 grid gap-4"
        >
          {!isLogin && (
            <input
              name="name"
              type="text"
              className={inputClass}
              placeholder="Full name"
              autoComplete="name"
              required
            />
          )}

          {!isLogin && (
            <input
              name="phone"
              type="tel"
              className={inputClass}
              placeholder="Phone number"
              autoComplete="tel"
              required
            />
          )}

          <input
            name="email"
            type="email"
            className={inputClass}
            placeholder="Email address"
            autoComplete="email"
            defaultValue={isLogin ? defaultEmail : undefined}
            required
          />

          <input
            name="password"
            type="password"
            className={inputClass}
            placeholder="Password"
            autoComplete={isLogin ? "current-password" : "new-password"}
            required
          />

          {!isLogin && (
            <input
              name="confirmPassword"
              type="password"
              className={inputClass}
              placeholder="Re-enter password"
              autoComplete="new-password"
              required
            />
          )}

          {!isLogin && (
            <input
              name="location"
              type="text"
              className={inputClass}
              placeholder="Location"
              autoComplete="address-level2"
              required
            />
          )}

          <button
            type="submit"
            className="mt-2 rounded-xl bg-[#20141d] px-4 py-3 font-bold text-white transition hover:bg-[#342330]"
          >
            {isLogin ? "Sign in" : "Create account"}
          </button>
        </form>

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