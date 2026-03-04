import { Button } from "@/components/ui/button";
import Image from "next/image";
import Link from "next/link";
import React from "react";
import { NavBar } from "../shared";
import { Copy, X, MessageCircle, Share2 } from "lucide-react";
import { FaXTwitter } from "react-icons/fa6";
const ProfilePage = () => {
  return (
    <div className="relative flex h-screen w-full flex-col items-center gap-4">
      <BackgroundImage />

      <div className="absolute top-0 left-1/2 z-20 flex h-40 w-full -translate-x-1/2 transform items-center justify-center gap-16 overflow-visible">
        {/* Left Cloud */}
        <Image
          src="/profile/Chain.png"
          alt="Cloud Left"
          width={44}
          height={44}
          className="animate-cloud-left h-full"
        />

        {/* Right Cloud */}
        <Image
          src="/profile/Chain.png"
          alt="Cloud Right"
          width={44}
          height={44}
          className="animate-cloud-left h-full"
        />

        {/* Profile board stays static */}
        <Image
          src="/profile/profile-board.png"
          alt="Profile Board"
          width={44}
          height={44}
          className="animate-cloud-left absolute -bottom-1/2 left-1/2 w-fit -translate-x-1/2 transform"
        />
      </div>

      <div className="relative z-50 mx-auto mt-4 mb-auto block max-sm:w-full">
        <NavBar />
      </div>
      <div className="relative z-20 mt-32 mb-8 w-full px-2 sm:mx-auto sm:mb-16 sm:w-auto sm:px-0">
        <ProfileCard />
      </div>
    </div>
  );
};

export default ProfilePage;

const BackgroundImage = () => {
  return (
    <>
      <div className="fixed inset-0 flex h-[40vh] flex-col">
        <div className="h-[25%] bg-[#39BBE3]"></div>
        <div className="h-[25%] bg-[#6ED2F0]"></div>
        <div className="h-[25%] bg-[#AEE5F5]"></div>
        <div className="h-[25%] bg-[#E9F9FE]"></div>
      </div>
      <div className="fixed inset-0 z-10 max-md:hidden">
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
          className="animate-float-right absolute top-[10%] left-[20%] w-[120px] object-cover"
        />
      </div>
      {/*   GRASS  */}
      <Image
        src="/profile/grass-others.png"
        alt="Profile"
        width={200}
        height={200}
        className="fixed bottom-[44vh] z-10 h-full max-h-[35vh] w-full max-lg:object-cover"
      />
      {/*   BRICK */}
      <Image
        src="/profile/profile-brick.png"
        alt="Profile"
        width={200}
        height={200}
        className="fixed bottom-0 h-full max-h-[57vh] w-full object-cover"
      />
    </>
  );
};

const ProfileCard = () => {
  return (
    <div className="relative flex w-full flex-col items-center p-2 pt-12 sm:w-[500px] sm:p-12 sm:pt-28">
      <Image
        src="/profile/frame-bg.svg"
        alt="Frame"
        width={88}
        height={88}
        className="absolute inset-0 z-0 h-full w-full max-sm:hidden"
      />
      <Image
        src="/profile/mole-left-tillted.svg"
        alt="Frame"
        width={160}
        height={160}
        className="absolute top-[25%] -left-[20%] z-[-1] max-sm:hidden"
      />
      <div className="relative z-10 w-full p-1.5 sm:p-4">
        {/* Player Profile Header */}
        <div className="mb-2 flex items-center sm:mb-4">
          {/* Avatar */}
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border-2 border-white sm:h-24 sm:w-24 sm:border-4">
            <Image
              src="/profile/avatar.png"
              alt="Avatar"
              width={64}
              height={64}
              className="h-12 w-12 sm:h-20 sm:w-20"
            />
          </div>

          {/* Name and XP Panel */}
          <div className="flex flex-1 flex-col rounded-lg border-r-2 border-[#5D2C28]">
            {/* Player Name */}
            <div className="font-family-ThaleahFat w-[80%] border-t-2 border-r-2 border-[#140901] bg-[#5D2C28] pl-2 text-xs font-normal text-white sm:pl-4 sm:text-2xl">
              HIKARU NAKAMOTO
            </div>

            {/* XP Bar */}
            <div className="relative flex h-4 w-full items-center overflow-hidden rounded-r-md border border-[#D9A982] bg-[#FFD595] sm:h-6">
              {/* XP Bar Fill */}
              <div className="relative h-full w-full bg-[#C99C33]">
                {/* Highlight on top */}
                <div className="absolute top-0 h-0.5 w-full bg-[#FFE9B2] sm:h-1"></div>
                {/* XP Text */}
                <span className="font-family-ThaleahFat pl-1 text-[10px] font-normal text-white sm:pl-4 sm:text-xl">
                  XP - 200
                </span>
              </div>
            </div>
          </div>
        </div>
        {/* Wallet Address Section */}
        <div className="bg-wallet-address-profile-bg mb-2 w-full rounded border-4 border-black p-2 sm:mb-4 sm:p-4">
          {/* Wallet Icon and Title */}
          <div className="mb-1 flex items-center gap-1 sm:mb-2 sm:gap-2">
            <Image
              src="/profile/Wallet.png"
              alt="Wallet"
              width={24}
              height={24}
              className="h-4 w-4 sm:h-8 sm:w-8"
            />
            <span className="font-family-ThaleahFat text-peach-300 text-xs font-normal sm:text-2xl">
              WALLET ADDRESS
            </span>
          </div>

          {/* Address with Copy Button */}
          <div className="mb-1 flex flex-wrap items-center justify-between gap-1 sm:mb-2 sm:gap-2">
            <span className="text-peach-300 font-family-ThaleahFat font-base text-xl break-all select-text text-shadow-black">
              0XCOF37237279H29210F9054979
            </span>
            <button className="hover:bg-accent shrink-0 cursor-pointer border-2 border-black p-1 sm:p-2">
              <Copy className="h-3 w-3 text-black sm:h-4 sm:w-4" />
            </button>
          </div>

          {/* Balance */}
          <span className="block text-left text-[10px] font-normal text-white sm:text-base">
            Balance: 0 MOLE
          </span>
        </div>
        {/* Leaderboard Rank */}
        <div className="mb-2 w-full p-1.5 text-center sm:p-3">
          <div className="text-peach-300 font-family-ThaleahFat mb-1 text-left text-base sm:text-3xl">
            LEADERBOARD RANK:
          </div>
          <div className="relative flex w-full flex-col items-stretch gap-2 rounded-lg sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="relative w-full p-2 sm:p-4">
              <Image
                src="/profile/wooden-board.png"
                alt="Rank"
                width={44}
                height={44}
                className="absolute inset-0 z-10 h-full w-full"
              />
              <div className="text-peach-300 relative z-20 text-xs font-semibold sm:text-base">
                CURRENT RANK
              </div>
              <div className="text-peach-300 font-family-ThaleahFat relative z-20 -mt-1 w-full text-center text-base font-thin text-shadow-black sm:-mt-2 sm:text-2xl">
                #2339
              </div>
            </div>
            <div className="relative w-full p-2 sm:p-4">
              <Image
                src="/profile/wooden-board.png"
                alt="Rank"
                width={44}
                height={44}
                className="absolute inset-0 z-10 h-full w-full"
              />
              <div className="text-peach-300 relative z-20 text-xs font-semibold sm:text-base">
                ALL TIME BEST
              </div>
              <div className="text-peach-300 font-family-ThaleahFat relative z-20 -mt-1 w-full text-center text-base font-thin text-shadow-black sm:-mt-2 sm:text-2xl">
                #2339
              </div>
            </div>
          </div>
        </div>

        <div className="flex w-full items-center gap-2 sm:gap-4">
          <button
            type="button"
            className="group relative flex h-6 w-6 cursor-pointer items-center justify-center transition-all hover:scale-105 sm:h-10 sm:w-10"
          >
            <Image
              src="/profile/footer-image.svg"
              alt="Share"
              fill
              className="absolute inset-0 object-contain"
            />
            <Share2 className="text-peach-300 group-hover:text-peach-400 relative z-10 h-4 w-4 transition-colors sm:h-6 sm:w-6" />
          </button>
          <Link
            href="https://twitter.com/moleswap"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative ml-auto flex h-6 w-6 items-center justify-center transition-all hover:scale-105 sm:h-10 sm:w-10"
          >
            <Image
              src="/profile/footer-image.svg"
              alt="Twitter"
              fill
              className="absolute inset-0 object-contain"
            />
            <FaXTwitter className="text-peach-300 group-hover:text-peach-400 relative z-10 h-4 w-4 transition-colors sm:h-6 sm:w-6" />
          </Link>
        </div>
      </div>
    </div>
  );
};
