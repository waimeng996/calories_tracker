import Link from 'next/link';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <nav className="flex gap-4 border-b p-4 text-sm">
        <Link href="/">Dashboard</Link>
        <Link href="/log">记录一餐</Link>
        <Link href="/insulin">记录胰岛素</Link>
        <Link href="/history">历史</Link>
      </nav>
      {children}
    </div>
  );
}
