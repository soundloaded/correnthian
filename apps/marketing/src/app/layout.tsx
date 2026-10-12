import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Correnthian — Gold you own outright",
  description:
    "Self-custodial tokenized gold: holding, backing and exit you can verify, fees stated up front.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
