import Link from "next/link";
import { confirmEmailVerificationAction } from "@/app/actions/email-verification";
import { getCurrentUser } from "@/lib/auth";

export const metadata = { referrer: "no-referrer" as const };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const [user, params] = await Promise.all([getCurrentUser(), searchParams]);
  const token = params.token ?? "";
  if (!user) return <main className="grid min-h-screen place-items-center bg-[#20141d] p-6"><section className="w-full max-w-md rounded-lg bg-white p-8"><h1 className="text-2xl font-bold">Sign in to verify your email</h1><p className="mt-3 text-sm text-[#6f626b]">For your security, verify the link while signed in to the Sauti account that requested it.</p><Link href={`/login?next=${encodeURIComponent(`/verify-email?token=${token}`)}`} className="mt-6 inline-flex rounded-lg bg-[#20141d] px-4 py-3 font-bold text-white">Sign in</Link></section></main>;
  return <main className="grid min-h-screen place-items-center bg-[#20141d] p-6"><section className="w-full max-w-md rounded-lg bg-white p-8"><h1 className="text-2xl font-bold">Verify your email</h1><p className="mt-3 text-sm text-[#6f626b]">Confirm that you want to verify {user.email} for this Sauti account.</p>{token ? <form action={confirmEmailVerificationAction} className="mt-6"><input type="hidden" name="token" value={token} /><button className="rounded-lg bg-[#20141d] px-4 py-3 font-bold text-white">Verify email</button></form> : <Link href="/profile" className="mt-6 inline-block underline">Request a new verification link</Link>}</section></main>;
}
