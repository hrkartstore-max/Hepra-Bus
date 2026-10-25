import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "HEPRA BUS | Book your next journey",
    template: "%s | HEPRA BUS",
  },
  description: "Discover intercity bus routes, compare fares, choose seats and manage your HEPRA BUS journey.",
  applicationName: "HEPRA BUS",
  keywords: ["HEPRA BUS", "intercity bus", "bus tickets India", "bus booking"],
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-IN"><body>{children}</body></html>;
}
