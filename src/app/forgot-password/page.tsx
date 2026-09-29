import Link from "next/link";
import { requestReset } from "@/app/actions/recovery";
import { emailIsConfigured } from "@/lib/email";
export default async function ForgotPassword({ searchParams }: { searchParams: Promise<{ sent?: string; error?: string }> }) {
  const query = await searchParams;
  const configured = emailIsConfigured() && Boolean(process.env.APP_URL);
  return <main className="grid min-h-screen place-items-center bg-[#20141d] p-6">
    <section className="w-full max-w-md rounded-lg bg-white p-8">
      <Link href="/" className="text-3xl font-black text-[#fe7a7c]">Sauti.</Link>
      <h1 className="my-6 text-2xl font-bold">Forgot password?</h1>
      {query.sent && <p role="status">If an account matches that address, a reset link will be sent. Check your inbox and spam folder.</p>}
      {!configured ? <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Password reset emails are not set up for this Sauti installation yet. Contact the site administrator to restore access.</p> : query.error && <p role="alert" className="text-red-700">{query.error}</p>}
      <form action={requestReset} className="my-6 grid gap-4">
        <label className="grid gap-2">Email<input className="rounded-lg border p-3" name="email" type="email" autoComplete="email" required /></label>
        <button disabled={!configured} className="rounded-lg bg-[#20141d] p-3 font-bold text-white disabled:opacity-50">Send reset link</button>
      </form>
      <Link className="underline" href="/login">Back to sign in</Link>
    </section>
  </main>;
}
