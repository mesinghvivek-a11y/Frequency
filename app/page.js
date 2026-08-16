"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const RATE_UNLOCK_SECONDS = 30;

const AVATAR_PALETTE = ["#FF3D7F", "#5EEAD4", "#FFB454", "#8C7CF0", "#4ADE80", "#F5C24D", "#60A5FA", "#F97316", "#EC4899", "#34D399"];

function randomAvatarId(gender) {
  const g = gender === "female" ? "f" : "m";
  return `${g}${1 + Math.floor(Math.random() * 10)}`;
}

function Avatar({ id, size = 36 }) {
  if (!id) return <div style={{ width: size, height: size, borderRadius: "50%", background: "#232532", flexShrink: 0 }} />;
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
  const [screen, setScreen] = useState("loading"); // loading | landing | matching | chat | banned | friendChat
  const [homeTab, setHomeTab] = useState("find"); // find | friends
  const [error, setError] = useState("");
  const [settings, setSettings] = useState({ gender_match_cost: 5, initial_coins: 50 });

  // signup form
  const [username, setUsername] = useState("");
  const [gender, setGender] = useState("male");
  const [genderFilter, setGenderFilter] = useState("any");

  // random-match chat
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
  const [matchFriendStatus, setMatchFriendStatus] = useState(null);
  const messagesEndRef = useRef(null);

  // friends
  const [friendSearch, setFriendSearch] = useState("");
  const [friendResults, setFriendResults] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [friendsList, setFriendsList] = useState([]);
  const [friendChatId, setFriendChatId] = useState(null);
  const [friendPartner, setFriendPartner] = useState(null);
  const [friendMessages, setFriendMessages] = useState([]);
  const [friendDraft, setFriendDraft] = useState("");
  const friendMessagesEndRef = useRef(null);

  // owner dashboard
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminStats, setAdminStats] = useState(null);
  const [adminError, setAdminError] = useState("");
  const [adminCostInput, setAdminCostInput] = useState(5);
  const [adminCoinsInput, setAdminCoinsInput] = useState(50);
  const [adminPremiumUsername, setAdminPremiumUsername] = useState("");
  const [adminPremiumDays, setAdminPremiumDays] = useState(30);

  const restrictedFromGender = profile && profile.rating < 2;
  const isPremiumActive = profile?.is_premium && profile?.premium_until && new Date(profile.premium_until) > new Date();

  // -------------------------------------------------------------------
  // 1. Sign in anonymously, load profile + platform settings
  // -------------------------------------------------------------------
  useEffect(() => {
    async function init() {
      const { data: sessionData } = await supabase.auth.getSession();
      let user = sessionData.session?.user;
      if (!user) {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) { setError("Couldn't start a session: " + error.message); return; }
        user = data.user;
      }
      setUid(user.id);

      const { data: settingsRow } = await supabase.from("platform_settings").select("*").single();
      if (settingsRow) setSettings(settingsRow);

      const { data: existingProfile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
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
    if (profile) { await startMatching(); return; }
    if (!/^[a-zA-Z0-9._-]{3,20}$/.test(username)) {
      setError("Username: 3-20 characters, letters/numbers/dot/dash only.");
      return;
    }
    const { data, error } = await supabase
      .from("profiles")
      .insert({ id: uid, username, gender, avatar_id: randomAvatarId(gender), coins: settings.initial_coins })
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
  // 3. Matching — cost + premium bypass are enforced inside find_match
  //    itself; the checks here are just for a fast, friendly error
  //    message before making the round trip.
  // -------------------------------------------------------------------
  async function startMatching(freshProfile) {
    setError("");
    const currentProfile = freshProfile || profile;
    if (currentProfile?.banned_until && new Date(currentProfile.banned_until) > new Date()) {
      setScreen("banned");
      return;
    }
    const premiumNow = currentProfile?.is_premium && currentProfile?.premium_until && new Date(currentProfile.premium_until) > new Date();
    if (genderFilter !== "any" && !premiumNow) {
      if (currentProfile && currentProfile.rating < 2) {
        setError("Your rating is below 2★ — specific-gender matching is locked right now.");
        return;
      }
      if ((currentProfile?.coins ?? 0) < settings.gender_match_cost) {
        setError(`Not enough coins. A ${genderFilter} match costs ${settings.gender_match_cost} coins — or go Premium.`);
        return;
      }
    }
    setScreen("matching");
    const { data: newSessionId, error } = await supabase.rpc("find_match", {
      p_gender: currentProfile?.gender || gender,
      p_gender_filter: genderFilter,
    });
    if (error) {
      if (error.message.includes("banned_until")) setScreen("banned");
      else if (error.message.includes("insufficient_coins")) { setError(`Not enough coins. A ${genderFilter} match costs ${settings.gender_match_cost} coins — or go Premium.`); setScreen("landing"); }
      else if (error.message.includes("rating_too_low")) { setError("Your rating is below 2★ — specific-gender matching is locked right now."); setScreen("landing"); }
      else { setError(error.message); setScreen("landing"); }
      return;
    }
    const { data: refreshed } = await supabase.from("profiles").select("*").eq("id", uid).single();
    if (refreshed) setProfile(refreshed);
    if (newSessionId) await enterSession(newSessionId);
  }

  useEffect(() => {
    if (screen !== "matching" || !uid) return;
    const channel = supabase
      .channel("waiting-for-match")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_sessions" }, (payload) => {
        const row = payload.new;
        if (row.user_a === uid || row.user_b === uid) enterSession(row.id);
      })
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
    setMatchFriendStatus(null);
    setScreen("chat");
  }

  // -------------------------------------------------------------------
  // 4. Random chat: realtime messages, timer, leave detection
  // -------------------------------------------------------------------
  useEffect(() => {
    if (screen !== "chat" || !sessionId) return;
    supabase.from("messages").select("*").eq("session_id", sessionId).order("created_at", { ascending: true })
      .then(({ data }) => setMessages(data || []));

    const messagesChannel = supabase
      .channel(`session-${sessionId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `session_id=eq.${sessionId}` }, (payload) => {
        setMessages((m) => [...m, payload.new]);
        if (payload.new.sender_id !== uid) setStreak(0);
      })
      .subscribe();

    const sessionChannel = supabase
      .channel(`session-status-${sessionId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_sessions", filter: `id=eq.${sessionId}` }, (payload) => {
        if (payload.new.ended_at) setPartnerLeft(true);
      })
      .subscribe();

    return () => { supabase.removeChannel(messagesChannel); supabase.removeChannel(sessionChannel); };
  }, [screen, sessionId, uid]);

  useEffect(() => {
    if (screen !== "chat" || !chatStartedAt) return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - chatStartedAt) / 1000)), 1000);
    return () => clearInterval(id);
  }, [screen, chatStartedAt]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function sendMessage() {
    if (!draft.trim() || streak >= 6 || partnerLeft) return;
    const { error } = await supabase.from("messages").insert({ session_id: sessionId, sender_id: uid, body: draft.trim() });
    if (!error) { setDraft(""); setStreak((s) => s + 1); }
  }

  async function addFriendFromMatch() {
    if (!partner) return;
    const { data, error } = await supabase.rpc("send_friend_request", { p_recipient_id: partner.id });
    if (!error) setMatchFriendStatus(data);
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
    setSessionId(null); setPartner(null); setShowRatingModal(false);
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
    setSessionId(null); setPartner(null);
    setFriendChatId(null); setFriendPartner(null);
    setScreen("landing");
  }

  function timeRemaining(untilIso) {
    const ms = new Date(untilIso).getTime() - Date.now();
    if (ms <= 0) return "0h 0m";
    return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
  }

  // -------------------------------------------------------------------
  // 6. Friends
  // -------------------------------------------------------------------
  async function loadFriendsData() {
    if (!uid) return;
    const { data: incoming } = await supabase
      .from("friend_requests")
      .select("*, requester:requester_id(id, username, avatar_id)")
      .eq("recipient_id", uid)
      .eq("status", "pending");
    setIncomingRequests(incoming || []);

    const { data: chats } = await supabase
      .from("friend_chats")
      .select("*, a:user_a(id, username, avatar_id), b:user_b(id, username, avatar_id)")
      .or(`user_a.eq.${uid},user_b.eq.${uid}`);
    setFriendsList((chats || []).map((c) => ({ chatId: c.id, partner: c.user_a === uid ? c.b : c.a })));
  }

  useEffect(() => {
    if (homeTab !== "friends" || screen !== "landing" || !uid) return;
    loadFriendsData();
    const ch1 = supabase.channel("friend-reqs-in").on("postgres_changes", { event: "*", schema: "public", table: "friend_requests", filter: `recipient_id=eq.${uid}` }, loadFriendsData).subscribe();
    const ch2 = supabase.channel("friend-reqs-out").on("postgres_changes", { event: "*", schema: "public", table: "friend_requests", filter: `requester_id=eq.${uid}` }, loadFriendsData).subscribe();
    return () => { supabase.removeChannel(ch1); supabase.removeChannel(ch2); };
  }, [homeTab, screen, uid]);

  async function searchUsers() {
    const q = friendSearch.trim();
    if (!q) { setFriendResults([]); return; }
    const { data } = await supabase.from("profiles").select("id, username, avatar_id").ilike("username", `%${q}%`).neq("id", uid).limit(10);
    setFriendResults(data || []);
  }
  async function sendRequestTo(recipientId) {
    const { error } = await supabase.rpc("send_friend_request", { p_recipient_id: recipientId });
    if (!error) { searchUsers(); loadFriendsData(); }
  }
  async function respondRequest(requestId, accept) {
    await supabase.rpc("respond_to_friend_request", { p_request_id: requestId, p_accept: accept });
    loadFriendsData();
  }
  async function openFriendChat(chatId, partnerProfile) {
    setFriendChatId(chatId); setFriendPartner(partnerProfile); setFriendMessages([]); setScreen("friendChat");
  }

  useEffect(() => {
    if (screen !== "friendChat" || !friendChatId) return;
    supabase.from("friend_messages").select("*").eq("chat_id", friendChatId).order("created_at", { ascending: true })
      .then(({ data }) => setFriendMessages(data || []));
    const channel = supabase
      .channel(`friend-chat-${friendChatId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "friend_messages", filter: `chat_id=eq.${friendChatId}` }, (payload) => {
        setFriendMessages((m) => [...m, payload.new]);
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [screen, friendChatId]);

  useEffect(() => { friendMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [friendMessages]);

  async function sendFriendMessage() {
    if (!friendDraft.trim()) return;
    const { error } = await supabase.from("friend_messages").insert({ chat_id: friendChatId, sender_id: uid, body: friendDraft.trim() });
    if (!error) setFriendDraft("");
  }

  // -------------------------------------------------------------------
  // 7. Owner dashboard
  // -------------------------------------------------------------------
  async function openAdmin() {
    setAdminError("");
    const { data, error } = await supabase.rpc("admin_stats");
    if (error) { setAdminError("Not authorized, or something went wrong."); return; }
    setAdminStats(data);
    setAdminCostInput(settings.gender_match_cost);
    setAdminCoinsInput(settings.initial_coins);
    setShowAdmin(true);
  }
  async function saveAdminSettings() {
    const { error } = await supabase.rpc("update_platform_settings", {
      p_gender_match_cost: adminCostInput,
      p_initial_coins: adminCoinsInput,
    });
    if (!error) setSettings({ gender_match_cost: adminCostInput, initial_coins: adminCoinsInput });
  }
  async function grantPremium(grant) {
    setAdminError("");
    const { error } = await supabase.rpc("admin_set_premium", {
      p_username: adminPremiumUsername,
      p_premium: grant,
      p_days: adminPremiumDays,
    });
    if (error) setAdminError("Couldn't find that username, or something went wrong.");
    else setAdminPremiumUsername("");
  }

  // -------------------------------------------------------------------
  // UI
  // -------------------------------------------------------------------
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#2E3140] bg-[#1B1D26] overflow-hidden relative">
        {screen === "loading" && <div className="p-10 text-center text-sm text-[#8C8FA3] font-mono">connecting…</div>}

        {screen === "banned" && (
          <div className="p-10 text-center">
            <p className="font-display text-lg">Chat banned for 12 hours</p>
            <p className="text-xs text-[#8C8FA3] mt-2">
              5 different people rated you below 2★. Time remaining: {profile?.banned_until ? timeRemaining(profile.banned_until) : "—"}
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
            <div className="flex gap-4 mb-4 border-b border-[#2E3140]">
              <button onClick={() => setHomeTab("find")} className="pb-2 text-sm font-mono" style={{ color: homeTab === "find" ? "#F0F0EE" : "#5C5F70", borderBottom: homeTab === "find" ? "2px solid #FF3D7F" : "2px solid transparent" }}>Find New</button>
              <button onClick={() => setHomeTab("friends")} className="pb-2 text-sm font-mono flex items-center gap-1.5" style={{ color: homeTab === "friends" ? "#F0F0EE" : "#5C5F70", borderBottom: homeTab === "friends" ? "2px solid #FF3D7F" : "2px solid transparent" }}>
                Friends {incomingRequests.length > 0 && <span className="rounded-full bg-[#FF3D7F] text-[#1A0810] text-[10px] px-1.5">{incomingRequests.length}</span>}
              </button>
              {profile?.is_admin && <button onClick={openAdmin} className="pb-2 text-sm font-mono ml-auto" style={{ color: "#FFD400" }}>Owner ⚙</button>}
            </div>

            {homeTab === "find" && (
              <>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {profile && <Avatar id={profile.avatar_id} size={38} />}
                    <p className="font-display text-2xl leading-tight">Tune in to<br />someone new.</p>
                  </div>
                  <div className="flex flex-col gap-1.5 items-end shrink-0">
                    <div className="rounded-full px-3 py-1.5 bg-[#232532] text-xs font-mono whitespace-nowrap">🪙 {profile ? profile.coins : settings.initial_coins}</div>
                    {profile && (
                      <div className="rounded-full px-3 py-1.5 text-xs font-mono whitespace-nowrap" style={{ background: restrictedFromGender ? "#3A1E22" : "#232532" }}>⭐ {Number(profile.rating).toFixed(1)}</div>
                    )}
                    {isPremiumActive && <div className="rounded-full px-3 py-1.5 text-xs font-mono whitespace-nowrap bg-[#3D3320] text-[#FFD400]">👑 Premium</div>}
                  </div>
                </div>

                {!profile && (
                  <div className="mt-5 flex flex-col gap-3">
                    <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Pick a username" className="rounded-lg px-3 py-2.5 bg-[#232532] text-sm outline-none" />
                    <div className="flex gap-2">
                      <button onClick={() => setGender("male")} className={`flex-1 rounded-lg py-2 text-sm ${gender === "male" ? "bg-[#1E3D38] text-[#5EEAD4]" : "bg-[#232532] text-[#8C8FA3]"}`}>Male</button>
                      <button onClick={() => setGender("female")} className={`flex-1 rounded-lg py-2 text-sm ${gender === "female" ? "bg-[#1E3D38] text-[#5EEAD4]" : "bg-[#232532] text-[#8C8FA3]"}`}>Female</button>
                    </div>
                    <p className="text-[10px] font-mono text-[#5C5F70]">Your avatar will be picked for you — you can change it later.</p>
                  </div>
                )}

                <div className="mt-4">
                  <p className="text-xs font-mono text-[#8C8FA3] mb-1.5">MATCH WITH</p>
                  <div className="grid grid-cols-3 gap-2">
                    {["any", "male", "female"].map((g) => {
                      const locked = g !== "any" && restrictedFromGender;
                      return (
                        <button key={g} onClick={() => !locked && setGenderFilter(g)} className={`rounded-lg py-2.5 flex flex-col items-center gap-0.5 ${genderFilter === g ? "bg-[#5A2438] text-[#FF3D7F]" : "bg-[#232532] text-[#8C8FA3]"}`} style={{ opacity: locked ? 0.5 : 1 }}>
                          <span className="text-sm capitalize">{locked ? "🔒" : g}</span>
                          <span className="text-[10px] font-mono opacity-70">{g === "any" ? "free" : locked ? "rating too low" : isPremiumActive ? "included" : `${settings.gender_match_cost} coins`}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {error && <p className="text-xs font-mono text-[#FF5C5C] mt-3">{error}</p>}

                <button onClick={createProfileAndMatch} className="w-full mt-5 rounded-xl py-3.5 font-display bg-[#FF3D7F] text-[#1A0810]">Start matching</button>
              </>
            )}

            {homeTab === "friends" && (
              <div>
                {!profile ? (
                  <p className="text-sm text-[#8C8FA3]">Make a profile on the Find New tab first.</p>
                ) : (
                  <>
                    <div className="flex gap-1.5">
                      <input value={friendSearch} onChange={(e) => setFriendSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && searchUsers()} placeholder="Find by username" className="flex-1 rounded-lg px-3 py-2.5 bg-[#232532] text-sm outline-none" />
                      <button onClick={searchUsers} className="rounded-lg px-3 bg-[#232532] text-xs font-mono">Search</button>
                    </div>
                    {friendResults.length > 0 && (
                      <div className="mt-3 flex flex-col gap-1.5">
                        {friendResults.map((u) => (
                          <div key={u.id} className="flex items-center justify-between rounded-lg px-3 py-2 bg-[#232532]">
                            <span className="flex items-center gap-2 text-sm"><Avatar id={u.avatar_id} size={26} /> {u.username}</span>
                            <button onClick={() => sendRequestTo(u.id)} className="text-xs font-mono text-[#5EEAD4]">Add friend</button>
                          </div>
                        ))}
                      </div>
                    )}
                    {incomingRequests.length > 0 && (
                      <div className="mt-4">
                        <p className="text-[10px] font-mono text-[#5C5F70] mb-1.5">FRIEND REQUESTS</p>
                        <div className="flex flex-col gap-1.5">
                          {incomingRequests.map((r) => (
                            <div key={r.id} className="flex items-center justify-between rounded-lg px-3 py-2 bg-[#232532]">
                              <span className="flex items-center gap-2 text-sm"><Avatar id={r.requester?.avatar_id} size={26} /> {r.requester?.username}</span>
                              <div className="flex gap-2">
                                <button onClick={() => respondRequest(r.id, false)} className="text-xs font-mono text-[#5C5F70]">Decline</button>
                                <button onClick={() => respondRequest(r.id, true)} className="text-xs font-mono text-[#5EEAD4]">Accept</button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <p className="text-[10px] font-mono text-[#5C5F70] mt-4 mb-1.5">YOUR FRIENDS ({friendsList.length})</p>
                    {friendsList.length === 0 ? (
                      <p className="text-xs font-mono text-[#5C5F70]">No friends yet — search above, or add someone mid-chat.</p>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {friendsList.map((f) => (
                          <button key={f.chatId} onClick={() => openFriendChat(f.chatId, f.partner)} className="flex items-center justify-between rounded-lg px-3 py-2.5 bg-[#232532]">
                            <span className="flex items-center gap-2 text-sm"><Avatar id={f.partner?.avatar_id} size={28} /> {f.partner?.username}</span>
                            <span className="text-[10px] font-mono text-[#5EEAD4]">Chat</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {screen === "matching" && (
          <div className="p-10 text-center">
            <p className="font-display text-lg">Scanning frequencies…</p>
            <p className="text-xs font-mono text-[#8C8FA3] mt-2">filter: {genderFilter}</p>
            <button onClick={goHome} className="mt-6 text-xs font-mono text-[#8C8FA3] underline">cancel</button>
          </div>
        )}

        {screen === "chat" && partner && (
          <div className="flex flex-col" style={{ height: 480 }}>
            <div className="px-5 py-3 flex items-center justify-between border-b border-[#2E3140]">
              <div className="flex items-center gap-2">
                <button onClick={goHome} className="p-2 rounded-lg bg-[#232532] text-xs">home</button>
                <Avatar id={partner.avatar_id} size={32} />
                <p className="font-display text-sm">{partner.username}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={addFriendFromMatch} disabled={!!matchFriendStatus} className="p-2 rounded-lg bg-[#232532] text-xs">
                  {matchFriendStatus === "accepted" || matchFriendStatus === "already_friends" ? "✓ friends" : matchFriendStatus === "pending" ? "requested" : "+ friend"}
                </button>
                <button onClick={requestNext} className="p-2 rounded-lg bg-[#232532] text-xs">next</button>
              </div>
            </div>

            <div className="px-5 py-1.5 text-xs font-mono" style={{ background: elapsed >= RATE_UNLOCK_SECONDS ? "#1E3D38" : "#232532", color: elapsed >= RATE_UNLOCK_SECONDS ? "#5EEAD4" : "#5C5F70" }}>
              {elapsed >= RATE_UNLOCK_SECONDS ? "Rating unlocked for this chat" : `Rating unlocks in ${RATE_UNLOCK_SECONDS - elapsed}s`}
            </div>

            {partnerLeft && (
              <div className="px-5 py-2 text-xs font-mono bg-[#3A1E22] text-[#FF5C5C] flex items-center justify-between">
                <span>{partner.username} has left the chat</span>
                <button onClick={requestNext} className="underline shrink-0 ml-2">find next</button>
              </div>
            )}

            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-2">
              {messages.map((m) => (
                <div key={m.id} className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${m.sender_id === uid ? "self-end bg-[#FF3D7F] text-[#1A0810]" : "self-start bg-[#232532]"}`}>{m.body}</div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {streak >= 6 && !partnerLeft && <div className="px-5 py-1.5 text-xs font-mono bg-[#3A1E22] text-[#FF5C5C]">6 messages sent — wait for a reply</div>}

            {messages.length < 3 && !partnerLeft && (
              <div className="px-4 pt-2">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-mono text-[#5C5F70]">NEED AN OPENER?</span>
                  <button onClick={() => setSuggestions(pickSuggestions())} className="text-[10px] font-mono text-[#5EEAD4]">shuffle</button>
                </div>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {suggestions.map((s, i) => (
                    <button key={i} onClick={() => setDraft(s)} className="shrink-0 rounded-full px-3 py-1.5 text-[11px] whitespace-nowrap bg-[#232532] border border-[#2E3140]" style={{ maxWidth: 220 }}>{s}</button>
                  ))}
                </div>
              </div>
            )}

            <div className="px-4 py-3 flex gap-2 border-t border-[#2E3140]">
              <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendMessage()} disabled={streak >= 6 || partnerLeft} placeholder={partnerLeft ? "They've left this chat" : "Type a message"} className="flex-1 rounded-lg px-3 py-2.5 bg-[#232532] text-sm outline-none" />
              <button onClick={sendMessage} disabled={streak >= 6 || partnerLeft} className="px-4 rounded-lg bg-[#FF3D7F] text-[#1A0810] text-sm font-display">Send</button>
            </div>
          </div>
        )}

        {screen === "friendChat" && friendPartner && (
          <div className="flex flex-col" style={{ height: 480 }}>
            <div className="px-5 py-3 flex items-center gap-2 border-b border-[#2E3140]">
              <button onClick={goHome} className="p-2 rounded-lg bg-[#232532] text-xs">home</button>
              <Avatar id={friendPartner.avatar_id} size={32} />
              <p className="font-display text-sm">{friendPartner.username}</p>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-2">
              {friendMessages.map((m) => (
                <div key={m.id} className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${m.sender_id === uid ? "self-end bg-[#FF3D7F] text-[#1A0810]" : "self-start bg-[#232532]"}`}>{m.body}</div>
              ))}
              <div ref={friendMessagesEndRef} />
            </div>
            <div className="px-4 py-3 flex gap-2 border-t border-[#2E3140]">
              <input value={friendDraft} onChange={(e) => setFriendDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendFriendMessage()} placeholder="Type a message" className="flex-1 rounded-lg px-3 py-2.5 bg-[#232532] text-sm outline-none" />
              <button onClick={sendFriendMessage} className="px-4 rounded-lg bg-[#FF3D7F] text-[#1A0810] text-sm font-display">Send</button>
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
              <p className="text-[11px] font-mono mt-3 text-[#5C5F70]">5 low ratings (under 2★) from different people triggers a 12h ban.</p>
              <button onClick={proceedNext} className="mt-3 text-xs font-mono underline text-[#5C5F70]">skip rating, go to next</button>
            </div>
          </div>
        )}

        {showAdmin && (
          <div className="absolute inset-0 z-20 overflow-y-auto p-5" style={{ background: "#1B1D26" }}>
            <div className="flex items-center justify-between mb-4">
              <p className="font-display text-base">Owner dashboard</p>
              <button onClick={() => setShowAdmin(false)} className="text-xs font-mono text-[#8C8FA3]">close</button>
            </div>

            {adminError && <p className="text-xs font-mono text-[#FF5C5C] mb-3">{adminError}</p>}

            {adminStats && (
              <div className="grid grid-cols-2 gap-2 mb-5">
                <StatCard label="TOTAL MEMBERS" value={adminStats.total_members} />
                <StatCard label="PREMIUM" value={adminStats.premium_count} />
                <StatCard label="MALE / FEMALE" value={`${adminStats.male_count} / ${adminStats.female_count}`} />
                <StatCard label="AVG RATING" value={`${adminStats.avg_rating}★`} />
                <StatCard label="TOTAL COINS" value={adminStats.total_coins} />
                <StatCard label="CURRENTLY BANNED" value={adminStats.currently_banned} />
                <StatCard label="FRIEND PAIRS" value={adminStats.total_friend_pairs} />
                <StatCard label="CHAT SESSIONS" value={adminStats.total_chat_sessions} />
                <StatCard label="TOTAL MESSAGES" value={adminStats.total_messages} />
                <StatCard label="SIGNUPS, 24H" value={adminStats.signups_last_24h} />
              </div>
            )}

            <p className="text-xs font-mono text-[#5C5F70] mb-2">COIN SETTINGS</p>
            <div className="flex flex-col gap-2 mb-2">
              <label className="flex items-center justify-between bg-[#232532] rounded-lg px-3 py-2 text-sm">
                Coins per gender-filtered match
                <input type="number" value={adminCostInput} onChange={(e) => setAdminCostInput(parseInt(e.target.value) || 0)} className="w-16 text-right bg-[#1B1D26] rounded px-2 py-1 text-xs" />
              </label>
              <label className="flex items-center justify-between bg-[#232532] rounded-lg px-3 py-2 text-sm">
                Initial coins for new signups
                <input type="number" value={adminCoinsInput} onChange={(e) => setAdminCoinsInput(parseInt(e.target.value) || 0)} className="w-16 text-right bg-[#1B1D26] rounded px-2 py-1 text-xs" />
              </label>
            </div>
            <button onClick={saveAdminSettings} className="w-full rounded-lg py-2.5 text-sm font-display bg-[#232532] mb-5">Save coin settings</button>

            <p className="text-xs font-mono text-[#5C5F70] mb-2">GRANT / REVOKE PREMIUM (manual, until real payments are wired up)</p>
            <input value={adminPremiumUsername} onChange={(e) => setAdminPremiumUsername(e.target.value)} placeholder="Username" className="w-full rounded-lg px-3 py-2 bg-[#232532] text-sm outline-none mb-2" />
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-[#8C8FA3]">for</span>
              <input type="number" value={adminPremiumDays} onChange={(e) => setAdminPremiumDays(parseInt(e.target.value) || 0)} className="w-16 bg-[#232532] rounded px-2 py-1 text-xs" />
              <span className="text-xs text-[#8C8FA3]">days</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => grantPremium(true)} className="flex-1 rounded-lg py-2.5 text-sm font-display bg-[#3D3320] text-[#FFD400]">Grant Premium</button>
              <button onClick={() => grantPremium(false)} className="flex-1 rounded-lg py-2.5 text-sm font-display bg-[#232532] text-[#8C8FA3]">Revoke</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-lg bg-[#232532] p-3">
      <p className="text-[9px] font-mono text-[#5C5F70]">{label}</p>
      <p className="font-display text-lg">{value}</p>
    </div>
  );
}
