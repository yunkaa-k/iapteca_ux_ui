import localFont from "next/font/local";
import "./globals.css";
import { Header } from '@/components/Header';
import { AuthProvider } from '@/components/AuthProvider';
import { Footer } from '@/components/Footer';
import { Toaster } from "@/components/ui/sonner";

const manrope = localFont({
  src: "./fonts/Manrope-Variable.ttf",
  variable: "--font-iapteca",
  weight: "400 700",
  style: "normal",
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
    <html lang="uk" className={manrope.variable}>
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
