import { Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { Header } from '@/components/Header';
import { AuthProvider } from '@/components/AuthProvider';
import { Footer } from '@/components/Footer';
import { Toaster } from "@/components/ui/sonner";

const jakartaSans = Plus_Jakarta_Sans({
  variable: "--font-iapteca",
  subsets: ["latin", "cyrillic-ext"],
  weight: ["400", "500", "600", "700"],
  display: 'swap',
});

const geistMono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: 'swap',
});

export const metadata = {
  title: "iApteca",
  description: "Онлайн аптека",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk" className={`${jakartaSans.variable} ${geistMono.variable}`}>
      <body className="antialiased">
        <AuthProvider>
          <Header />
          <a className="skipLink" href="#main-content">Перейти до основного вмісту</a>
          <main id="main-content">{children}</main>
          <Footer />
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
