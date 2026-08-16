"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const GENDER_MATCH_COST = 5;

export default function Home() {
  const [uid, setUid] = useState(null);
  const [profile, setProfile] = useState(null);
  const [screen, setScreen] = useState("loading"); // loading | landing | matching | chat
  const [error, setError] = useState("");

  // landing form
  const [username, setUsername] = useState("");
  const [gender, setGender] = useState("male");
  const [genderFilter, setGenderFilter] = useState("any");

  // chat
  const [sessionId, setSessionId] = useState(null);
  const [partner, setPartner] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [streak, setStreak] = useState(0);
  const messagesEndRef = useRef(null);

  // -------------------------------------------------------------------
  // 1. Sign in anonymously the first time someone visits
  // -------------------------------------------------------------------
  useEffect(() => {
    async function init() {
      const { data: sessionData } = await supabase.auth.getSession();
      let user = sessionData.session?.user;

      if (!user) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) {
          setError("Couldn't start a session: " + error.message);
          return;
        }
        user = data.user;
      }
      setUid(user.id);

      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (existingProfile) setProfile(existingProfile);
      setScreen("landing");
    }
    init();
  }, []);

  // -------------------------------------------------------------------
  // 2. Landing: create the profile if needed, then start matching
  // -------------------------------------------------------------------
  async function createProfileAndMatch() {
    setError("");
    if (profile) {
      await startMatching();
      return;
    }
    if (!/^[a-zA-Z0-9._-]{3,20}$/.test(username)) {
      setError("Username: 3-20 characters, letters/numbers/dot/dash only.");
      return;
    }
    const { data, error } = await supabase
      .from("profiles")
      .insert({ id: uid, username, gender })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") setError("That username is taken.");
      else setError(error.message);
      return;
    }
    setProfile(data);
    await startMatching(data);
  }

  // -------------------------------------------------------------------
  // 3. Matching: spend coins if needed, then ask the database to pair us
  // -------------------------------------------------------------------
  async function startMatching(freshProfile) {
    setError("");
    const currentProfile = freshProfile || profile;

    if (genderFilter !== "any") {
      if ((currentProfile?.coins ?? 0) < GENDER_MATCH_COST) {
        setError(`Not enough coins. A ${genderFilter} match costs ${GENDER_MATCH_COST} coins.`);
        return;
      }
      const { data: newBalance, error: spendError } = await supabase.rpc("spend_coins", {
        p_amount: GENDER_MATCH_COST,
      });
      if (spendError) {
        setError(`Not enough coins. A ${genderFilter} match costs ${GENDER_MATCH_COST} coins.`);
        return;
      }
      setProfile((p) => ({ ...p, coins: newBalance }));
    }

    setScreen("matching");
    const { data: newSessionId, error } = await supabase.rpc("find_match", {
      p_gender: currentProfile?.gender || gender,
      p_gender_filter: genderFilter,
    });
    if (error) {
      setError(error.message);
      setScreen("landing");
      return;
    }
    if (newSessionId) {
      await enterSession(newSessionId);
    }
    // if null, we're now in the queue — the subscription below catches
    // it once someone else pairs with us
  }

  useEffect(() => {
    if (screen !== "matching" || !uid) return;
    const channel = supabase
      .channel("waiting-for-match")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_sessions" },
        (payload) => {
          const row = payload.new;
          if (row.user_a === uid || row.user_b === uid) {
            enterSession(row.id);
          }
        }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [screen, uid]);

  async function enterSession(id) {
    const { data: session } = await supabase
      .from("chat_sessions")
      .select("*")
      .eq("id", id)
      .single();
    if (!session) return;
    const partnerId = session.user_a === uid ? session.user_b : session.user_a;
    const { data: partnerProfile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", partnerId)
      .single();

    setSessionId(id);
    setPartner(partnerProfile);
    setMessages([]);
    setStreak(0);
    setScreen("chat");
  }

  // -------------------------------------------------------------------
  // 4. Chat: subscribe to new messages for this session in real time
  // -------------------------------------------------------------------
  useEffect(() => {
    if (screen !== "chat" || !sessionId) return;

    supabase
      .from("messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .then(({ data }) => setMessages(data || []));

    const channel = supabase
      .channel(`session-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          setMessages((m) => [...m, payload.new]);
          if (payload.new.sender_id !== uid) setStreak(0);
        }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [screen, sessionId, uid]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    if (!draft.trim() || streak >= 6) return;
    const { error } = await supabase.from("messages").insert({
      session_id: sessionId,
      sender_id: uid,
      body: draft.trim(),
    });
    if (!error) {
      setDraft("");
      setStreak((s) => s + 1);
    }
  }

  async function nextPerson() {
    if (sessionId) await supabase.rpc("end_session", { p_session_id: sessionId });
    setSessionId(null);
    setPartner(null);
    await startMatching();
  }

  async function goHome() {
    if (sessionId) await supabase.rpc("end_session", { p_session_id: sessionId });
    if (screen === "matching") await supabase.rpc("leave_queue");
    setSessionId(null);
    setPartner(null);
    setScreen("landing");
  }

  // -------------------------------------------------------------------
  // UI
  // -------------------------------------------------------------------
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#2E3140] bg-[#1B1D26] overflow-hidden">
        {screen === "loading" && (
          <div className="p-10 text-center text-sm text-[#8C8FA3] font-mono">connecting…</div>
        )}

        {screen === "landing" && (
          <div className="p-6">
            <div className="flex items-center justify-between">
              <p className="font-display text-2xl">Tune in to<br />someone new.</p>
              <div className="rounded-full px-3 py-1.5 bg-[#232532] text-xs font-mono whitespace-nowrap">
                🪙 {profile ? profile.coins : 50}
              </div>
            </div>

            {!profile && (
              <div className="mt-5 flex flex-col gap-3">
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Pick a username"
                  className="rounded-lg px-3 py-2.5 bg-[#232532] text-sm outline-none"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setGender("male")}
                    className={`flex-1 rounded-lg py-2 text-sm ${gender === "male" ? "bg-[#1E3D38] text-[#5EEAD4]" : "bg-[#232532] text-[#8C8FA3]"}`}
                  >
                    Male
                  </button>
                  <button
                    onClick={() => setGender("female")}
                    className={`flex-1 rounded-lg py-2 text-sm ${gender === "female" ? "bg-[#1E3D38] text-[#5EEAD4]" : "bg-[#232532] text-[#8C8FA3]"}`}
                  >
                    Female
                  </button>
                </div>
              </div>
            )}

            <div className="mt-4">
              <p className="text-xs font-mono text-[#8C8FA3] mb-1.5">MATCH WITH</p>
              <div className="grid grid-cols-3 gap-2">
                {["any", "male", "female"].map((g) => (
                  <button
                    key={g}
                    onClick={() => setGenderFilter(g)}
                    className={`rounded-lg py-2.5 flex flex-col items-center gap-0.5 ${genderFilter === g ? "bg-[#5A2438] text-[#FF3D7F]" : "bg-[#232532] text-[#8C8FA3]"}`}
                  >
                    <span className="text-sm capitalize">{g}</span>
                    <span className="text-[10px] font-mono opacity-70">
                      {g === "any" ? "free" : `${GENDER_MATCH_COST} coins`}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-xs font-mono text-[#FF5C5C] mt-3">{error}</p>}

            <button
              onClick={createProfileAndMatch}
              className="w-full mt-5 rounded-xl py-3.5 font-display bg-[#FF3D7F] text-[#1A0810]"
            >
              Start matching
            </button>
          </div>
        )}

        {screen === "matching" && (
          <div className="p-10 text-center">
            <p className="font-display text-lg">Scanning frequencies…</p>
            <p className="text-xs font-mono text-[#8C8FA3] mt-2">filter: {genderFilter}</p>
            <button onClick={goHome} className="mt-6 text-xs font-mono text-[#8C8FA3] underline">
              cancel
            </button>
          </div>
        )}

        {screen === "chat" && partner && (
          <div className="flex flex-col" style={{ height: 480 }}>
            <div className="px-5 py-3 flex items-center justify-between border-b border-[#2E3140]">
              <div className="flex items-center gap-2">
                <button onClick={goHome} className="p-2 rounded-lg bg-[#232532] text-xs">
                  home
                </button>
                <p className="font-display text-sm">{partner.username}</p>
              </div>
              <button onClick={nextPerson} className="p-2 rounded-lg bg-[#232532] text-xs">
                next
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-2">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${
                    m.sender_id === uid ? "self-end bg-[#FF3D7F] text-[#1A0810]" : "self-start bg-[#232532]"
                  }`}
                >
                  {m.body}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {streak >= 6 && (
              <div className="px-5 py-1.5 text-xs font-mono bg-[#3A1E22] text-[#FF5C5C]">
                6 messages sent — wait for a reply
              </div>
            )}

            <div className="px-4 py-3 flex gap-2 border-t border-[#2E3140]">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                disabled={streak >= 6}
                placeholder="Type a message"
                className="flex-1 rounded-lg px-3 py-2.5 bg-[#232532] text-sm outline-none"
              />
              <button
                onClick={sendMessage}
                disabled={streak >= 6}
                className="px-4 rounded-lg bg-[#FF3D7F] text-[#1A0810] text-sm font-display"
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
