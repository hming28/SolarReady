import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "SolarReady Malaysia | Transparent Rooftop Solar Assessment",
  description:
    "AI-assisted, physically grounded rooftop solar feasibility assessment with verifiable scale calibration, geometric panel packing, and TNB financial modeling.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full flex flex-col bg-slate-50 font-sans text-slate-900 antialiased selection:bg-amber-200 selection:text-amber-950 overflow-hidden">
        <Navbar />
        <main className="flex-1 flex flex-col min-h-0 overflow-y-auto">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
