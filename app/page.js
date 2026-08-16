"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const GENDER_MATCH_COST = 5;
const RATE_UNLOCK_SECONDS = 30;

const AVATAR_PALETTE = ["#FF3D7F", "#5EEAD4", "#FFB454", "#8C7CF0", "#4ADE80", "#F5C24D", "#60A5FA", "#F97316", "#EC4899", "#34D399"];

function Avatar({ id, size = 36 }) {
  if (!id) {
    return (
      <div style={{ width: size, height: size, borderRadius: "50%", background: "#232532", flexShrink: 0 }} />
    );
  }
  const gender = id[0];
  const idx = (parseInt(id.slice(1), 10) - 1) % AVATAR_PALETTE.length;
  const bg = AVATAR_PALETTE[idx];
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ borderRadius: "50%", flexShrink: 0 }}>
      <circle cx="20" cy="20" r="20" fill={bg} />
      <circle cx="20" cy="23" r="10" fill="#F2C79E" />
      {gender === "f" ? (
        <path d="M5 19 Q20 1 35 19 L35 26 Q20 13 5 26 Z" fill="#3A2417" />
      ) : (
        <path d="M8 17 Q20 4 32 17 L32 20 Q20 10 8 20 Z" fill="#2A1B10" />
      )}
      <circle cx="16" cy="23" r="1.6" fill="#2A2A2A" />
      <circle cx="24" cy="23" r="1.6" fill="#2A2A2A" />
      <path d="M15 28 Q20 31 25 28" stroke="#7A4A33" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

const ICEBREAKERS = [
  "If your life had a theme song right now, what would it be?",
  "What's the last thing that made you laugh out loud?",
  "Beach sunset or mountain sunrise — pick one and defend it.",
  "What's a small thing that instantly makes your day better?",
  "If you could teleport anywhere for the next hour, where?",
  "What's something you're weirdly good at?",
  "Coffee, tea, or neither?",
  "What's a movie you can rewatch endlessly?",
  "What's the most spontaneous thing you've ever done?",
  "If you had a free weekend with zero plans, what would you do?",
  "What's a skill you wish you'd picked up as a kid?",
  "Window seat or aisle seat, and why?",
  "What's your go-to comfort food?",
  "What's a place you've never been but really want to visit?",
  "Early bird or night owl?",
  "What song do you have on repeat lately?",
];
function pickSuggestions() {
  return [...ICEBREAKERS].sort(() => Math.random() - 0.5).slice(0, 4);
}

export default function Home() {
  const [uid, setUid] = useState(null);
  const [profile, setProfile] = useState(null);
  const [screen, setScreen] = useState("loading"); // loading | landing | matching | chat | banned
  const [error, setError] = useState("");

  // landing / signup form
  const [username, setUsername] = useState("");
  const [gender, setGender] = useState("male");
  const [avatarId, setAvatarId] = useState("m1");
  const [genderFilter, setGenderFilter] = useState("any");

  // chat
  const [sessionId, setSessionId] = useState(null);
  const [partner, setPartner] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [streak, setStreak] = useState(0);
  const [chatStartedAt, setChatStartedAt] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [ratingHover, setRatingHover] = useState(0);
  const [partnerLeft, setPartnerLeft] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const messagesEndRef = useRef(null);

  const restrictedFromGender = profile && profile.rating < 2;

  function pickGender(g) {
    setGender(g);
    setAvatarId(`${g[0]}1`);
  }

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

      if (existingProfile) {
        setProfile(existingProfile);
        if (existingProfile.banned_until && new Date(existingProfile.banned_until) > new Date()) {
          setScreen("banned");
          return;
        }
      }
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
      .insert({ id: uid, username, gender, avatar_id: avatarId })
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
  // 3. Matching: check ban, spend coins if needed, then pair
  // -------------------------------------------------------------------
  async function startMatching(freshProfile) {
    setError("");
    const currentProfile = freshProfile || profile;

    if (currentProfile?.banned_until && new Date(currentProfile.banned_until) > new Date()) {
      setScreen("banned");
      return;
    }

    if (genderFilter !== "any") {
      if (currentProfile && currentProfile.rating < 2) {
        setError("Your rating is below 2★ — specific-gender matching is locked right now.");
        return;
      }
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
      if (error.message.includes("banned_until")) {
        setScreen("banned");
      } else {
        setError(error.message);
        setScreen("landing");
      }
      return;
    }
    if (newSessionId) {
      await enterSession(newSessionId);
    }
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
          if (row.user_a === uid || row.user_b === uid) enterSession(row.id);
        }
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [screen, uid]);

  async function enterSession(id) {
    const { data: session } = await supabase.from("chat_sessions").select("*").eq("id", id).single();
    if (!session) return;
    const partnerId = session.user_a === uid ? session.user_b : session.user_a;
    const { data: partnerProfile } = await supabase.from("profiles").select("*").eq("id", partnerId).single();

    setSessionId(id);
    setPartner(partnerProfile);
    setMessages([]);
    setStreak(0);
    setPartnerLeft(false);
    setChatStartedAt(Date.now());
    setElapsed(0);
    setSuggestions(pickSuggestions());
    setScreen("chat");
  }

  // -------------------------------------------------------------------
  // 4. Chat: realtime messages, the rating-unlock timer, and detecting
  //    when the other person leaves or skips to someone new
  // -------------------------------------------------------------------
  useEffect(() => {
    if (screen !== "chat" || !sessionId) return;

    supabase
      .from("messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("created_at", { ascending: true })
      .then(({ data }) => setMessages(data || []));

    const messagesChannel = supabase
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

    const sessionChannel = supabase
      .channel(`session-status-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_sessions", filter: `id=eq.${sessionId}` },
        (payload) => {
          if (payload.new.ended_at) setPartnerLeft(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(sessionChannel);
    };
  }, [screen, sessionId, uid]);

  useEffect(() => {
    if (screen !== "chat" || !chatStartedAt) return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - chatStartedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, [screen, chatStartedAt]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    if (!draft.trim() || streak >= 6 || partnerLeft) return;
    const { error } = await supabase
      .from("messages")
      .insert({ session_id: sessionId, sender_id: uid, body: draft.trim() });
    if (!error) {
      setDraft("");
      setStreak((s) => s + 1);
    }
  }

  // -------------------------------------------------------------------
  // 5. Next / rating
  // -------------------------------------------------------------------
  function requestNext() {
    if (elapsed >= RATE_UNLOCK_SECONDS) setShowRatingModal(true);
    else proceedNext();
  }

  async function proceedNext() {
    if (sessionId) await supabase.rpc("end_session", { p_session_id: sessionId });
    setSessionId(null);
    setPartner(null);
    setShowRatingModal(false);
    await startMatching();
  }

  async function submitRating(stars) {
    if (sessionId) {
      const { error } = await supabase.rpc("submit_rating", { p_session_id: sessionId, p_stars: stars });
      if (!error) setProfile((p) => ({ ...p, coins: Math.min(50, p.coins + 1) }));
    }
    await proceedNext();
  }

  async function goHome() {
    if (sessionId) await supabase.rpc("end_session", { p_session_id: sessionId });
    if (screen === "matching") await supabase.rpc("leave_queue");
    setSessionId(null);
    setPartner(null);
    setScreen("landing");
  }

  function timeRemaining(untilIso) {
    const ms = new Date(untilIso).getTime() - Date.now();
    if (ms <= 0) return "0h 0m";
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}h ${m}m`;
  }

  // -------------------------------------------------------------------
  // UI
  // -------------------------------------------------------------------
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#2E3140] bg-[#1B1D26] overflow-hidden relative">
        {screen === "loading" && (
          <div className="p-10 text-center text-sm text-[#8C8FA3] font-mono">connecting…</div>
        )}

        {screen === "banned" && (
          <div className="p-10 text-center">
            <p className="font-display text-lg">Chat banned for 12 hours</p>
            <p className="text-xs text-[#8C8FA3] mt-2">
              5 different people rated you below 2★. Time remaining:{" "}
              {profile?.banned_until ? timeRemaining(profile.banned_until) : "—"}
            </p>
            <button
              onClick={async () => {
                const { data } = await supabase.from("profiles").select("*").eq("id", uid).single();
                setProfile(data);
                if (!data.banned_until || new Date(data.banned_until) <= new Date()) setScreen("landing");
              }}
              className="mt-5 text-xs font-mono text-[#8C8FA3] underline"
            >
              check again
            </button>
          </div>
        )}

        {screen === "landing" && (
          <div className="p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {profile && <Avatar id={profile.avatar_id} size={38} />}
                <p className="font-display text-2xl leading-tight">
                  Tune in to<br />someone new.
                </p>
              </div>
              <div className="flex flex-col gap-1.5 items-end shrink-0">
                <div className="rounded-full px-3 py-1.5 bg-[#232532] text-xs font-mono whitespace-nowrap">
                  🪙 {profile ? profile.coins : 50}
                </div>
                {profile && (
                  <div
                    className="rounded-full px-3 py-1.5 text-xs font-mono whitespace-nowrap"
                    style={{ background: restrictedFromGender ? "#3A1E22" : "#232532" }}
                  >
                    ⭐ {Number(profile.rating).toFixed(1)}
                  </div>
                )}
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
                    onClick={() => pickGender("male")}
                    className={`flex-1 rounded-lg py-2 text-sm ${gender === "male" ? "bg-[#1E3D38] text-[#5EEAD4]" : "bg-[#232532] text-[#8C8FA3]"}`}
                  >
                    Male
                  </button>
                  <button
                    onClick={() => pickGender("female")}
                    className={`flex-1 rounded-lg py-2 text-sm ${gender === "female" ? "bg-[#1E3D38] text-[#5EEAD4]" : "bg-[#232532] text-[#8C8FA3]"}`}
                  >
                    Female
                  </button>
                </div>

                <p className="text-[10px] font-mono text-[#5C5F70] mt-1">PICK YOUR AVATAR</p>
                <div className="grid grid-cols-5 gap-2">
                  {Array.from({ length: 10 }, (_, i) => `${gender[0]}${i + 1}`).map((id) => (
                    <button
                      key={id}
                      onClick={() => setAvatarId(id)}
                      className="rounded-full p-0.5"
                      style={{ border: `2px solid ${avatarId === id ? "#FF3D7F" : "transparent"}` }}
                    >
                      <Avatar id={id} size={36} />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4">
              <p className="text-xs font-mono text-[#8C8FA3] mb-1.5">MATCH WITH</p>
              <div className="grid grid-cols-3 gap-2">
                {["any", "male", "female"].map((g) => {
                  const locked = g !== "any" && restrictedFromGender;
                  return (
                    <button
                      key={g}
                      onClick={() => !locked && setGenderFilter(g)}
                      className={`rounded-lg py-2.5 flex flex-col items-center gap-0.5 ${genderFilter === g ? "bg-[#5A2438] text-[#FF3D7F]" : "bg-[#232532] text-[#8C8FA3]"}`}
                      style={{ opacity: locked ? 0.5 : 1 }}
                    >
                      <span className="text-sm capitalize">{locked ? "🔒" : g}</span>
                      <span className="text-[10px] font-mono opacity-70">
                        {g === "any" ? "free" : locked ? "rating too low" : `${GENDER_MATCH_COST} coins`}
                      </span>
                    </button>
                  );
                })}
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
                <Avatar id={partner.avatar_id} size={32} />
                <p className="font-display text-sm">{partner.username}</p>
              </div>
              <button onClick={requestNext} className="p-2 rounded-lg bg-[#232532] text-xs">
                next
              </button>
            </div>

            <div
              className="px-5 py-1.5 text-xs font-mono"
              style={{
                background: elapsed >= RATE_UNLOCK_SECONDS ? "#1E3D38" : "#232532",
                color: elapsed >= RATE_UNLOCK_SECONDS ? "#5EEAD4" : "#5C5F70",
              }}
            >
              {elapsed >= RATE_UNLOCK_SECONDS
                ? "Rating unlocked for this chat"
                : `Rating unlocks in ${RATE_UNLOCK_SECONDS - elapsed}s`}
            </div>

            {partnerLeft && (
              <div className="px-5 py-2 text-xs font-mono bg-[#3A1E22] text-[#FF5C5C] flex items-center justify-between">
                <span>{partner.username} has left the chat</span>
                <button onClick={requestNext} className="underline shrink-0 ml-2">
                  find next
                </button>
              </div>
            )}

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

            {streak >= 6 && !partnerLeft && (
              <div className="px-5 py-1.5 text-xs font-mono bg-[#3A1E22] text-[#FF5C5C]">
                6 messages sent — wait for a reply
              </div>
            )}

            {messages.length < 3 && !partnerLeft && (
              <div className="px-4 pt-2">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-mono text-[#5C5F70]">NEED AN OPENER?</span>
                  <button
                    onClick={() => setSuggestions(pickSuggestions())}
                    className="text-[10px] font-mono text-[#5EEAD4]"
                  >
                    shuffle
                  </button>
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => setDraft(s)}
                      className="shrink-0 rounded-full px-3 py-1.5 text-[11px] whitespace-nowrap bg-[#232532] border border-[#2E3140]"
                      style={{ maxWidth: 220 }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="px-4 py-3 flex gap-2 border-t border-[#2E3140]">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                disabled={streak >= 6 || partnerLeft}
                placeholder={partnerLeft ? "They've left this chat" : "Type a message"}
                className="flex-1 rounded-lg px-3 py-2.5 bg-[#232532] text-sm outline-none"
              />
              <button
                onClick={sendMessage}
                disabled={streak >= 6 || partnerLeft}
                className="px-4 rounded-lg bg-[#FF3D7F] text-[#1A0810] text-sm font-display"
              >
                Send
              </button>
            </div>
          </div>
        )}

        {showRatingModal && (
          <div className="absolute inset-0 z-10 flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,0.7)" }}>
            <div className="w-full rounded-2xl p-6 text-center bg-[#1B1D26] border border-[#2E3140]">
              <p className="font-display text-base">How was chatting with {partner?.username}?</p>
              <div className="flex justify-center gap-1 mt-4">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onMouseEnter={() => setRatingHover(n)} onMouseLeave={() => setRatingHover(0)} onClick={() => submitRating(n)}>
                    <span style={{ fontSize: 28, color: n <= ratingHover ? "#FFB454" : "#5C5F70" }}>★</span>
                  </button>
                ))}
              </div>
              <p className="text-[11px] font-mono mt-3 text-[#5C5F70]">
                5 low ratings (under 2★) from different people triggers a 12h ban.
              </p>
              <button onClick={proceedNext} className="mt-3 text-xs font-mono underline text-[#5C5F70]">
                skip rating, go to next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
