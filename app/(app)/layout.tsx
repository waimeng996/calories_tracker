import Link from 'next/link';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav className="flex gap-4 border-b p-4 text-sm">
        <Link href="/">Dashboard</Link>
      </nav>
      {children}
    </div>
  );
}
