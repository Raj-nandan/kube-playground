import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Kube Playground - Live Scaling Dashboard',
  description: 'Hands-on Kubernetes microservices autoscaling and observability dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#090d16] text-[#f0f6fc] antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}

