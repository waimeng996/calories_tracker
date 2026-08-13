import type { Metadata } from 'next';
import './globals.css';
import RegisterSW from '@/components/RegisterSW';

export const metadata: Metadata = {
  title: 'Calorie Tracker',
  description: 'Personal calorie and insulin tracker',
  manifest: '/manifest.json',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-white text-gray-900">
        <RegisterSW />
        {children}
      </body>
    </html>
  );
}
