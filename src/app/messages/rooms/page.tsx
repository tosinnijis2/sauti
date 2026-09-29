import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { ChatPanel } from "@/components/chat-panel";
import { CountrySelect } from "@/components/country-select";
import { requireUser } from "@/lib/auth";
import { countryName, isCountry } from "@/lib/countries";

export default async function RoomsPage({ searchParams }: { searchParams: Promise<{ country?: string }> }) {
  const user = await requireUser();
  const params = await searchParams;
  const country = params.country ?? user.country ?? "";
  return <AppShell><h1 className="text-3xl font-bold">Country rooms</h1><nav className="my-6 flex gap-6 border-b pb-4"><Link href="/messages">Private conversations</Link><Link href="/messages/rooms" aria-current="page" className="font-bold underline">Country rooms</Link></nav><form className="flex flex-wrap items-end gap-3"><CountrySelect defaultValue={country} /><button className="rounded-lg bg-[#20141d] px-5 py-3 text-white">Join room</button></form>{isCountry(country) && <><h2 className="mt-8 text-xl font-bold">{countryName(country)}</h2><p className="mt-2 text-sm text-[#6f626b]">Public to all signed-in Sauti members. Keep personal contact and payment details private.</p><ChatPanel key={country} userId={user.id} country={country} /></>}</AppShell>;
}
