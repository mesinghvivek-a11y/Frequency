"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const RATE_UNLOCK_SECONDS = 30;
const FREE_FRIEND_CAP = 3;
const AGE_RANGES = ["18-24", "25-34", "35-44", "45+"];
const COUNTRIES = [
  { code: "US", flag: "🇺🇸" }, { code: "IN", flag: "🇮🇳" }, { code: "GB", flag: "🇬🇧" },
  { code: "BR", flag: "🇧🇷" }, { code: "FR", flag: "🇫🇷" }, { code: "DE", flag: "🇩🇪" },
  { code: "JP", flag: "🇯🇵" }, { code: "NG", flag: "🇳🇬" }, { code: "MX", flag: "🇲🇽" }, { code: "PH", flag: "🇵🇭" },
];
function flagFor(code) { return COUNTRIES.find((c) => c.code === code)?.flag || "🏳️"; }

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
      {gender === "f" ? <path d="M5 19 Q20 1 35 19 L35 26 Q20 13 5 26 Z" fill="#3A2417" /> : <path d="M8 17 Q20 4 32 17 L32 20 Q20 10 8 20 Z" fill="#2A1B10" />}
      <circle cx="16" cy="23" r="1.6" fill="#2A2A2A" /><circle cx="24" cy="23" r="1.6" fill="#2A2A2A" />
      <path d="M15 28 Q20 31 25 28" stroke="#7A4A33" strokeWidth="1.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

const ICEBREAKERS = [
  "If your life had a theme song right now, what would it be?", "What's the last thing that made you laugh out loud?",
  "Beach sunset or mountain sunrise — pick one and defend it.", "What's a small thing that instantly makes your day better?",
  "If you could teleport anywhere for the next hour, where?", "What's something you're weirdly good at?",
  "Coffee, tea, or neither?", "What's a movie you can rewatch endlessly?",
  "What's the most spontaneous thing you've ever done?", "If you had a free weekend with zero plans, what would you do?",
  "What's a skill you wish you'd picked up as a kid?", "Window seat or aisle seat, and why?",
  "What's your go-to comfort food?", "What's a place you've never been but really want to visit?",
  "Early bird or night owl?", "What song do you have on repeat lately?",
];
function pickSuggestions() { return [...ICEBREAKERS].sort(() => Math.random() - 0.5).slice(0, 4); }

const TOPIC_EXAMPLES = [
  "Just landed from a solo trip — ask me about it", "Looking for someone to debate the best pizza topping",
  "Here to talk startups and side hustles", "Foodie hunting for hidden gem restaurants",
  "Into astrology — what's your sign?", "Just moved to a new city, give me tips",
];

function MiniGame() {
  const [score, setScore] = useState(0); const [best, setBest] = useState(0);
  const [alive, setAlive] = useState(true); const [started, setStarted] = useState(false);
  const stateRef = useRef({ playerY: 0, vel: 0, obstacles: [], t: 0, lastSpawn: 0 });
  const [, tick] = useState(0);

  useEffect(() => {
    if (!started || !alive) return;
    let raf;
    const loop = () => {
      const s = stateRef.current; s.t += 16.7;
      const speed = Math.min(9, 2.2 + score * 0.14);
      const spawnGap = Math.max(480, 1200 - score * 16);
      s.vel += 0.95; s.playerY += s.vel;
      if (s.playerY > 0) { s.playerY = 0; s.vel = 0; }
      if (s.t - s.lastSpawn > spawnGap + Math.random() * 450) {
        s.lastSpawn = s.t;
        s.obstacles.push({ x: 260, id: Math.random(), h: 14 + Math.random() * 14 });
      }
      s.obstacles.forEach((o) => (o.x -= speed));
      s.obstacles = s.obstacles.filter((o) => o.x > -20);
      for (const o of s.obstacles) {
        if (o.x < 38 && o.x > 6 && s.playerY > -20) {
          setAlive(false);
          setBest((b) => Math.max(b, Math.floor(s.t / 100)));
          break;
        }
      }
      setScore(Math.floor(s.t / 100));
      tick((n) => n + 1);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [started, alive, score]);

  function jump() {
    const s = stateRef.current;
    if (!started) { setStarted(true); return; }
    if (!alive) { stateRef.current = { playerY: 0, vel: 0, obstacles: [], t: 0, lastSpawn: 0 }; setScore(0); setAlive(true); return; }
    if (s.playerY === 0) s.vel = -13.5;
  }
  useEffect(() => { function onKey(e) { if (e.code === "Space") { e.preventDefault(); jump(); } } window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); });

  const s = stateRef.current;
  return (
    <div className="w-full mt-4">
      <div className="flex items-center justify-between mb-1.5 px-0.5">
        <span className="text-[10px] font-mono text-[#5C5F70]">WHILE YOU WAIT · tap or press space</span>
        <span className="text-[10px] font-mono text-[#5EEAD4]">score {score} · best {best}</span>
      </div>
      <div onClick={jump} className="relative w-full rounded-xl overflow-hidden cursor-pointer select-none bg-[#232532] border border-[#2E3140]" style={{ height: 100 }}>
        <div className="absolute left-0 right-0" style={{ bottom: 20, height: 1, background: "#2E3140" }} />
        <div className="absolute rounded-md" style={{ left: 18, bottom: 20, width: 16, height: 16, background: "#FF3D7F", transform: `translateY(${s.playerY}px)`, boxShadow: alive && started ? "0 0 8px #FF3D7F66" : "none" }} />
        {s.obstacles.map((o) => <div key={o.id} className="absolute rounded-sm" style={{ left: o.x, bottom: 20, width: 9, height: o.h, background: "#5EEAD4" }} />)}
        {!started && <div className="absolute inset-0 flex items-center justify-center text-xs font-mono text-[#8C8FA3]">tap to start</div>}
        {started && !alive && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5" style={{ background: "rgba(18,19,25,0.8)" }}>
            <span className="text-xs">signal lost</span>
            <span className="text-[10px] font-mono text-[#8C8FA3]">tap to retry</span>
          </div>
        )}
      </div>
    </div>
  );
}

function PreferencesSheet({ ageFilter, setAgeFilter, countryFilter, setCountryFilter, isPremiumActive, onClose }) {
  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.6)" }} onClick={onClose}>
      <div className="w-full rounded-t-2xl p-5 bg-[#1B1D26] border border-[#2E3140]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <p className="font-display text-base">Preferences</p>
          <button onClick={onClose} className="text-xs font-mono text-[#8C8FA3]">close</button>
        </div>
        {!isPremiumActive && <p className="text-[11px] font-mono mb-3 text-[#FFD400]">👑 Picking anything but "Any" requires Premium.</p>}

        <p className="text-xs font-mono text-[#8C8FA3] mb-1.5">AGE RANGE</p>
        <div className="grid grid-cols-4 gap-1.5 mb-4">
          {AGE_RANGES.map((r) => (
            <button key={r} onClick={() => isPremiumActive && setAgeFilter((f) => (f === r ? "any" : r))} className="rounded-lg py-2 text-[11px] font-mono" style={{ background: ageFilter === r ? "#1E3D38" : "#232532", color: ageFilter === r ? "#5EEAD4" : "#8C8FA3", opacity: isPremiumActive ? 1 : 0.5 }}>{r}</button>
          ))}
        </div>

        <p className="text-xs font-mono text-[#8C8FA3] mb-1.5">COUNTRY</p>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {COUNTRIES.map((c) => (
            <button key={c.code} onClick={() => isPremiumActive && setCountryFilter((f) => (f === c.code ? "any" : c.code))} className="shrink-0 rounded-full px-2.5 py-1.5 text-xs" style={{ background: countryFilter === c.code ? "#1E3D38" : "#232532", color: countryFilter === c.code ? "#5EEAD4" : "#8C8FA3", opacity: isPremiumActive ? 1 : 0.5 }}>{c.flag} {c.code}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [uid, setUid] = useState(null);
  const [profile, setProfile] = useState(null);
  const [screen, setScreen] = useState("loading");
  const [homeTab, setHomeTab] = useState("find");
  const [error, setError] = useState("");
  const [settings, setSettings] = useState({ gender_match_cost: 5, initial_coins: 50, show_online_count: true, online_count_override: 50 });
  const [notif, setNotif] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);

  const [username, setUsername] = useState("");
  const [gender, setGender] = useState("male");
  const [age, setAge] = useState("");
  const [country, setCountry] = useState("US");
  const [genderFilter, setGenderFilter] = useState("any");
  const [ageFilter, setAgeFilter] = useState("any");
  const [countryFilter, setCountryFilter] = useState("any");
  const [topic, setTopic] = useState("");

  const [sessionId, setSessionId] = useState(null);
  const [partner, setPartner] = useState(null);
  const [lastPartner, setLastPartner] = useState(null);
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
  const [showNextConfirm, setShowNextConfirm] = useState(false);
  const [showHomeConfirm, setShowHomeConfirm] = useState(false);
  const messagesEndRef = useRef(null);

  const [friendSearch, setFriendSearch] = useState("");
  const [friendResults, setFriendResults] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [friendsList, setFriendsList] = useState([]);
  const [friendChatId, setFriendChatId] = useState(null);
  const [friendPartner, setFriendPartner] = useState(null);
  const [friendMessages, setFriendMessages] = useState([]);
  const [friendDraft, setFriendDraft] = useState("");
  const friendMessagesEndRef = useRef(null);

  const [showAdmin, setShowAdmin] = useState(false);
  const [adminStats, setAdminStats] = useState(null);
  const [adminError, setAdminError] = useState("");
  const [adminCostInput, setAdminCostInput] = useState(5);
  const [adminCoinsInput, setAdminCoinsInput] = useState(50);
  const [adminShowOnline, setAdminShowOnline] = useState(true);
  const [adminOnlineCount, setAdminOnlineCount] = useState(50);
  const [adminPremiumUsername, setAdminPremiumUsername] = useState("");
  const [adminPremiumDays, setAdminPremiumDays] = useState(30);
  const [adminVerifiedUsername, setAdminVerifiedUsername] = useState("");

  const restrictedFromGender = profile && profile.rating < 2;
  const isPremiumActive = profile?.is_premium && profile?.premium_until && new Date(profile.premium_until) > new Date();

  function requireProfile() {
    if (!profile) { setError("Make a profile first, on the Find New tab."); return false; }
    return true;
  }

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
        if (existingProfile.banned_until && new Date(existingProfile.banned_until) > new Date()) { setScreen("banned"); return; }
      }
      setScreen("landing");
    }
    init();
  }, []);

  useEffect(() => { if (notif) { const t = setTimeout(() => setNotif(null), 4000); return () => clearTimeout(t); } }, [notif]);

  async function createProfileAndMatch() {
    setError("");
    if (profile) { await startMatching(); return; }
    if (!/^[a-zA-Z0-9._-]{3,20}$/.test(username)) { setError("Username: 3-20 characters, letters/numbers/dot/dash only."); return; }
    if (!age || parseInt(age) < 18) { setError("Age is required (18+)."); return; }
    const { data, error } = await supabase
      .from("profiles")
      .insert({ id: uid, username, gender, age: parseInt(age), country, avatar_id: randomAvatarId(gender), coins: settings.initial_coins })
      .select()
      .single();
    if (error) { if (error.code === "23505") setError("That username is taken."); else setError(error.message); return; }
    setProfile(data);
    await startMatching(data);
  }

  async function startMatching(freshProfile) {
    setError("");
    const currentProfile = freshProfile || profile;
    if (currentProfile?.banned_until && new Date(currentProfile.banned_until) > new Date()) { setScreen("banned"); return; }

    const premiumNow = currentProfile?.is_premium && currentProfile?.premium_until && new Date(currentProfile.premium_until) > new Date();
    if ((ageFilter !== "any" || countryFilter !== "any") && !premiumNow) {
      setError("Age and country filters are a Premium feature.");
      return;
    }
    if (genderFilter !== "any" && !premiumNow) {
      if (currentProfile && currentProfile.rating < 2) { setError("Your rating is below 2★ — specific-gender matching is locked right now."); return; }
      if ((currentProfile?.coins ?? 0) < settings.gender_match_cost) { setError(`Not enough coins. A ${genderFilter} match costs ${settings.gender_match_cost} coins — or go Premium.`); return; }
    }

    if (currentProfile?.topic !== topic) {
      await supabase.from("profiles").update({ topic }).eq("id", uid);
    }

    setScreen("matching");
    const { data: newSessionId, error } = await supabase.rpc("find_match", {
      p_gender: currentProfile?.gender || gender,
      p_gender_filter: genderFilter,
      p_age_filter: ageFilter,
      p_country_filter: countryFilter,
    });
    if (error) {
      if (error.message.includes("banned_until")) setScreen("banned");
      else if (error.message.includes("insufficient_coins")) { setError(`Not enough coins. A ${genderFilter} match costs ${settings.gender_match_cost} coins — or go Premium.`); setScreen("landing"); }
      else if (error.message.includes("rating_too_low")) { setError("Your rating is below 2★ — specific-gender matching is locked right now."); setScreen("landing"); }
      else if (error.message.includes("premium_required")) { setError("Age and country filters are a Premium feature."); setScreen("landing"); }
      else { setError(error.message); setScreen("landing"); }
      return;
    }
    const { data: refreshed } = await supabase.from("profiles").select("*").eq("id", uid).single();
    if (refreshed) setProfile(refreshed);
    if (newSessionId) await enterSession(newSessionId);
  }

  useEffect(() => {
    if (screen !== "matching" || !uid) return;
    const channel = supabase.channel("waiting-for-match").on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_sessions" }, (payload) => {
      const row = payload.new;
      if (row.user_a === uid || row.user_b === uid) enterSession(row.id);
    }).subscribe();
    return () => supabase.removeChannel(channel);
  }, [screen, uid]);

  async function enterSession(id) {
    const { data: session } = await supabase.from("chat_sessions").select("*").eq("id", id).single();
    if (!session) return;
    const partnerId = session.user_a === uid ? session.user_b : session.user_a;
    const { data: partnerProfile } = await supabase.from("profiles").select("*").eq("id", partnerId).single();
    setSessionId(id); setPartner(partnerProfile); setMessages([]); setStreak(0); setPartnerLeft(false);
    setChatStartedAt(Date.now()); setElapsed(0); setSuggestions(pickSuggestions()); setMatchFriendStatus(null);
    setScreen("chat");
  }

  useEffect(() => {
    if (screen !== "chat" || !sessionId) return;
    supabase.from("messages").select("*").eq("session_id", sessionId).order("created_at", { ascending: true }).then(({ data }) => setMessages(data || []));
    const messagesChannel = supabase.channel(`session-${sessionId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `session_id=eq.${sessionId}` }, (payload) => {
      setMessages((m) => [...m, payload.new]);
      if (payload.new.sender_id !== uid) setStreak(0);
    }).subscribe();
    const sessionChannel = supabase.channel(`session-status-${sessionId}`).on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_sessions", filter: `id=eq.${sessionId}` }, (payload) => {
      if (payload.new.ended_at) setPartnerLeft(true);
    }).subscribe();
    return () => { supabase.removeChannel(messagesChannel); supabase.removeChannel(sessionChannel); };
  }, [screen, sessionId, uid]);

  useEffect(() => { if (screen !== "chat" || !chatStartedAt) return; const id = setInterval(() => setElapsed(Math.floor((Date.now() - chatStartedAt) / 1000)), 1000); return () => clearInterval(id); }, [screen, chatStartedAt]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function sendMessage() {
    if (!draft.trim() || streak >= 6 || partnerLeft) return;
    const { error } = await supabase.from("messages").insert({ session_id: sessionId, sender_id: uid, body: draft.trim() });
    if (!error) { setDraft(""); setStreak((s) => s + 1); }
  }

  async function addFriendFromMatch() {
    if (!requireProfile()) return;
    if (!isPremiumActive && friendsList.length >= FREE_FRIEND_CAP) { setError(`Free plan allows ${FREE_FRIEND_CAP} friends — go Premium for unlimited.`); return; }
    if (!partner) return;
    const { data, error } = await supabase.rpc("send_friend_request", { p_recipient_id: partner.id });
    if (!error) setMatchFriendStatus(data);
  }

  function requestNext() { setShowNextConfirm(true); }
  function confirmNext() { setShowNextConfirm(false); if (elapsed >= RATE_UNLOCK_SECONDS) setShowRatingModal(true); else proceedNext(); }
  async function proceedNext() {
    if (partner) setLastPartner(partner);
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

  function requestGoHome() { setShowHomeConfirm(true); }
  async function confirmGoHome() { setShowHomeConfirm(false); await goHome(); }
  async function goHome() {
    if (partner) setLastPartner(partner);
    if (sessionId) await supabase.rpc("end_session", { p_session_id: sessionId });
    if (screen === "matching") await supabase.rpc("leave_queue");
    setSessionId(null); setPartner(null); setFriendChatId(null); setFriendPartner(null);
    setScreen("landing");
  }

  async function rewindToLast() {
    setError("");
    if (!isPremiumActive) { setError("Rewind is a Premium feature."); return; }
    if (!lastPartner) return;
    const { data: newSessionId, error } = await supabase.rpc("rewind_to", { p_partner_id: lastPartner.id });
    if (error) {
      if (error.message.includes("partner_not_available")) setError(`${lastPartner.username} isn't online right now.`);
      else if (error.message.includes("premium_required")) setError("Rewind is a Premium feature.");
      else setError(error.message);
      return;
    }
    if (newSessionId) await enterSession(newSessionId);
  }

  function timeRemaining(untilIso) {
    const ms = new Date(untilIso).getTime() - Date.now();
    if (ms <= 0) return "0h 0m";
    return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
  }

  async function loadFriendsData() {
    if (!uid) return;
    const { data: incoming } = await supabase
      .from("friend_requests")
      .select("*, requester:requester_id(id, username, avatar_id, topic, age, country, is_verified)")
      .eq("recipient_id", uid)
      .eq("status", "pending");
    setIncomingRequests(incoming || []);
    const { data: chats } = await supabase.from("friend_chats").select("*, a:user_a(id, username, avatar_id, is_verified), b:user_b(id, username, avatar_id, is_verified)").or(`user_a.eq.${uid},user_b.eq.${uid}`);
    setFriendsList((chats || []).map((c) => ({ chatId: c.id, partner: c.user_a === uid ? c.b : c.a })));
  }

  useEffect(() => {
    if (!uid) return;
    loadFriendsData();
    const inChannel = supabase.channel(`friend-reqs-in-${uid}`).on("postgres_changes", { event: "*", schema: "public", table: "friend_requests", filter: `recipient_id=eq.${uid}` }, (payload) => {
      if (payload.eventType === "INSERT" && profile?.notifications_on !== false) {
        supabase.from("profiles").select("username").eq("id", payload.new.requester_id).single().then(({ data }) => setNotif(`${data?.username || "Someone"} sent you a friend request`));
      }
      loadFriendsData();
    }).subscribe();
    const outChannel = supabase.channel(`friend-reqs-out-${uid}`).on("postgres_changes", { event: "*", schema: "public", table: "friend_requests", filter: `requester_id=eq.${uid}` }, loadFriendsData).subscribe();
    return () => { supabase.removeChannel(inChannel); supabase.removeChannel(outChannel); };
  }, [uid, profile?.notifications_on]);

  async function searchUsers() {
    const q = friendSearch.trim();
    if (!q) { setFriendResults([]); return; }
    const { data } = await supabase.from("profiles").select("id, username, avatar_id, is_verified").ilike("username", `%${q}%`).neq("id", uid).limit(10);
    setFriendResults(data || []);
  }
  async function sendRequestTo(recipientId) {
    if (!requireProfile()) return;
    if (!isPremiumActive && friendsList.length >= FREE_FRIEND_CAP) { setError(`Free plan allows ${FREE_FRIEND_CAP} friends — go Premium for unlimited.`); return; }
    const { error } = await supabase.rpc("send_friend_request", { p_recipient_id: recipientId });
    if (!error) { searchUsers(); loadFriendsData(); }
  }
  async function respondRequest(requestId, accept) {
    if (!requireProfile()) return;
    if (accept && !isPremiumActive && friendsList.length >= FREE_FRIEND_CAP) { setError(`Free plan allows ${FREE_FRIEND_CAP} friends — go Premium for unlimited.`); return; }
    await supabase.rpc("respond_to_friend_request", { p_request_id: requestId, p_accept: accept });
    loadFriendsData();
  }
  async function openFriendChat(chatId, partnerProfile) { setFriendChatId(chatId); setFriendPartner(partnerProfile); setFriendMessages([]); setScreen("friendChat"); }

  useEffect(() => {
    if (screen !== "friendChat" || !friendChatId) return;
    supabase.from("friend_messages").select("*").eq("chat_id", friendChatId).order("created_at", { ascending: true }).then(({ data }) => setFriendMessages(data || []));
    const channel = supabase.channel(`friend-chat-${friendChatId}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "friend_messages", filter: `chat_id=eq.${friendChatId}` }, (payload) => setFriendMessages((m) => [...m, payload.new])).subscribe();
    return () => supabase.removeChannel(channel);
  }, [screen, friendChatId]);
  useEffect(() => { friendMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [friendMessages]);

  async function sendFriendMessage() {
    if (!friendDraft.trim()) return;
    const { error } = await supabase.from("friend_messages").insert({ chat_id: friendChatId, sender_id: uid, body: friendDraft.trim() });
    if (!error) setFriendDraft("");
  }

  async function openAdmin() {
    setAdminError("");
    const { data, error } = await supabase.rpc("admin_stats");
    if (error) { setAdminError("Not authorized, or something went wrong."); return; }
    setAdminStats(data);
    setAdminCostInput(settings.gender_match_cost); setAdminCoinsInput(settings.initial_coins);
    setAdminShowOnline(settings.show_online_count); setAdminOnlineCount(settings.online_count_override);
    setShowAdmin(true);
  }
  async function saveAdminSettings() {
    const { error } = await supabase.rpc("update_platform_settings", {
      p_gender_match_cost: adminCostInput, p_initial_coins: adminCoinsInput,
      p_show_online_count: adminShowOnline, p_online_count_override: adminOnlineCount,
    });
    if (!error) setSettings({ gender_match_cost: adminCostInput, initial_coins: adminCoinsInput, show_online_count: adminShowOnline, online_count_override: adminOnlineCount });
  }
  async function grantPremium(grant) {
    setAdminError("");
    const { error } = await supabase.rpc("admin_set_premium", { p_username: adminPremiumUsername, p_premium: grant, p_days: adminPremiumDays });
    if (error) setAdminError("Couldn't find that username, or something went wrong.");
    else setAdminPremiumUsername("");
  }
  async function setVerified(verified) {
    setAdminError("");
    const { error } = await supabase.rpc("admin_set_verified", { p_username: adminVerifiedUsername, p_verified: verified });
    if (error) setAdminError("Couldn't find that username, or something went wrong.");
    else setAdminVerifiedUsername("");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#2E3140] bg-[#1B1D26] overflow-hidden relative">
        {notif && <div className="absolute top-3 left-3 right-3 z-40 rounded-lg px-3 py-2 text-xs font-mono text-center bg-[#232532] border border-[#2E3140] shadow-lg">{notif}</div>}

        {screen === "loading" && <div className="p-10 text-center text-sm text-[#8C8FA3] font-mono">connecting…</div>}

        {screen === "banned" && (
          <div className="p-10 text-center">
            <p className="font-display text-lg">Chat banned for 12 hours</p>
            <p className="text-xs text-[#8C8FA3] mt-2">5 different people rated you below 2★. Time remaining: {profile?.banned_until ? timeRemaining(profile.banned_until) : "—"}</p>
            <button onClick={async () => { const { data } = await supabase.from("profiles").select("*").eq("id", uid).single(); setProfile(data); if (!data.banned_until || new Date(data.banned_until) <= new Date()) setScreen("landing"); }} className="mt-5 text-xs font-mono text-[#8C8FA3] underline">check again</button>
          </div>
        )}

        {screen === "landing" && (
          <div className="p-6">
            <div className="flex gap-4 mb-4 border-b border-[#2E3140]">
              <button onClick={() => setHomeTab("find")} className="pb-2 text-sm font-mono" style={{ color: homeTab === "find" ? "#F0F0EE" : "#5C5F70", borderBottom: homeTab === "find" ? "2px solid #FF3D7F" : "2px solid transparent" }}>Find New</button>
              <button onClick={() => setHomeTab("friends")} className="pb-2 text-sm font-mono flex items-center gap-1.5" style={{ color: homeTab === "friends" ? "#F0F0EE" : "#5C5F70", borderBottom: homeTab === "friends" ? "2px solid #FF3D7F" : "2px solid transparent" }}>
                Friends {incomingRequests.length > 0 && <span className="rounded-full bg-[#FF3D7F] text-[#1A0810] text-[10px] px-1.5">{incomingRequests.length}</span>}
              </button>
              {profile && <button onClick={() => setShowSettings(true)} className="pb-2 text-sm font-mono text-[#5C5F70]">Settings</button>}
              {profile?.is_admin && <button onClick={openAdmin} className="pb-2 text-sm font-mono ml-auto" style={{ color: "#FFD400" }}>Owner ⚙</button>}
            </div>

            {homeTab === "find" && (
              <div className="relative">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {profile && <Avatar id={profile.avatar_id} size={38} />}
                    <p className="font-display text-2xl leading-tight">Tune in to<br />someone new.</p>
                  </div>
                  <div className="flex flex-col gap-1.5 items-end shrink-0">
                    <div className="rounded-full px-3 py-1.5 bg-[#232532] text-xs font-mono whitespace-nowrap">🪙 {profile ? profile.coins : settings.initial_coins}</div>
                    {profile && <div className="rounded-full px-3 py-1.5 text-xs font-mono whitespace-nowrap" style={{ background: restrictedFromGender ? "#3A1E22" : "#232532" }}>⭐ {Number(profile.rating).toFixed(1)}</div>}
                    {isPremiumActive && <div className="rounded-full px-3 py-1.5 text-xs font-mono whitespace-nowrap bg-[#3D3320] text-[#FFD400]">👑 Premium</div>}
                  </div>
                </div>

                {settings.show_online_count && <p className="text-[11px] font-mono mt-2 text-[#5EEAD4]">● {settings.online_count_override.toLocaleString()} online now</p>}

                {!profile ? (
                  <div className="mt-5 flex flex-col gap-3">
                    <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Pick a username" className="rounded-lg px-3 py-2.5 bg-[#232532] text-sm outline-none" />
                    <div className="flex gap-2">
                      <button onClick={() => setGender("male")} className={`flex-1 rounded-lg py-2 text-sm ${gender === "male" ? "bg-[#1E3D38] text-[#5EEAD4]" : "bg-[#232532] text-[#8C8FA3]"}`}>Male</button>
                      <button onClick={() => setGender("female")} className={`flex-1 rounded-lg py-2 text-sm ${gender === "female" ? "bg-[#1E3D38] text-[#5EEAD4]" : "bg-[#232532] text-[#8C8FA3]"}`}>Female</button>
                    </div>
                    <input value={age} onChange={(e) => setAge(e.target.value.replace(/\D/g, ""))} placeholder="Age" className="rounded-lg px-3 py-2.5 bg-[#232532] text-sm outline-none" />
                    <div className="flex gap-1.5 overflow-x-auto pb-1">
                      {COUNTRIES.map((c) => (
                        <button key={c.code} onClick={() => setCountry(c.code)} className="shrink-0 rounded-full px-2.5 py-1.5 text-xs" style={{ background: country === c.code ? "#1E3D38" : "#232532", color: country === c.code ? "#5EEAD4" : "#8C8FA3" }}>{c.flag} {c.code}</button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-4">
                    <input value={topic} onChange={(e) => setTopic(e.target.value.slice(0, 60))} placeholder="What do you want to talk about?" className="w-full rounded-lg px-3 py-2.5 bg-[#232532] text-sm outline-none" />
                    <div className="flex gap-1.5 overflow-x-auto mt-1.5 pb-1">
                      {TOPIC_EXAMPLES.slice(0, 4).map((t) => <button key={t} onClick={() => setTopic(t)} className="shrink-0 rounded-full px-2.5 py-1 text-[10px] whitespace-nowrap bg-[#232532] text-[#5C5F70]">{t}</button>)}
                    </div>
                  </div>
                )}

                <div className="mt-4">
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

                {lastPartner && (
                  <button onClick={rewindToLast} className="w-full mt-2 rounded-xl py-2.5 text-sm flex items-center justify-center gap-1.5 bg-[#232532]" style={{ color: isPremiumActive ? "#F0F0EE" : "#5C5F70" }}>
                    ↺ Rewind to {lastPartner.username} {!isPremiumActive && "👑"}
                  </button>
                )}

                <button onClick={() => setShowPrefs(true)} className="fixed rounded-full p-3.5 z-10" style={{ right: 28, bottom: 84, background: "#FFD400", boxShadow: "0 0 18px #FFD40088" }}>
                  <span style={{ color: "#2A2005", fontSize: 16 }}>⚙</span>
                </button>
                {showPrefs && <PreferencesSheet ageFilter={ageFilter} setAgeFilter={setAgeFilter} countryFilter={countryFilter} setCountryFilter={setCountryFilter} isPremiumActive={isPremiumActive} onClose={() => setShowPrefs(false)} />}
              </div>
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
                            <span className="flex items-center gap-2 text-sm"><Avatar id={u.avatar_id} size={26} /> {u.username} {u.is_verified && "✅"}</span>
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
                            <div key={r.id} className="rounded-lg px-3 py-2 bg-[#232532]">
                              <div className="flex items-center justify-between">
                                <span className="flex items-center gap-2 text-sm"><Avatar id={r.requester?.avatar_id} size={26} /> {r.requester?.username} {r.requester?.is_verified && "✅"}</span>
                                <div className="flex gap-2">
                                  <button onClick={() => respondRequest(r.id, false)} className="text-xs font-mono text-[#5C5F70]">Decline</button>
                                  <button onClick={() => respondRequest(r.id, true)} className="text-xs font-mono text-[#5EEAD4]">Accept</button>
                                </div>
                              </div>
                              {isPremiumActive ? (
                                <p className="text-[10px] font-mono mt-1.5 text-[#8C8FA3]">
                                  {r.requester?.age ? `${r.requester.age} · ` : ""}{r.requester?.country ? `${flagFor(r.requester.country)} · ` : ""}{r.requester?.topic || "no topic set"}
                                </p>
                              ) : (
                                <p className="text-[10px] font-mono mt-1.5 text-[#FFD400]">👑 Premium previews their profile before you decide</p>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    <p className="text-[10px] font-mono text-[#5C5F70] mt-4 mb-1.5">YOUR FRIENDS ({friendsList.length}{isPremiumActive ? "" : ` / ${FREE_FRIEND_CAP}`})</p>
                    {friendsList.length === 0 ? (
                      <p className="text-xs font-mono text-[#5C5F70]">No friends yet — search above, or add someone mid-chat.</p>
                    ) : (
                      <div className="flex flex-col gap-1.5">
                        {friendsList.map((f) => (
                          <button key={f.chatId} onClick={() => openFriendChat(f.chatId, f.partner)} className="flex items-center justify-between rounded-lg px-3 py-2.5 bg-[#232532]">
                            <span className="flex items-center gap-2 text-sm"><Avatar id={f.partner?.avatar_id} size={28} /> {f.partner?.username} {f.partner?.is_verified && "✅"}</span>
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
          <div className="p-6 text-center">
            <p className="font-display text-lg mt-4">Scanning frequencies…</p>
            <p className="text-xs font-mono text-[#8C8FA3] mt-2">filter: {genderFilter}{ageFilter !== "any" ? ` · ${ageFilter}` : ""}{countryFilter !== "any" ? ` · ${flagFor(countryFilter)}` : ""}</p>
            <MiniGame />
            <button onClick={goHome} className="mt-4 text-xs font-mono text-[#8C8FA3] underline">cancel</button>
          </div>
        )}

        {screen === "chat" && partner && (
          <div className="flex flex-col" style={{ height: 480 }}>
            <div className="px-5 py-3 flex items-center justify-between border-b border-[#2E3140]">
              <div className="flex items-center gap-2">
                <button onClick={requestGoHome} className="p-2 rounded-lg bg-[#232532] text-xs">home</button>
                <Avatar id={partner.avatar_id} size={32} />
                <p className="font-display text-sm">{partner.username} {partner.is_verified && "✅"} {flagFor(partner.country)}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={addFriendFromMatch} disabled={!!matchFriendStatus} className="p-2 rounded-lg bg-[#232532] text-xs">
                  {matchFriendStatus === "accepted" || matchFriendStatus === "already_friends" ? "✓ friends" : matchFriendStatus === "pending" ? "requested" : "+ friend"}
                </button>
                <button onClick={requestNext} className="p-2 rounded-lg bg-[#232532] text-xs">next</button>
              </div>
            </div>

            {partner.topic && <div className="px-5 py-1.5 text-xs font-mono bg-[#232532] text-[#8C8FA3]">💬 wants to talk about: <span className="text-[#F0F0EE]">{partner.topic}</span></div>}

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
              {messages.map((m) => <div key={m.id} className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${m.sender_id === uid ? "self-end bg-[#FF3D7F] text-[#1A0810]" : "self-start bg-[#232532]"}`}>{m.body}</div>)}
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
                  {suggestions.map((s, i) => <button key={i} onClick={() => setDraft(s)} className="shrink-0 rounded-full px-3 py-1.5 text-[11px] whitespace-nowrap bg-[#232532] border border-[#2E3140]" style={{ maxWidth: 220 }}>{s}</button>)}
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
              <p className="font-display text-sm">{friendPartner.username} {friendPartner.is_verified && "✅"}</p>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-2">
              {friendMessages.map((m) => <div key={m.id} className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${m.sender_id === uid ? "self-end bg-[#FF3D7F] text-[#1A0810]" : "self-start bg-[#232532]"}`}>{m.body}</div>)}
              <div ref={friendMessagesEndRef} />
            </div>
            <div className="px-4 py-3 flex gap-2 border-t border-[#2E3140]">
              <input value={friendDraft} onChange={(e) => setFriendDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendFriendMessage()} placeholder="Type a message" className="flex-1 rounded-lg px-3 py-2.5 bg-[#232532] text-sm outline-none" />
              <button onClick={sendFriendMessage} className="px-4 rounded-lg bg-[#FF3D7F] text-[#1A0810] text-sm font-display">Send</button>
            </div>
          </div>
        )}

        {showNextConfirm && (
          <div className="absolute inset-0 z-10 flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,0.7)" }}>
            <div className="w-full rounded-2xl p-6 text-center bg-[#1B1D26] border border-[#2E3140]">
              <p className="font-display text-base">Skip to next person?</p>
              <p className="text-xs text-[#8C8FA3] mt-2">{elapsed >= RATE_UNLOCK_SECONDS ? "You'll be asked to rate this chat first." : "This chat is under 30s, so no rating will be recorded."}</p>
              <div className="flex gap-2 mt-4">
                <button onClick={() => setShowNextConfirm(false)} className="flex-1 rounded-lg py-2.5 text-sm bg-[#232532] text-[#8C8FA3]">Stay here</button>
                <button onClick={confirmNext} className="flex-1 rounded-lg py-2.5 text-sm font-display bg-[#FF3D7F] text-[#1A0810]">Next</button>
              </div>
            </div>
          </div>
        )}

        {showHomeConfirm && (
          <div className="absolute inset-0 z-10 flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,0.7)" }}>
            <div className="w-full rounded-2xl p-6 text-center bg-[#1B1D26] border border-[#2E3140]">
              <p className="font-display text-base">Leave this chat?</p>
              <p className="text-xs text-[#8C8FA3] mt-2">Going back to the home screen ends your current chat.</p>
              <div className="flex gap-2 mt-4">
                <button onClick={() => setShowHomeConfirm(false)} className="flex-1 rounded-lg py-2.5 text-sm bg-[#232532] text-[#8C8FA3]">Stay here</button>
                <button onClick={confirmGoHome} className="flex-1 rounded-lg py-2.5 text-sm font-display bg-[#FF3D7F] text-[#1A0810]">Go home</button>
              </div>
            </div>
          </div>
        )}

        {showRatingModal && (
          <div className="absolute inset-0 z-10 flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,0.7)" }}>
            <div className="w-full rounded-2xl p-6 text-center bg-[#1B1D26] border border-[#2E3140]">
              <p className="font-display text-base">How was chatting with {partner?.username}?</p>
              <div className="flex justify-center gap-1 mt-4">
                {[1, 2, 3, 4, 5].map((n) => <button key={n} onMouseEnter={() => setRatingHover(n)} onMouseLeave={() => setRatingHover(0)} onClick={() => submitRating(n)}><span style={{ fontSize: 28, color: n <= ratingHover ? "#FFB454" : "#5C5F70" }}>★</span></button>)}
              </div>
              <p className="text-[11px] font-mono mt-3 text-[#5C5F70]">5 low ratings (under 2★) from different people triggers a 12h ban.</p>
              <button onClick={proceedNext} className="mt-3 text-xs font-mono underline text-[#5C5F70]">skip rating, go to next</button>
            </div>
          </div>
        )}

        {showSettings && profile && (
          <div className="absolute inset-0 z-20 overflow-y-auto p-5" style={{ background: "#1B1D26" }}>
            <div className="flex items-center justify-between mb-4">
              <p className="font-display text-base">Settings</p>
              <button onClick={() => setShowSettings(false)} className="text-xs font-mono text-[#8C8FA3]">close</button>
            </div>
            <p className="text-[10px] font-mono text-[#5C5F70] mb-1.5">AVATAR</p>
            <div className="grid grid-cols-5 gap-2 mb-4">
              {Array.from({ length: 10 }, (_, i) => `${profile.gender[0]}${i + 1}`).map((id) => (
                <button key={id} onClick={() => setProfile((p) => ({ ...p, avatar_id: id }))} className="rounded-full p-0.5" style={{ border: `2px solid ${profile.avatar_id === id ? "#FF3D7F" : "transparent"}` }}><Avatar id={id} size={34} /></button>
              ))}
            </div>
            <p className="text-[10px] font-mono text-[#5C5F70] mb-1.5">AGE</p>
            <input value={profile.age || ""} onChange={(e) => setProfile((p) => ({ ...p, age: e.target.value.replace(/\D/g, "") }))} className="w-full rounded-lg px-3 py-2 bg-[#232532] text-sm outline-none mb-4" />
            <label className="flex items-center justify-between bg-[#232532] rounded-lg px-3 py-2.5 mb-2">
              <span className="text-sm">Notifications</span>
              <input type="checkbox" checked={profile.notifications_on !== false} onChange={(e) => setProfile((p) => ({ ...p, notifications_on: e.target.checked }))} />
            </label>
            <label className="flex items-center justify-between bg-[#232532] rounded-lg px-3 py-2.5 mb-2">
              <span className="text-sm">Hide me from Nearby <span className="text-[10px] text-[#5C5F70]">(not active yet)</span></span>
              <input type="checkbox" checked={profile.hide_nearby || false} onChange={(e) => setProfile((p) => ({ ...p, hide_nearby: e.target.checked }))} />
            </label>
            <label className="flex items-center justify-between bg-[#232532] rounded-lg px-3 py-2.5 mb-4">
              <span className="text-sm">Only Premium can message me <span className="text-[10px] text-[#5C5F70]">(not active yet)</span></span>
              <input type="checkbox" checked={profile.premium_only_messages || false} onChange={(e) => setProfile((p) => ({ ...p, premium_only_messages: e.target.checked }))} />
            </label>
            <button
              onClick={async () => {
                await supabase.from("profiles").update({
                  avatar_id: profile.avatar_id, age: parseInt(profile.age) || null,
                  notifications_on: profile.notifications_on !== false, hide_nearby: !!profile.hide_nearby,
                  premium_only_messages: !!profile.premium_only_messages,
                }).eq("id", uid);
                setShowSettings(false);
              }}
              className="w-full rounded-xl py-3 text-sm font-display bg-[#FF3D7F] text-[#1A0810]"
            >
              Save
            </button>
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
              <label className="flex items-center justify-between bg-[#232532] rounded-lg px-3 py-2 text-sm">Coins per gender-filtered match<input type="number" value={adminCostInput} onChange={(e) => setAdminCostInput(parseInt(e.target.value) || 0)} className="w-16 text-right bg-[#1B1D26] rounded px-2 py-1 text-xs" /></label>
              <label className="flex items-center justify-between bg-[#232532] rounded-lg px-3 py-2 text-sm">Initial coins for new signups<input type="number" value={adminCoinsInput} onChange={(e) => setAdminCoinsInput(parseInt(e.target.value) || 0)} className="w-16 text-right bg-[#1B1D26] rounded px-2 py-1 text-xs" /></label>
            </div>
            <p className="text-xs font-mono text-[#5C5F70] mb-2 mt-4">ONLINE COUNTER</p>
            <label className="flex items-center justify-between bg-[#232532] rounded-lg px-3 py-2 mb-2">
              <span className="text-sm">Show online count to users</span>
              <input type="checkbox" checked={adminShowOnline} onChange={(e) => setAdminShowOnline(e.target.checked)} />
            </label>
            <label className="flex items-center justify-between bg-[#232532] rounded-lg px-3 py-2 mb-2 text-sm">Displayed count<input type="number" value={adminOnlineCount} onChange={(e) => setAdminOnlineCount(parseInt(e.target.value) || 0)} className="w-20 text-right bg-[#1B1D26] rounded px-2 py-1 text-xs" /></label>
            <button onClick={saveAdminSettings} className="w-full rounded-lg py-2.5 text-sm font-display bg-[#232532] mb-5">Save settings</button>

            <p className="text-xs font-mono text-[#5C5F70] mb-2">GRANT / REVOKE PREMIUM (manual, until real payments are wired up)</p>
            <input value={adminPremiumUsername} onChange={(e) => setAdminPremiumUsername(e.target.value)} placeholder="Username" className="w-full rounded-lg px-3 py-2 bg-[#232532] text-sm outline-none mb-2" />
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-[#8C8FA3]">for</span>
              <input type="number" value={adminPremiumDays} onChange={(e) => setAdminPremiumDays(parseInt(e.target.value) || 0)} className="w-16 bg-[#232532] rounded px-2 py-1 text-xs" />
              <span className="text-xs text-[#8C8FA3]">days</span>
            </div>
            <div className="flex gap-2 mb-5">
              <button onClick={() => grantPremium(true)} className="flex-1 rounded-lg py-2.5 text-sm font-display bg-[#3D3320] text-[#FFD400]">Grant Premium</button>
              <button onClick={() => grantPremium(false)} className="flex-1 rounded-lg py-2.5 text-sm font-display bg-[#232532] text-[#8C8FA3]">Revoke</button>
            </div>

            <p className="text-xs font-mono text-[#5C5F70] mb-2">VERIFIED BADGE</p>
            <input value={adminVerifiedUsername} onChange={(e) => setAdminVerifiedUsername(e.target.value)} placeholder="Username" className="w-full rounded-lg px-3 py-2 bg-[#232532] text-sm outline-none mb-2" />
            <div className="flex gap-2">
              <button onClick={() => setVerified(true)} className="flex-1 rounded-lg py-2.5 text-sm font-display bg-[#1E3D38] text-[#5EEAD4]">Grant Verified</button>
              <button onClick={() => setVerified(false)} className="flex-1 rounded-lg py-2.5 text-sm font-display bg-[#232532] text-[#8C8FA3]">Revoke</button>
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
