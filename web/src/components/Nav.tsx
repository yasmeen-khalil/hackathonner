"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
const items = [["/", "Home"], ["/discover", "Discover"], ["/profile", "Profile"]] as const;
export default function Nav() {
  const p = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex h-14 items-stretch bg-white md:static md:h-auto md:w-52 md:flex-col md:px-4 md:pt-5">
      <Link href="/" className="hidden pb-5 md:block" aria-label="Hackathonner home"><img src="/brand/wordmark.svg" alt="hackathonner." className="h-7" /></Link>
      {items.map(([href, label]) => {
        const active = href === "/" ? p === "/" || p.startsWith("/h/") : p.startsWith(href);
        return <Link key={href} href={href} className={`flex flex-1 items-center justify-center text-sm md:flex-none md:justify-start md:py-2 ${active ? "font-bold text-[#1A1712] underline decoration-[#1A1712] decoration-2 underline-offset-8" : "text-[#6B6458]"}`}>{label}</Link>;
      })}
      <Link href="/new" className="flex flex-1 items-center justify-center text-sm font-bold text-[#1A1712] md:mt-4 md:flex-none md:justify-center md:rounded-full md:bg-[#EC6699] md:px-4 md:py-2"><span className="md:hidden">Add</span><span className="hidden md:inline">Add a hackathon</span></Link>
    </nav>
  );
}
