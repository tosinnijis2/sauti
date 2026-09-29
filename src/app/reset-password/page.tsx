import Link from "next/link";
import { resetPassword } from "@/app/actions/recovery";
export const metadata = { referrer: "no-referrer" as const };
export default async function ResetPassword({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const query = await searchParams;
  return <main className="grid min-h-screen place-items-center bg-[#20141d] p-6"><section className="w-full max-w-md rounded-lg bg-white p-8">
    <h1 className="text-2xl font-bold">Reset password</h1>
    {query.error && <p role="alert" className="my-4 text-red-700">{query.error}</p>}
    {query.token ? <form action={resetPassword} className="my-6 grid gap-4">
      <input type="hidden" name="token" value={query.token} />
      <label className="grid gap-2">New password<input className="rounded-lg border p-3" name="password" type="password" autoComplete="new-password" minLength={8} required /></label>
      <label className="grid gap-2">Confirm password<input className="rounded-lg border p-3" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required /></label>
      <button className="rounded-lg bg-[#20141d] p-3 font-bold text-white">Reset password</button>
    </form> : <Link href="/forgot-password" className="my-4 block underline">Request a new link</Link>}
    <Link href="/login" className="underline">Back to sign in</Link>
  </section></main>;
}
