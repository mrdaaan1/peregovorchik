import type { Metadata } from "next";
import { Geist, Unbounded } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
});

// Геометричный, чуть "давящий" display-шрифт — для заголовков, итогов сессии
// и ачивок, где уместна энергия переговорного напряжения, а не нейтральность.
const unbounded = Unbounded({
  variable: "--font-display",
  subsets: ["latin", "cyrillic"],
  weight: ["600", "800"],
});

export const metadata: Metadata = {
  title: "Арена переговоров",
  description: "Симулятор развития навыков деловых переговоров",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ru"
      className={`${geistSans.variable} ${unbounded.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
