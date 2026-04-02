import type React from "react";
import type { Metadata } from "next";
import "./globals.css";
import { ConditionalFooter } from "@/components/ConditionalFooter";
import { PushChainWalletProvider } from "@/lib/pushchain/provider";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.moleswap.com";

export const metadata: Metadata = {
  title: "MoleSwap - Decentralized Swap Game",
  description:
    "A pixel-art themed decentralized application for token swapping with gamification elements. Powered by PushChain.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "MoleSwap - Decentralized Swap Game",
    description: "Swap tokens, earn XP, climb the leaderboard. Powered by PushChain universal blockchain.",
    images: [
      {
        url: `${siteUrl}/mole-card.webp`,
        width: 1200,
        height: 630,
        alt: "MoleSwap Game Card",
      },
    ],
    type: "website",
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title: "MoleSwap - Decentralized Swap Game",
    description: "Swap tokens, earn XP, climb the leaderboard. Powered by PushChain.",
    images: [`${siteUrl}/mole-card.webp`],
    creator: "@moleswap",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="custom-scrollbar">
        <PushChainWalletProvider network="testnet">
          <div className="flex min-h-screen flex-col">
            <main className="flex-1">{children}</main>
            <ConditionalFooter />
          </div>
        </PushChainWalletProvider>
      </body>
    </html>
  );
}
