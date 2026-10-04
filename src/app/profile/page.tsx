import { updateProfileAction } from "@/app/actions/profile";
import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth";
import { CountrySelect } from "@/components/country-select";
import { sendEmailVerificationAction } from "@/app/actions/email-verification";
import { ProfilePhotoField } from "@/components/profile-photo-field";
import { fieldClass as inputClass, primaryButtonClass } from "@/components/ui";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; updated?: string; notice?: string }>;
}) {
  const [user, params] = await Promise.all([requireUser(), searchParams]);
  return (
    <AppShell>
      <h1 className="text-4xl font-black">Profile</h1>
      <p className="mt-2 text-[#6f626b]">Keep your seller and contact information up to date.</p>

      {params.updated === "1" && (
        <div role="status" className="mt-6 max-w-2xl rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-800">
          Profile updated successfully.
        </div>
      )}

      {params.error && (
        <div role="alert" className="mt-6 max-w-2xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
          {params.error}
        </div>
      )}

      <section className="mt-8 flex max-w-2xl flex-wrap items-center justify-between gap-4 rounded-lg border border-[#eadfdf] bg-white p-5"><div><h2 className="font-bold">Email verification</h2><p className="mt-1 text-sm text-[#6f626b]">{user.emailVerifiedAt ? "Verified" : "Email not verified"}</p>{params.notice === "verification-sent" && <p role="status" className="mt-2 text-sm font-semibold text-green-800">Verification email sent. Check your inbox and spam folder.</p>}{params.notice === "verification-rate-limited" && <p role="status" className="mt-2 text-sm font-semibold text-[#9d334b]">Please wait a minute before requesting another verification email.</p>}{params.notice === "verification-unavailable" && <p role="alert" className="mt-2 text-sm font-semibold text-[#9d334b]">Verification email is not available for this installation yet.</p>}{params.notice === "verification-invalid" && <p role="alert" className="mt-2 text-sm font-semibold text-[#9d334b]">This verification link has expired or was already used.</p>}</div>{user.emailVerifiedAt ? <span className="rounded-lg bg-green-50 px-4 py-3 text-sm font-bold text-green-800">Verified</span> : <form action={sendEmailVerificationAction}><button className="min-h-11 rounded-lg bg-[#20141d] px-4 text-sm font-bold text-white">Send verification email</button></form>}</section>

      <form action={updateProfileAction} className="mt-8 grid max-w-2xl gap-6 rounded-lg border border-[#eadfdf] bg-white p-7">
        <ProfilePhotoField name={user.name} imageUrl={user.imageUrl} />
        <div className="border-t border-[#eadfdf]" />
        <CountrySelect value={user.country} />
        <label className="grid gap-2 text-sm font-bold text-[#20141d]">
          Full name
          <input name="name" className={inputClass} defaultValue={user.name} autoComplete="name" required />
        </label>
        <label className="grid gap-2 text-sm font-bold text-[#20141d]">
          Email
          <input name="email" type="email" className={inputClass} defaultValue={user.email} autoComplete="email" required />
        </label>
        <label className="grid gap-2 text-sm font-bold text-[#20141d]">
          Phone
          <input name="phone" type="tel" className={inputClass} defaultValue={user.phone ?? ""} autoComplete="tel" required />
        </label>
        <label className="grid gap-2 text-sm font-bold text-[#20141d]">
          Location
          <input name="location" className={inputClass} defaultValue={user.location ?? ""} autoComplete="address-level2" required />
        </label>
        <button type="submit" className={primaryButtonClass}>
          Save profile
        </button>
      </form>
    </AppShell>
  );
}
