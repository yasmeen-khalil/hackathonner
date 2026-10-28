"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
const items = [["/", "Home"], ["/discover", "Discover"], ["/new", "Add"], ["/profile", "Profile"]] as const;
export default function Nav() {
  const p = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-neutral-200 bg-white md:static md:w-44 md:flex-col md:border-r md:border-t-0">
      <Link href="/" className="hidden px-4 pb-2 pt-5 text-base font-semibold tracking-tight md:block">Hackathonner</Link>
      {items.map(([href, label]) => {
        const active = href === "/" ? p === "/" : p.startsWith(href);
        return <Link key={href} href={href} className={`flex-1 px-4 py-3 text-center text-sm md:text-left ${active ? "font-semibold text-black" : "text-neutral-500"}`}>{label}</Link>;
      })}
    </nav>
  );
}
