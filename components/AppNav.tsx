'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/dashboard', label: 'Command Center' },
  { href: '/pipeline', label: 'Pipeline' },
  { href: '/territories', label: 'Territories' },
  { href: '/sustainability', label: 'Sustainability' },
  { href: '/pricing', label: 'Pricing' },
];

export default function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1 overflow-x-auto text-xs">
      {links.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`whitespace-nowrap px-2.5 py-1 rounded-md transition-colors ${
              active
                ? 'bg-sky-600 text-white'
                : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
