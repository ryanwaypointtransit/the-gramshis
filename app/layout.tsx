import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Gramshis - Grammy Prediction Market",
  description: "Bet on Grammy Awards with friends using fake money",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  );
}
