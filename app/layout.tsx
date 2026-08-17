import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Homework Bridge",
  description:
    "Helps parents who don't read English help with their child's homework — by showing the school's method next to the method they learned back home.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
