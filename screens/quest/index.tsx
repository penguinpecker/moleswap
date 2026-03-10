"use client";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import React from "react";
import { useState, useEffect } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { LucideIcon } from "lucide-react";
import { NavBar } from "../shared";
import { getQuests } from "@/lib/supabase/api";
import { getQuestsWithProgress, type QuestWithProgress } from "@/lib/supabase/quests";
import { usePushWalletContext, usePushChainClient, PushUI } from "@pushchain/ui-kit";
import { getOrCreateUser } from "@/lib/supabase/api";

const mockQuests = [
  {
    id: "1",
    image: "/quest/main-quest-1.png",
    alt: "Main Quest 1",
  },
  {
    id: "2",
    image: "/quest/main-quest-2.png",
    alt: "Main Quest 2",
  },
  {
    id: "3",
    image: "/quest/main-quest-3.png",
    alt: "Main Quest 3",
  },
  {
    id: "4",
    image: "/quest/main-quest-4.png",
    alt: "Main Quest 4",
  },
  {
    id: "5",
    image: "/quest/main-quest-5.png",
    alt: "Main Quest 5",
  },
  {
    id: "6",
    image: "/quest/main-quest-6.png",
    alt: "Main Quest 6",
  },
  {
    id: "7",
    image: "/quest/main-quest-7.png",
    alt: "Main Quest 7",
  },
  {
    id: "8",
    image: "/quest/main-quest-8.png",
    alt: "Main Quest 8",
  },
  {
    id: "9",
    image: "/quest/main-quest-9.png",
    alt: "Main Quest 9",
  },
  {
    id: "10",
    image: "/quest/main-quest-10.png",
    alt: "Main Quest 10",
  },
];

interface QuestCardProps {
  icon: LucideIcon;
  title: string;
  xp: number;
  completed?: boolean;
  className?: string;
  onClick?: () => void;
}
const QuestPage = () => {
  return (
    <div className="relative flex min-h-screen w-full flex-col items-center gap-4">
      <BackgroundImage />

      <div className="relative z-50 mx-auto mt-2 block w-full px-2 sm:mt-4 sm:px-4">
        <NavBar />
      </div>
      <div className="relative z-20 flex w-full flex-1">
        <QuestCardComponent />
      </div>
    </div>
  );
};

export default QuestPage;

const BackgroundImage = () => {
  return (
    <>
      {/* Gradient Sky Layers */}
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
          className="animate-float-right absolute top-[10%] left-[40%] w-[120px] object-cover"
        />
      </div>
      {/*   GRASS  */}
      <Image
        src="/profile/Grass.png"
        alt="Profile"
        width={200}
        height={200}
        className="fixed bottom-[35vh] z-10 h-full max-h-[20vh] w-full max-lg:object-cover"
      />
      {/*   BRICK */}
      <Image
        src="/profile/profile-brick.png"
        alt="Profile"
        width={200}
        height={200}
        className="fixed bottom-0 h-full max-h-[50vh] w-full object-cover"
      />
    </>
  );
};

export const QuestCardComponent = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState<"main" | "dapp" | "game">("main");
  const [allQuests, setAllQuests] = useState(mockQuests);
  const [questProgress, setQuestProgress] = useState<Map<string, QuestWithProgress>>(new Map());
  const questsPerPage = 8;

  const walletCtx = usePushWalletContext();
  const { pushChainClient } = usePushChainClient();
  const isConnected = walletCtx?.connectionStatus === PushUI.CONSTANTS.CONNECTION.STATUS.CONNECTED;
  const walletAddress = walletCtx?.universalAccount?.address || pushChainClient?.universal?.account || null;

  useEffect(() => {
    const loadQuests = async () => {
      // Try to get user ID for progress
      let userId: string | null = null;
      if (walletAddress) {
        const user = await getOrCreateUser(walletAddress);
        userId = user?.id || null;
      }

      // Use enhanced API with progress if we have a userId
      const data = userId
        ? await getQuestsWithProgress(userId)
        : await getQuestsWithProgress();

      if (data && data.length > 0) {
        const mapped = data.map((q: any) => ({
          id: q.id,
          image: q.image_url || `/quest/main-quest-${q.sort_order}.png`,
          alt: q.title || `Quest ${q.sort_order}`,
          quest_type: q.quest_type,
          category: q.category || q.quest_type,
          progress: q.progress || 0,
          required_count: q.required_count || 1,
          is_completed: q.is_completed || false,
          is_claimed: q.is_claimed || false,
          xp_reward: q.xp_reward || 0,
          difficulty: q.difficulty || "easy",
          title: q.title,
        }));
        setAllQuests(mapped);

        // Build progress map
        const pMap = new Map<string, QuestWithProgress>();
        data.forEach((q: QuestWithProgress) => pMap.set(q.id, q));
        setQuestProgress(pMap);
      } else {
        // Fallback to basic getQuests
        const basicData = await getQuests();
        if (basicData && basicData.length > 0) {
          const mapped = basicData.map((q: any) => ({
            id: q.id,
            image: q.image_url || `/quest/main-quest-${q.sort_order}.png`,
            alt: q.title || `Quest ${q.sort_order}`,
            quest_type: q.quest_type,
          }));
          setAllQuests(mapped);
        }
      }
    };

    loadQuests().catch(console.error);
  }, [walletAddress]);

  useEffect(() => { setCurrentPage(1); }, [activeTab]);

  const filteredQuests = allQuests.filter((q: any) =>
    !q.quest_type || q.quest_type === activeTab || q.category === activeTab || activeTab === "main"
  );

  const totalPages = Math.ceil(filteredQuests.length / questsPerPage);

  const startIndex = (currentPage - 1) * questsPerPage;
  const currentQuests = filteredQuests.slice(
    startIndex,
    startIndex + questsPerPage,
  );

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  const handleQuestClick = (questId: string) => {
    console.log(`Quest clicked: ${questId}`);
  };
  const tabClass = (tab: string) =>
    `font-family-ThaleahFat text-shadow-black px-4 rounded-full text-xl sm:text-3xl transition-colors duration-150 cursor-pointer ${
      activeTab === tab
        ? "bg-ground-button border-4 border-ground-button-border text-peach-400"
        : "text-gray-400 hover:text-yellow-200"
    }`;
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-2 sm:p-6">
      {/* Header */}
      <div className="relative top-[40px] z-10 mx-auto w-[75%] rounded-lg px-6 py-4 text-center">
        <h1 className="text-peach-300 text-shadow-header font-family-ThaleahFat text-3xl font-bold tracking-widest uppercase sm:text-5xl">
          Quests
        </h1>
        <Image
          src="/quest/header-quest-bg.png"
          alt="Profile"
          width={200}
          height={200}
          className="absolute inset-0 left-0 z-[-1] h-full w-full"
        />
      </div>

      {/* Main Quests Section */}
      <div className="relative mb-6 h-full">
        <Image
          src="/quest/Quest-BG.png"
          alt="Profile"
          width={200}
          height={200}
          className="absolute inset-0 z-0 h-full w-full object-fill"
        />
        <div className="relative z-50 mt-12 block space-x-4 px-4 pt-3 text-center">
          <button
            className={tabClass("main")}
            onClick={() => setActiveTab("main")}
          >
            MAIN QUESTS
          </button>
          <button
            className={tabClass("dapp")}
            onClick={() => setActiveTab("dapp")}
          >
            DAPP QUESTS
          </button>
          <button
            className={tabClass("game")}
            onClick={() => setActiveTab("game")}
          >
            GAME QUESTS
          </button>
        </div>

        {/* Quest Grid */}
        <div className="relative mb-6 grid grid-cols-1 gap-4 p-4 md:grid-cols-2">
          {currentQuests.map((quest: any) => (
            <div key={quest.id} className="group relative cursor-pointer" onClick={() => handleQuestClick(quest.id)}>
              <Image
                src={quest.image}
                alt={quest.alt}
                width={200}
                height={200}
                className={`w-full transition-all ${quest.is_completed ? "brightness-75" : "group-hover:scale-[1.02]"}`}
              />
              {/* Progress overlay */}
              {quest.progress !== undefined && quest.required_count > 1 && !quest.is_completed && (
                <div className="absolute bottom-2 left-2 right-2">
                  <div className="border-ground-button-border rounded border bg-black/70 px-2 py-1">
                    <div className="mb-0.5 flex justify-between">
                      <span className="font-family-ThaleahFat text-[9px] text-gray-300">PROGRESS</span>
                      <span className="font-family-ThaleahFat text-peach-300 text-[9px]">{quest.progress}/{quest.required_count}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded bg-[#281a12]">
                      <div className="h-full rounded bg-gradient-to-r from-[#6DBB3E] to-[#feae34]"
                        style={{ width: `${Math.min(100, (quest.progress / quest.required_count) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              )}
              {/* Completed badge */}
              {quest.is_completed && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <div className="rounded-lg bg-[#6DBB3E]/90 px-4 py-2">
                    <span className="font-family-ThaleahFat text-xl tracking-wider text-white">COMPLETED ✓</span>
                    {quest.xp_reward > 0 && (
                      <p className="font-family-ThaleahFat text-center text-sm text-white/80">+{quest.xp_reward} XP</p>
                    )}
                  </div>
                </div>
              )}
              {/* Difficulty badge */}
              {quest.difficulty && quest.difficulty !== "easy" && (
                <div className="absolute top-2 right-2">
                  <span className={`font-family-ThaleahFat rounded-sm px-1.5 py-0.5 text-[8px] uppercase ${
                    quest.difficulty === "legendary" ? "bg-purple-600 text-white" :
                    quest.difficulty === "hard" ? "bg-red-600 text-white" :
                    "bg-yellow-600 text-white"
                  }`}>
                    {quest.difficulty}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Pagination */}
        <div className="z-30 mb-4 flex flex-col items-center justify-center gap-4">
          <span className="text-peach-400 bg-ground-button z-40 rounded px-3 py-1 text-lg font-bold tracking-wider">
            {currentPage} of {totalPages}
          </span>
          <div className="z-40 flex gap-4">
            <Button
              variant="ghost"
              size="lg"
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              className="text-peach-300 border-ground-button-border bg-ground-button hover:bg-amber-600 hover:text-amber-200"
            >
              <ArrowLeft size={20} className="text-2xl font-bold" />
            </Button>

            <Button
              variant="ghost"
              size="lg"
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="text-peach-300 border-ground-button-border bg-ground-button hover:bg-amber-600 hover:text-amber-200"
            >
              <ArrowRight size={20} className="text-2xl font-bold" />
            </Button>
          </div>
        </div>
        <Image
          src="/quest/mole.gif"
          alt="Profile"
          width={200}
          height={200}
          className="absolute bottom-[-5%] left-[-5%] w-[150px] object-cover max-sm:hidden"
        />
      </div>
    </div>
  );
};
