"use client";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X } from "lucide-react";
import { FaXTwitter } from "react-icons/fa6";
import Lottie from "lottie-react";
import moleAnimation from "@/public/dapp/data-4.json";
export const NavBar = () => {
  const [isOpen, setIsOpen] = useState(false);

  const currentPath = usePathname();

  const linkClass = (path: string) =>
    `cursor-pointer transition-colors ${currentPath === path
      ? "text-yellow-300 underline"
      : "hover:text-yellow-300"
    }`;

  const toggleMenu = () => setIsOpen(!isOpen);
  const router = useRouter();
  return (
    <div className="relative flex w-full items-center justify-center">
      {/* Brown pixel bar */}
      <div className="bg-ground font-family-ThaleahFat relative flex w-full items-center justify-center rounded-lg border-3 border-[#523525] px-4 py-4 text-lg font-medium tracking-wider text-white shadow-[0px_-6px_0px_0px_#523525_inset,0px_7.5px_0px_0px_rgba(255,255,255,0.6)_inset] md:px-12 lg:max-w-5xl lg:justify-between lg:text-2xl">
        {/* Center avatar */}
        <span className="relative flex w-full transition-all lg:hidden">
          <div className="absolute top-1/2 left-[15%] -translate-x-1/2 -translate-y-1/2">
            <div className="border-ground h-20 w-20 overflow-hidden rounded-full border-4 bg-white shadow-[4px_4px_0_#000]">
              <Image
                src="/profile/profile-logo.png"
                alt="Avatar"
                width={80}
                height={80}
                className="h-full w-full object-cover"
              />
            </div>
          </div>
        </span>
        {/* Mobile Menu Button */}
        <button
          onClick={toggleMenu}
          className="z-50 flex cursor-pointer items-center justify-center text-white transition-transform hover:scale-110 lg:hidden"
          aria-label="Toggle menu"
        >
          {isOpen ? <X size={28} /> : <Menu size={28} />}
        </button>

        {/* Desktop Menu - Hidden on mobile */}
        <div className="hidden w-full items-center justify-between lg:flex">
          {/* Left menu */}
          <div className="flex gap-4 md:gap-12">
            <Link href="/dapp" className={linkClass("/dapp")}>
              DAPP
            </Link>
            <Link href="/quests" className={linkClass("/quests")}>
              QUESTS
            </Link>
          </div>

          {/* Center avatar */}
          <span className="relative w-30 transition-all">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
              <div className="border-ground h-20 w-20 overflow-hidden rounded-full border-4 bg-white shadow-[4px_4px_0_#000]">
                <Image
                  src="/profile/profile-logo.png"
                  alt="Avatar"
                  width={80}
                  height={80}
                  className="h-full w-full object-cover"
                // onClick={() => router.push("/profile")}
                />
              </div>
            </div>
          </span>

          {/* Right menu */}
          <div className="flex gap-4 md:gap-12">
            <Link href="/profile" className={linkClass("/profile")}>
              PROFILE
            </Link>
            <Link href="/leaderboard" className={linkClass("/leaderboard")}>
              LEADERBOARD
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      <div
        className={`border-background bg-ground absolute top-full right-2 left-2 mt-2 overflow-hidden rounded-lg border-3 shadow-[4px_4px_0_#000] transition-all duration-300 ease-in-out lg:hidden ${isOpen
          ? "max-h-96 opacity-100"
          : "pointer-events-none max-h-0 opacity-0"
          }`}
      >
        <div className="font-family-ThaleahFat relative !z-[500] flex flex-col gap-1 p-4 text-white">
          <Link
            href="/dapp"
            className={`${linkClass("/dapp")} rounded-lg px-4 py-3 text-center text-2xl transition-all hover:bg-[#523525]`}
            onClick={() => setIsOpen(false)}
          >
            DAPP
          </Link>
          <Link
            href="/quests"
            className={`${linkClass("/quests")} rounded-lg px-4 py-3 text-center text-2xl transition-all hover:bg-[#523525]`}
            onClick={() => setIsOpen(false)}
          >
            QUESTS
          </Link>
          <Link
            href="/profile"
            className={`${linkClass("/profile")} rounded-lg px-4 py-3 text-center text-2xl transition-all hover:bg-[#523525]`}
            onClick={() => setIsOpen(false)}
          >
            PROFILE
          </Link>
          <Link
            href="/leaderboard"
            className={`${linkClass("/leaderboard")} rounded-lg px-4 py-3 text-center text-2xl transition-all hover:bg-[#523525]`}
            onClick={() => setIsOpen(false)}
          >
            LEADERBOARD
          </Link>
        </div>
      </div>
    </div>
  );
};

export const BackgroundImage = ({
  isLoading,
  getMolePosition,
  ref,
}: {
  isLoading?: boolean;
  getMolePosition?: any;
  ref?: any;
}) => {
  return (
    <>
      {/* Gradient Sky Layers */}
      <div className="fixed inset-0 top-0 flex h-[50vh] flex-col">
        <Image
          src="/dapp/sky-dapp.png"
          alt="Profile"
          width={200}
          height={200}
          className="h-full w-full object-fill"
        />
      </div>
      <div className="fixed inset-0 z-0 max-md:hidden">
        {/* clouds right top  */}
        <Image
          src="/profile/c2.png"
          alt="Profile"
          width={200}
          height={200}
          className="animate-float-left absolute top-5 right-25 w-[120px] object-cover"
        />
        {/* clouds Center  */}
        <Image
          src="/profile/c3.png"
          alt="Profile"
          width={200}
          height={200}
          className="animate-float-right absolute top-[10%] left-[40%] w-[120px] object-cover"
        />
      </div>
      {/* Soil / Tunnel */}
      <div className="fixed bottom-0 h-full w-full">
        {/* Static ground image (visible when not loading) */}
        <Image
          src="/dapp/Soil_Grass_Tunnel.svg"
          alt="Ground"
          width={200}
          height={200}
          className={`absolute -bottom-4 w-full object-contain transition-opacity duration-500 sm:-bottom-8`}
        />

        {/* Lottie digging animation (always mounted, visibility toggled) */}
        {/* <Lottie
          lottieRef={ref}
          animationData={moleAnimation}
          loop={isLoading} // Loop while loading (swap in progress)
          autoplay={false}
          className={`absolute bottom-0 w-full object-fill opacity-100 transition-opacity duration-500`}
        /> */}
      </div>
    </>
  );
};

export const Footer = () => {
  const currentYear = new Date().getFullYear();
  const currentPath = usePathname();

  const footerLinkClass = (path: string) =>
    `font-family-ThaleahFat cursor-pointer text-xl transition-colors sm:text-2xl ${currentPath === path
      ? "text-peach-300"
      : "text-peach-300/80 hover:text-peach-300"
    }`;

  return (
    <footer className="bg-ground relative z-50 w-full border-t-2 border-[#5D2C28] py-2 sm:py-3">
      <div className="mx-auto w-full max-w-7xl px-4">
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Brand Section */}
          <div className="flex items-center gap-2">
            <Image
              src="/profile/profile-logo.png"
              alt="MoleSwap Logo"
              width={32}
              height={32}
              className="h-10 w-10 sm:h-12 sm:w-12"
            />
            <span className="font-family-ThaleahFat text-peach-300 text-lg font-light sm:text-xl">
              MOLE SWAP
            </span>
          </div>

          {/* Copyright and Links */}
          <div className="flex flex-wrap items-center justify-center gap-3 text-base sm:gap-4 sm:text-lg">
            <p className="font-family-ThaleahFat text-peach-300/60 text-2xl font-light">
              follow us on
            </p>
            {/* Social Links */}
            <div className="flex items-center gap-3">
              <Link
                href="https://twitter.com/moleswap"
                target="_blank"
                rel="noopener noreferrer"
                className="group relative flex h-8 w-8 items-center justify-center transition-all hover:scale-110 sm:h-10 sm:w-10"
              >
                <Image
                  src="/profile/footer-image.svg"
                  alt="Twitter"
                  fill
                  className="absolute inset-0 object-contain"
                />
                <FaXTwitter className="group-hover:text-peach-400 relative z-10 h-4 w-4 text-black transition-colors sm:h-5 sm:w-5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
