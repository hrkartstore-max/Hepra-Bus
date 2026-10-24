import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "HepraBus — Your journey, simplified", description: "Find buses, compare fares and plan your next journey with HepraBus." };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html>; }