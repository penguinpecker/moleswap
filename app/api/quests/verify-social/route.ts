import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { userId, questId } = await req.json();
    if (!userId || !questId) {
      return NextResponse.json({ error: "Missing userId or questId" }, { status: 400 });
    }

    const { data: quest } = await supabase
      .from("quests")
      .select("*")
      .eq("id", questId)
      .eq("category", "social")
      .eq("is_active", true)
      .single();

    if (!quest) {
      return NextResponse.json({ error: "Quest not found or not a social quest" }, { status: 404 });
    }

    const { data: existing } = await supabase
      .from("user_quests")
      .select("*")
      .eq("user_id", userId)
      .eq("quest_id", questId)
      .single();

    if (existing?.is_completed) {
      return NextResponse.json({ error: "Quest already completed" }, { status: 400 });
    }

    if (existing) {
      await supabase
        .from("user_quests")
        .update({ progress: 1, is_completed: true, completed_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("quest_id", questId);
    } else {
      await supabase.from("user_quests").insert({
        user_id: userId,
        quest_id: questId,
        progress: 1,
        is_completed: true,
        completed_at: new Date().toISOString(),
      });
    }

    await supabase.rpc("add_xp_to_user", { p_user_id: userId, p_xp: quest.xp_reward }).catch(() => {
      supabase
        .from("profiles")
        .update({ total_xp: supabase.rpc("increment_xp", { row_id: userId, amount: quest.xp_reward }) })
        .eq("id", userId);
    });

    return NextResponse.json({ success: true, xp_earned: quest.xp_reward });
  } catch (err: any) {
    console.error("Social quest verify error:", err);
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}
