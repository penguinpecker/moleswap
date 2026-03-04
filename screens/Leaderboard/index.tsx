"use client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, SquareArrowOutUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React, { useState } from "react";
import { NavBar } from "../shared";
const leaderboardData = [
  {
    id: 1,
    name: "Robin",
    score: 28332,
    trophy: "🥇",
    address: "0xc0ffee25472926.....10F9d54979",
  },
  {
    id: 2,
    name: "Tunnel Rat",
    score: 19288,
    trophy: "🥈",
    address: "0xc0ffee25472926.....10F9d54979",
  },
  {
    id: 3,
    name: "Mole master",
    score: 19110,
    trophy: "🥉",
    address: "0xc0ffee25472926.....10F9d54979",
  },
  {
    id: 4,
    name: "Player X",
    score: 18100,
    address: "0xc0ffee25472926.....10F9d54979",
  },
  {
    id: 5,
    name: "KnK",
    score: 11020,
    address: "0xc0ffee25472926.....10F9d54979",
  },
  {
    id: 6,
    name: "Diggy",
    score: 9299,
    address: "0xc0ffee25472926.....10F9d54979",
  },
  {
    id: 7,
    name: "Whoopie",
    score: 9100,
    address: "0xc0ffee25472926.....10F9d54979",
  },
  {
    id: 8,
    name: "Whoopie",
    score: 9100,
    address: "0xc0ffee25472926.....10F9d54979",
  },
];
const LeaderboardPage = () => {
  return (
    <div className="relative flex h-screen w-full flex-col items-center gap-4">
      <BackgroundImage />
      <div className="relative z-50 mx-auto mt-4 mb-auto block max-sm:w-full">
        <NavBar />
      </div>
      <div className="relative z-20 flex w-full flex-1">
        <QuestCardComponent />
      </div>
    </div>
  );
};

export default LeaderboardPage;

const BackgroundImage = () => {
  return (
    <>
      {/* Gradient BRLayers */}
      <div className="fixed inset-0 flex h-full flex-col">
        <Image
          src="/leaderboard/bricks.png"
          alt="Profile"
          width={200}
          height={200}
          className="absolute top-0 z-10 h-full w-full max-lg:object-cover"
        />
      </div>

      {/*   BRICK */}
      <Image
        src="/leaderboard/soil.png"
        alt="Profile"
        width={200}
        height={200}
        className="fixed bottom-0 h-full max-h-[30vh] w-full object-fill"
      />
    </>
  );
};

export const QuestCardComponent = () => {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-2 sm:px-6">
      {/* Header */}
      <div className="relative top-[40px] z-10 mx-auto w-[75%] rounded-lg px-6 py-4 text-center">
        <h1 className="text-peach-300 text-shadow-header font-family-ThaleahFat text-3xl font-bold tracking-widest uppercase sm:text-5xl">
          leaderboard
        </h1>
        <Image
          src="/quest/header-quest-bg.png"
          alt="Profile"
          width={200}
          height={200}
          className="absolute inset-0 left-0 z-[-1] h-full w-full"
        />
      </div>

      {/* Main Leaderboard Section */}
      <div className="relative mb-6 flex h-full px-4">
        <Image
          src="/leaderboard/list-board.png"
          alt="Profile"
          width={200}
          height={200}
          className="absolute inset-0 z-0 h-full w-full object-fill"
        />
        {/* Leaderboard List */}
        <div className="bg-leaderboard relative m-6 mx-auto flex w-full flex-1 flex-col items-center justify-between gap-2 p-4 pt-8">
          {leaderboardData.map((player, index) => {
            // Determine background based on rank
            const bgImage =
              index === 0
                ? "/leaderboard/player-info-board-1.png"
                : index === 1
                  ? "/leaderboard/player-info-board-2.png"
                  : index === 2
                    ? "/leaderboard/player-info-board-3.png"
                    : "/leaderboard/player-info-board.png";

            return (
              <div
                key={player.id}
                className="relative flex w-full max-w-3xl justify-between px-4 py-3 text-white shadow-md max-sm:flex-col sm:items-center"
              >
                <Image
                  src={bgImage}
                  alt={`Player ${index + 1} background`}
                  width={200}
                  height={200}
                  className="absolute inset-0 z-[0] h-full w-full object-fill"
                />

                {/* Left side */}
                <div className="z-10 flex items-center gap-3 overflow-hidden">
                  {player.trophy ? (
                    <div className="relative w-10">
                      <Image
                        src={`/leaderboard/${index + 1}.png`}
                        alt="Trophy"
                        width={60}
                        height={60}
                        className="absolute -top-5 left-0"
                      />
                    </div>
                  ) : (
                    <div className="font-family-ThaleahFat text-leaderboard-rank relative flex h-[40px] w-[40px] items-center justify-center text-2xl">
                      {index + 1}
                      <Image
                        src="/leaderboard/rest.png"
                        alt="Rank background"
                        fill
                        className="absolute inset-0 z-[-1] object-cover"
                      />
                    </div>
                  )}
                  <div className="flex flex-col">
                    <span className="font-family-ThaleahFat text-2xl leading-7">
                      {player.name}
                    </span>
                    <span className="font-family-ThaleahFat text-xl sm:hidden">
                      {player.score}
                    </span>
                    <Link
                      href={"#"}
                      className="text-leaderboard-text font-mono text-sm break-all"
                    >
                      {player.address}{" "}
                      <SquareArrowOutUpRight
                        size={14}
                        className="inline text-sm"
                      />
                    </Link>
                  </div>
                </div>

                {/* Divider lines */}
                <div className="bg-leaderboard before:bg-leaderboard relative mr-auto ml-6 h-full w-[4px] before:absolute before:top-0 before:left-0 before:h-[1px] before:w-full before:content-['']" />
                <div className="bg-leaderboard before:bg-leaderboard relative mr-6 ml-auto h-full w-[4px] before:absolute before:top-0 before:left-0 before:h-[1px] before:w-full before:content-['']" />

                {/* Right side */}
                <span className="font-family-ThaleahFat z-10 text-3xl max-sm:hidden">
                  {player.score}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
