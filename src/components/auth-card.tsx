import Link from "next/link";
import { BarChart3, ShieldCheck, Store } from "lucide-react";
import { CountrySelect } from "./country-select";
import { AuthForm, AuthSubmit } from "./auth-form";
import {
  loginAction,
  registerAction,
} from "@/app/actions/auth";
import { ProfilePhotoField } from "./profile-photo-field";
import { fieldClass } from "./ui";

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

  const inputClass = fieldClass;

  return (
    <main className="min-h-screen bg-[#fffaf8] lg:grid lg:grid-cols-[minmax(360px,.85fr)_minmax(560px,1.15fr)]">
      <aside className="relative hidden min-h-screen overflow-hidden bg-[#20141d] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <Link href="/" className="text-4xl font-black text-[#fe7a7c]">Sauti.</Link>
        <div className="max-w-md py-16"><p className="text-sm font-bold uppercase text-[#fe7a7c]">Local trade, clearer decisions</p><h2 className="mt-4 text-5xl font-black leading-tight">A marketplace built around real conversations and useful prices.</h2><p className="mt-6 text-lg leading-8 text-white/65">Discover local listings, understand asking-price trends, and build a factual trading history.</p><div className="mt-10 grid gap-4">{[[Store, "Buy and sell locally"], [BarChart3, "Compare Sauti asking prices"], [ShieldCheck, "Trade with visible trust signals"]].map(([Icon, label]) => { const Visual = Icon as typeof Store; return <div key={label as string} className="flex items-center gap-4 border-t border-white/10 pt-4"><span className="grid size-11 place-items-center rounded-full bg-[#fe7a7c] text-[#20141d]"><Visual size={20} /></span><span className="font-semibold">{label as string}</span></div>; })}</div></div>
        <p className="text-sm text-white/45">Marketplace tools for informed local trade.</p>
      </aside>
      <section className={`mx-auto flex min-h-screen w-full max-w-2xl flex-col px-5 py-10 sm:px-10 lg:px-14 ${isLogin ? "justify-center" : "justify-start lg:py-12"}`}>
        <div className="mb-8 lg:hidden"><Link href="/" className="text-3xl font-black text-[#fe7a7c]">Sauti.</Link></div>
        <div className="w-full rounded-lg border border-[#eadfdf] bg-white p-6 shadow-[0_24px_70px_rgba(32,20,29,.08)] sm:p-9">
        <Link
          href="/"
          className="hidden text-3xl font-black text-[#fe7a7c] lg:inline-block"
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
            <ProfilePhotoField name="New Sauti member" />
          )}

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
        </p></div>
      </section>
    </main>
  );
}
