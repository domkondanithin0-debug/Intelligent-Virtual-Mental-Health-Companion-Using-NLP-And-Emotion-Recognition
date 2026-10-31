
"use strict";

/* ==========================================
   MINDORA - MENTAL WELLNESS COMPANION
   Frontend academic demonstration
   HTML + CSS + Vanilla JavaScript
========================================== */

const $ = id => document.getElementById(id);

const STORAGE = {
  users: "mindora_users",
  session: "mindora_session",
  moods: "mindora_moods",
  gratitude: "mindora_gratitude"
};

const read = (key, fallback = []) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};

const write = (key, value) =>
  localStorage.setItem(key, JSON.stringify(value));

let currentUser = null;
let selectedMood = "";
let calendarDate = new Date();
let cameraStream = null;
let lastEmotion = "Neutral";
let meditationSeconds = 120;
let meditationInterval = null;
let breathingInterval = null;
let toastTimeout;

/* ==========================================
   GENERAL HELPERS
========================================== */

function notify(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove("show"), 2800);
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDate(date) {
  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric"
  });
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[char]);
}

function getUserMoods() {
  return read(STORAGE.moods).filter(m => m.email === currentUser?.email);
}

function getCurrentUser() {
  const session = read(STORAGE.session, null);
  if (!session) return null;
  return read(STORAGE.users).find(u => u.email === session.email) || null;
}

function updateCurrentUser(updated) {
  const users = read(STORAGE.users);
  const index = users.findIndex(u => u.email === currentUser.email);
  if (index >= 0) {
    users[index] = updated;
    write(STORAGE.users, users);
    currentUser = updated;
  }
}

/* ==========================================
   AUTHENTICATION
========================================== */

function showAuth(panel) {
  ["loginPanel", "registerPanel", "forgotPanel"].forEach(id =>
    $(id).classList.toggle("hidden", id !== panel)
  );
}

document.querySelectorAll("[data-auth]").forEach(button => {
  button.addEventListener("click", () => {
    const target = button.dataset.auth;
    showAuth(target === "register" ? "registerPanel" :
      target === "forgot" ? "forgotPanel" : "loginPanel");
  });
});

document.querySelectorAll("[data-toggle]").forEach(button => {
  button.addEventListener("click", () => {
    const input = $(button.dataset.toggle);
    input.type = input.type === "password" ? "text" : "password";
    button.textContent = input.type === "password" ? "Show" : "Hide";
  });
});

// Registration password strength
$("regPassword").addEventListener("input", event => {
  const password = event.target.value;
  let score = 0;

  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const bar = $("strengthBar");
  bar.style.width = `${score * 20}%`;
  bar.style.background =
    score <= 2 ? "#e7a16c" : score <= 3 ? "#d5bd64" : "#56b995";

  $("strengthText").textContent =
    ["Very weak", "Weak", "Fair", "Good", "Strong", "Very strong"][score];
});

$("registerForm").addEventListener("submit", event => {
  event.preventDefault();

  const name = $("regName").value.trim();
  const email = $("regEmail").value.trim().toLowerCase();
  const age = Number($("regAge").value);
  const gender = $("regGender").value;
  const password = $("regPassword").value;
  const confirm = $("regConfirm").value;

  if (name.length < 2) return notify("Please enter your full name.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return notify("Please enter a valid email.");
  if (age < 13 || age > 110) return notify("Please enter a valid age.");
  if (password.length < 6)
    return notify("Password must contain at least 6 characters.");
  if (password !== confirm)
    return notify("Passwords do not match.");
  if (!$("terms").checked)
    return notify("Please accept the demo terms.");

  const users = read(STORAGE.users);

  if (users.some(u => u.email === email))
    return notify("This email is already registered.");

  users.push({
    name, email, age, gender, password,
    created: new Date().toISOString()
  });

  write(STORAGE.users, users);

  $("registerForm").reset();
  $("strengthBar").style.width = "0";
  showAuth("loginPanel");
  $("loginEmail").value = email;

  notify("Account created successfully! Please login.");
});

$("loginForm").addEventListener("submit", event => {
  event.preventDefault();

  const identifier = $("loginEmail").value.trim().toLowerCase();
  const password = $("loginPassword").value;

  const users = read(STORAGE.users);

  const user = users.find(u =>
    (u.email === identifier || u.name.toLowerCase() === identifier) &&
    u.password === password
  );

  if (!user) return notify("Invalid email/username or password.");

  write(STORAGE.session, {
    email: user.email,
    remember: $("rememberMe").checked
  });

  currentUser = user;
  enterApplication();
});

$("forgotForm").addEventListener("submit", event => {
  event.preventDefault();

  const email = $("forgotEmail").value.trim().toLowerCase();
  const user = read(STORAGE.users).find(u => u.email === email);

  $("forgotMessage").textContent = user
    ? "Your account exists. This offline demo cannot send a reset email. Contact your project administrator to reset the demo password."
    : "If an account exists, follow the account recovery process. This demo does not send emails.";
});

// Profile updates
$("profileForm").addEventListener("submit", event => {
  event.preventDefault();

  const name = $("profileName").value.trim();
  const age = Number($("profileAge").value);

  if (name.length < 2) return notify("Enter a valid name.");
  if (age && (age < 13 || age > 110))
    return notify("Enter a valid age.");

  updateCurrentUser({
    ...currentUser,
    name,
    age,
    gender: $("profileGender").value
  });

  updateUserInterface();
  $("profileMessage").textContent = "Profile updated successfully.";
  notify("Profile saved!");
});

function enterApplication() {
  $("authScreen").classList.add("hidden");
  $("appScreen").classList.remove("hidden");
  updateUserInterface();
  navigate("dashboard");
  renderAll();
}

function updateUserInterface() {
  if (!currentUser) return;

  const firstName = currentUser.name.split(" ")[0];
  $("welcomeName").textContent = firstName;
  $("topName").textContent = firstName;
  $("topAvatar").textContent = firstName.charAt(0).toUpperCase();
  $("profileAvatar").textContent = firstName.charAt(0).toUpperCase();
  $("profileHeading").textContent = currentUser.name;
  $("profileEmail").textContent = currentUser.email;
  $("profileName").value = currentUser.name;
  $("profileAge").value = currentUser.age || "";
  $("profileGender").value = currentUser.gender || "";
}

function logout() {
  stopCamera();
  stopMeditation();
  stopBreathing();

  localStorage.removeItem(STORAGE.session);
  currentUser = null;

  $("appScreen").classList.add("hidden");
  $("authScreen").classList.remove("hidden");
  $("loginForm").reset();
  showAuth("loginPanel");
  notify("You have logged out.");
}

$("logoutButton").addEventListener("click", logout);

$("clearData").addEventListener("click", () => {
  if (!confirm("Delete all your mood and gratitude records? This cannot be undone."))
    return;

  write(STORAGE.moods,
    read(STORAGE.moods).filter(m => m.email !== currentUser.email));

  write(STORAGE.gratitude,
    read(STORAGE.gratitude).filter(g => g.email !== currentUser.email));

  renderAll();
  notify("Your personal journal data has been cleared.");
});

/* ==========================================
   NAVIGATION
========================================== */

const pageNames = {
  dashboard: "Dashboard",
  chat: "AI Companion",
  emotion: "Emotion Recognition",
  camera: "Camera Analysis",
  moods: "Mood Tracker",
  suggestions: "Mindset Suggestions",
  activities: "Wellness Activities",
  analytics: "Progress Analytics",
  support: "Help & Support",
  profile: "My Profile"
};

function navigate(page) {
  if (!pageNames[page]) return;

  document.querySelectorAll(".page").forEach(section =>
    section.classList.toggle("active", section.id === `page-${page}`)
  );

  document.querySelectorAll(".nav-item[data-page]").forEach(button =>
    button.classList.toggle("active", button.dataset.page === page)
  );

  $("pageTitle").textContent = pageNames[page];
  $("sidebar").classList.remove("open");

  if (page === "dashboard") renderDashboard();
  if (page === "moods") renderCalendar();
  if (page === "analytics") renderAnalytics();
  if (page === "profile") updateUserInterface();
  if (page === "activities") renderGratitude();
  if (page === "suggestions") generateSuggestions();
}

document.addEventListener("click", event => {
  const pageButton = event.target.closest("[data-page]");
  if (pageButton) navigate(pageButton.dataset.page);
});

$("menuToggle").addEventListener("click", () =>
  $("sidebar").classList.toggle("open")
);

/* ==========================================
   CLOCK AND DATE
========================================== */

function updateClock() {
  const now = new Date();
  $("clock").textContent = now.toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit"
  });
  $("todayDate").textContent = now.toLocaleDateString("en-IN", {
    weekday: "short", day: "numeric", month: "short", year: "numeric"
  });
}

updateClock();
setInterval(updateClock, 30000);

/* ==========================================
   NLP-INSPIRED EMOTION RECOGNITION
========================================== */

const emotionData = {
  Happy: {
    emoji: "😊",
    words: ["happy", "joy", "joyful", "excited", "great", "wonderful",
      "amazing", "good", "love", "grateful", "proud", "smiling", "cheerful"],
    description: "Your words contain positive emotional expressions.",
    response: "It's lovely that you're experiencing positive feelings. Take a moment to appreciate what's going well.",
    activities: ["Write down three things you appreciate.",
      "Share your happiness with someone.",
      "Continue a healthy habit you enjoy."]
  },
  Sad: {
    emoji: "😔",
    words: ["sad", "cry", "crying", "unhappy", "heartbroken", "hopeless",
      "upset", "miserable", "disappointed", "hurt", "grief", "empty"],
    description: "Some of your words may reflect sadness or emotional heaviness.",
    response: "I'm sorry things feel difficult right now. You don't need to force yourself to feel happy. Give yourself kindness and time.",
    activities: ["Talk with someone you trust.",
      "Write down what is bothering you.",
      "Spend a little time outdoors."]
  },
  Angry: {
    emoji: "😠",
    words: ["angry", "anger", "furious", "annoyed", "irritated",
      "mad", "rage", "frustrated", "hate", "offended"],
    description: "Your words may suggest frustration or anger.",
    response: "It sounds like something has upset you. Taking a pause before reacting can give you room to decide what you need.",
    activities: ["Step away from the situation if safe.",
      "Try slow, comfortable breathing.",
      "Write your thoughts before responding."]
  },
  Fear: {
    emoji: "😨",
    words: ["afraid", "scared", "fear", "terrified", "danger",
      "unsafe", "frightened", "worrying about", "panic"],
    description: "Your message contains words that may reflect fear or uncertainty.",
    response: "Uncertainty can feel overwhelming. Focus on what is happening right now and consider speaking with someone you trust.",
    activities: ["Notice five things around you.",
      "Identify one manageable next step.",
      "Reach out to someone supportive."]
  },
  Stress: {
    emoji: "😣",
    words: ["stress", "stressed", "pressure", "overwhelmed",
      "workload", "deadline", "too much", "exhausted",
      "tired", "assignments", "burden", "busy"],
    description: "Your words may indicate pressure, overload, or tiredness.",
    response: "It sounds like you have a lot to handle. You don't need to solve everything at once. Let's break things into smaller steps.",
    activities: ["Take a short break.",
      "List your top three priorities.",
      "Try a gentle breathing exercise."]
  },
  Anxiety: {
    emoji: "😟",
    words: ["anxious", "anxiety", "nervous", "worried",
      "worry", "overthinking", "restless", "exam fear",
      "uncertain", "what if", "panic attack"],
    description: "Your words may reflect worry or anxious thoughts.",
    response: "When your thoughts are racing, it can help to return your attention to the present. You can take things one moment at a time.",
    activities: ["Try a gentle grounding exercise.",
      "Write down your worries.",
      "Take a slow, comfortable walk."]
  },
  Neutral: {
    emoji: "😐",
    words: [],
    description: "No strong emotional keyword pattern was detected.",
    response: "A neutral feeling is completely okay. You can use this time to check in with yourself and maintain supportive routines.",
    activities: ["Take a mindful break.",
      "Set one achievable daily goal.",
      "Make time for regular movement."]
  }
};

function analyzeEmotion(text) {
  const normalized = text.toLowerCase();
  const scores = {};

  Object.entries(emotionData).forEach(([emotion, data]) => {
    scores[emotion] = data.words.filter(word => {
      return new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i")
        .test(normalized);
    }).length;
  });

  const ranking = Object.entries(scores)
    .filter(([emotion]) => emotion !== "Neutral")
    .sort((a, b) => b[1] - a[1]);

  if (!ranking.length || ranking[0][1] === 0) {
    return { emotion: "Neutral", confidence: 45 };
  }

  const [emotion, score] = ranking[0];
  const confidence = Math.min(92, 48 + score * 13);

  return { emotion, confidence };
}

function displayEmotion(emotion, confidence) {
  const data = emotionData[emotion] || emotionData.Neutral;

  lastEmotion = emotion;
  $("emotionResult").classList.remove("hidden");
  $("emotionEmoji").textContent = data.emoji;
  $("emotionName").textContent = emotion;
  $("emotionDescription").textContent = data.description;
  $("emotionResponse").textContent = data.response;
  $("confidenceBar").style.width = confidence + "%";
  $("confidenceText").textContent =
    `Illustrative keyword-match estimate: ${confidence}%`;

  $("emotionActivities").innerHTML = data.activities.map(activity =>
    `<div>✧ ${escapeHTML(activity)}</div>`
  ).join("");
}

$("analyzeEmotion").addEventListener("click", () => {
  const text = $("emotionText").value.trim();

  if (text.length < 3) return notify("Please enter a little more about your feelings.");

  const result = analyzeEmotion(text);
  displayEmotion(result.emotion, result.confidence);

  notify("Emotion exploration completed.");
});

/* ==========================================
   SAFETY DETECTION FOR CHAT
========================================== */

const crisisPatterns = [
  /\bkill myself\b/i,
  /\bsuicid(?:e|al)\b/i,
  /\bend my life\b/i,
  /\bwant to die\b/i,
  /\bhurt myself\b/i,
  /\bself[- ]harm\b/i,
  /\bnot safe with myself\b/i
];

function isCrisisMessage(text) {
  return crisisPatterns.some(pattern => pattern.test(text));
}

function crisisReply() {
  return "I'm really sorry you're going through this. Your safety matters, and you deserve immediate human support. If you might hurt yourself or are in immediate danger, please contact emergency services now (112 in India), go to the nearest hospital, or move near someone you trust. Tell them clearly: 'I may not be safe alone and I need help.' In India, you can also contact Tele-MANAS at 14416. I am only a demo assistant and cannot provide emergency monitoring. Please reach out to a real person now.";
}

/* ==========================================
   CHATBOT
========================================== */

const chatResponses = {
  Stress: [
    "That sounds like a lot to carry. Could you choose just one small task to focus on first?",
    "You deserve a break too. What would happen if you gave yourself five minutes to pause?",
    "It's okay to slow down. Let's take things one step at a time."
  ],
  Anxiety: [
    "I hear that you are worried. What is one thing in this moment that you can control?",
    "When thoughts feel overwhelming, grounding yourself in the present can help. Would you like to try naming five things you can see?",
    "You don't have to figure out everything right now. Let's focus on the next small step."
  ],
  Sad: [
    "I'm sorry today feels heavy. Would you like to tell me what happened?",
    "You deserve kindness, especially on difficult days. Is there someone you feel comfortable talking to?",
    "You don't have to pretend everything is okay. Your feelings deserve space."
  ],
  Angry: [
    "It sounds like something has really frustrated you. Would a little space help before you respond?",
    "Your feelings matter. Try giving yourself a moment before deciding what to do next.",
    "Would you like to talk about what caused the frustration?"
  ],
  Fear: [
    "That sounds unsettling. Is there something specific that is making you feel unsafe or uncertain?",
    "Let's focus on what you know right now rather than every possible outcome.",
    "You don't have to face a difficult situation alone."
  ],
  Happy: [
    "That's wonderful! What has made you smile today?",
    "I love hearing that! Take a moment to appreciate this feeling.",
    "You deserve to enjoy your happy moments. What would you like to do next?"
  ],
  Motivation: [
    "You don't need to achieve everything today. Start with one small action.",
    "Progress can be slow and still be meaningful. What is one goal you can work towards?",
    "Believe in the value of small steps. You are allowed to learn as you go."
  ],
  Relationship: [
    "Relationships can bring complicated feelings. Would you like to share what happened?",
    "It may help to express your needs calmly and honestly when you feel ready.",
    "Your feelings and boundaries deserve respect."
  ],
  Academic: [
    "Academic pressure can feel difficult. Try dividing your study plan into small sessions.",
    "One assignment at a time. You can make progress without doing everything at once.",
    "Remember that your worth is not defined by a grade or examination."
  ],
  Neutral: [
    "Thank you for sharing that with me. Would you like to tell me a little more?",
    "I'm listening. What feels most important to you right now?",
    "Taking time to understand yourself is already a meaningful step."
  ]
};

function detectChatIntent(text) {
  const t = text.toLowerCase();

  if (/relationship|breakup|partner|boyfriend|girlfriend|friendship|argument/.test(t))
    return "Relationship";

  if (/exam|study|college|school|marks|assignment|homework|teacher|academic/.test(t))
    return "Academic";

  if (/motivat|lazy|give up|goal|confidence|success|achieve/.test(t))
    return "Motivation";

  return analyzeEmotion(text).emotion;
}

function chatbotReply(text) {
  if (isCrisisMessage(text)) return crisisReply();

  const intent = detectChatIntent(text);
  const responses = chatResponses[intent] || chatResponses.Neutral;
  return responses[Math.floor(Math.random() * responses.length)];
}

function addMessage(text, sender) {
  const container = $("chatMessages");
  const wrapper = document.createElement("div");
  wrapper.className = `chat-message ${sender}`;

  const bubble = document.createElement("div");
  bubble.className = "bubble";
  bubble.textContent = text;

  const time = document.createElement("small");
  time.textContent = sender === "user" ? "You · Just now" : "Mindora · Just now";

  wrapper.append(bubble, time);
  container.appendChild(wrapper);
  container.scrollTop = container.scrollHeight;
}

function sendChat(text) {
  text = text.trim();
  if (!text) return;

  addMessage(text, "user");
  $("chatInput").value = "";

  const typing = document.createElement("div");
  typing.className = "chat-message bot";
  typing.innerHTML = '<div class="bubble">Mindora is thinking... 🌷</div>';
  $("chatMessages").appendChild(typing);

  $("chatMessages").scrollTop = $("chatMessages").scrollHeight;

  setTimeout(() => {
    typing.remove();
    addMessage(chatbotReply(text), "bot");
  }, 800);
}

$("chatForm").addEventListener("submit", event => {
  event.preventDefault();
  sendChat($("chatInput").value);
});

document.querySelectorAll("[data-reply]").forEach(button => {
  button.addEventListener("click", () => sendChat(button.dataset.reply));
});

/* ==========================================
   CAMERA DEMONSTRATION
========================================== */

async function startCamera() {
  if (!navigator.mediaDevices?.getUserMedia) {
    $("cameraStatus").textContent =
      "Camera is unavailable. Use HTTPS or localhost and a supported browser.";
    return;
  }

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false
    });

    $("cameraVideo").srcObject = cameraStream;
    $("cameraVideo").style.display = "block";
    $("cameraPlaceholder").style.display = "none";
    $("startCamera").disabled = true;
    $("stopCamera").disabled = false;

    $("cameraStatus").textContent =
      "Camera preview active. No emotion recognition model is running.";

  } catch (error) {
    $("cameraStatus").textContent =
      error.name === "NotAllowedError"
        ? "Camera permission was denied. Allow access in your browser settings."
        : "Unable to start camera. Check camera connection and browser permissions.";
  }
}

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }

  if ($("cameraVideo")) {
    $("cameraVideo").srcObject = null;
    $("cameraVideo").style.display = "none";
    $("cameraPlaceholder").style.display = "block";
    $("startCamera").disabled = false;
    $("stopCamera").disabled = true;
    $("cameraStatus").textContent = "Camera is currently off.";
  }
}

$("startCamera").addEventListener("click", startCamera);
$("stopCamera").addEventListener("click", stopCamera);

/* ==========================================
   MOOD TRACKER
========================================== */

const moodEmoji = {
  Happy: "😊",
  Sad: "😔",
  Angry: "😠",
  Anxious: "😟",
  Stressed: "😣",
  Neutral: "😐"
};

$("moodOptions").addEventListener("click", event => {
  const button = event.target.closest("[data-mood]");
  if (!button) return;

  selectedMood = button.dataset.mood;

  document.querySelectorAll("[data-mood]").forEach(item =>
    item.classList.toggle("selected", item === button)
  );
});

$("saveMood").addEventListener("click", () => {
  if (!selectedMood) return notify("Please select a mood first.");

  const moods = read(STORAGE.moods);

  // One entry per user per day. A later check-in updates today's entry.
  const existingIndex = moods.findIndex(m =>
    m.email === currentUser.email && m.date === todayKey()
  );

  const record = {
    email: currentUser.email,
    mood: selectedMood,
    note: $("moodNote").value.trim(),
    date: todayKey(),
    updated: new Date().toISOString()
  };

  if (existingIndex >= 0) moods[existingIndex] = record;
  else moods.push(record);

  write(STORAGE.moods, moods);

  $("moodMessage").textContent = "Your mood has been saved. Thank you for checking in!";
  $("moodNote").value = "";

  renderAll();
  notify("Mood saved successfully!");
});

function renderMoodList(containerId, records) {
  const container = $(containerId);

  if (!records.length) {
    container.innerHTML = "<p class='message'>No mood records yet. Start with your first check-in.</p>";
    return;
  }

  container.innerHTML = records.map(record => `
    <div class="recent-item">
      <div class="recent-left">
        <span class="recent-emoji">${moodEmoji[record.mood] || "💜"}</span>
        <div>
          <b>${escapeHTML(record.mood)}</b>
          <small>${formatDate(record.date)} ${record.note ? "· " + escapeHTML(record.note) : ""}</small>
        </div>
      </div>
      <span>♡</span>
    </div>
  `).join("");
}

function renderMoodHistory() {
  const records = getUserMoods().sort((a, b) => b.date.localeCompare(a.date));
  renderMoodList("moodHistory", records);
  renderMoodList("recentMoods", records.slice(0, 4));
}

function renderCalendar() {
  const year = calendarDate.getFullYear();
  const month = calendarDate.getMonth();

  $("calendarMonth").textContent =
    calendarDate.toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  const moodMap = {};
  getUserMoods().forEach(record => moodMap[record.date] = record.mood);

  const html = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
    .map(day => `<div class="calendar-day-name">${day}</div>`).join("");

  let datesHTML = html;

  for (let i = 0; i < firstDay; i++) {
    datesHTML += "<div></div>";
  }

  for (let day = 1; day <= totalDays; day++) {
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const mood = moodMap[key];
    const isToday = key === todayKey();

    datesHTML += `
      <div class="calendar-date ${mood ? "has-mood" : ""} ${isToday ? "today" : ""}"
        title="${mood ? escapeHTML(mood) : "No mood recorded"}">
        ${day}
        <small>${mood ? moodEmoji[mood] : ""}</small>
      </div>`;
  }

  $("moodCalendar").innerHTML = datesHTML;
}

$("prevMonth").addEventListener("click", () => {
  calendarDate.setMonth(calendarDate.getMonth() - 1);
  renderCalendar();
});

$("nextMonth").addEventListener("click", () => {
  calendarDate.setMonth(calendarDate.getMonth() + 1);
  renderCalendar();
});

/* ==========================================
   PERSONALIZED MINDSET SUGGESTIONS
========================================== */

const mindsetPlans = {
  happy: [
    ["😊", "Practice gratitude", "Write down three moments that brought you joy."],
    ["🌻", "Share positivity", "Send a kind message to someone you appreciate."],
    ["🎨", "Enjoy a hobby", "Make time for an activity that makes you smile."]
  ],
  peaceful: [
    ["🌬️", "Slow breathing", "Take a few gentle breaths and relax your shoulders."],
    ["🧘", "Quiet meditation", "Spend five minutes noticing your breathing."],
    ["🌿", "Nature break", "Spend a little time in a calm outdoor space."]
  ],
  stress: [
    ["📝", "Organize your thoughts", "Write down your tasks and choose one priority."],
    ["☕", "Take a break", "Step away from your work for a few minutes."],
    ["🌬️", "Gentle breathing", "Breathe slowly and comfortably without forcing it."]
  ],
  confident: [
    ["⭐", "Remember your strengths", "Write down three things you have learned."],
    ["🎯", "Small achievements", "Choose one manageable goal and work towards it."],
    ["💬", "Positive self-talk", "Speak to yourself as kindly as you would to a friend."]
  ],
  motivated: [
    ["🚀", "Start small", "Work on your goal for just ten minutes."],
    ["📋", "Make a simple plan", "Break a big task into three small steps."],
    ["🏆", "Celebrate progress", "Recognize the effort you made today."]
  ],
  balanced: [
    ["🌿", "Healthy routine", "Create a simple balance of rest, work and movement."],
    ["💧", "Care for your body", "Drink water and take regular breaks."],
    ["💗", "Emotional check-in", "Notice your feelings without judging them."]
  ]
};

function generateSuggestions() {
  if (!currentUser) return;

  const mindset = $("desiredMindset").value;
  const plan = mindsetPlans[mindset] || mindsetPlans.balanced;

  const container = $("personalSuggestions");

  container.innerHTML = plan.map(item => `
    <article class="suggestion-card">
      <span>${item[0]}</span>
      <h3>${escapeHTML(item[1])}</h3>
      <p>${escapeHTML(item[2])}</p>
    </article>
  `).join("");

  // Add recommendations based on the most recent recorded mood.
  const latest = getUserMoods().sort((a, b) => b.date.localeCompare(a.date))[0];

  if (latest) {
    const emotion = latest.mood === "Anxious" ? "Anxiety" :
      latest.mood === "Stressed" ? "Stress" : latest.mood;

    const data = emotionData[emotion] || emotionData.Neutral;

    container.insertAdjacentHTML("beforeend", `
      <article class="suggestion-card">
        <span>${data.emoji}</span>
        <h3>Based on your latest mood</h3>
        <p>${escapeHTML(data.activities[0])}</p>
      </article>
    `);
  }
}

$("generateSuggestions").addEventListener("click", () => {
  generateSuggestions();
  notify("Your mindset suggestions are ready.");
});

/* ==========================================
   WELLNESS ACTIVITIES
========================================== */

// Breathing exercise
let breathingStep = 0;
let breathingRemaining = 60;

const breathingStages = [
  { text: "Breathe in", duration: 4, expand: true },
  { text: "Breathe out", duration: 6, expand: false }
];

function stopBreathing() {
  clearInterval(breathingInterval);
  breathingInterval = null;
  $("breathingCircle").classList.remove("expand");
}

$("breathingStart").addEventListener("click", () => {
  if (breathingInterval) return;

  breathingRemaining = 60;
  breathingStep = 0;
  runBreathingStep();

  breathingInterval = setInterval(() => {
    breathingRemaining--;

    if (breathingRemaining <= 0) {
      stopBreathing();
      $("breathingText").textContent = "Well done!";
      $("breathingTimer").textContent = "Exercise completed";
      $("breathingStart").textContent = "Start again";
      notify("Breathing exercise completed.");
      return;
    }

    runBreathingStep();
  }, 1000);
});

function runBreathingStep() {
  const stage = breathingStages[breathingStep % 2];

  $("breathingText").textContent = stage.text;
  $("breathingCircle").classList.toggle("expand", stage.expand);
  $("breathingTimer").textContent =
    `${Math.floor(breathingRemaining / 60)}:${String(breathingRemaining % 60).padStart(2, "0")} remaining`;

  breathingStep++;
}

// Meditation timer
function updateMeditationDisplay() {
  const mins = Math.floor(meditationSeconds / 60);
  const secs = meditationSeconds % 60;

  $("meditationDisplay").textContent =
    `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function stopMeditation() {
  clearInterval(meditationInterval);
  meditationInterval = null;
  if ($("meditationStart")) $("meditationStart").textContent = "Start";
}

$("meditationStart").addEventListener("click", () => {
  if (meditationInterval) {
    stopMeditation();
    return;
  }

  if (meditationSeconds <= 0) meditationSeconds = 120;

  $("meditationStart").textContent = "Pause";

  meditationInterval = setInterval(() => {
    meditationSeconds--;
    updateMeditationDisplay();

    if (meditationSeconds <= 0) {
      stopMeditation();
      notify("Your meditation session is complete. Well done!");
      meditationSeconds = 120;
      updateMeditationDisplay();
    }
  }, 1000);
});

$("meditationReset").addEventListener("click", () => {
  stopMeditation();
  meditationSeconds = 120;
  updateMeditationDisplay();
});

updateMeditationDisplay();

// Affirmations
const affirmations = [
  "I am allowed to grow at my own pace.",
  "I deserve kindness and respect.",
  "Small progress is still progress.",
  "I can learn from challenges.",
  "I am worthy of rest and care.",
  "I can take things one step at a time.",
  "My feelings deserve to be heard.",
  "I do not need to be perfect."
];

$("newAffirmation").addEventListener("click", () => {
  const current = $("affirmationText").textContent;
  const choices = affirmations.filter(a => a !== current);
  $("affirmationText").textContent =
    choices[Math.floor(Math.random() * choices.length)];
});

// Gratitude journal
$("saveGratitude").addEventListener("click", () => {
  const note = $("gratitudeInput").value.trim();

  if (note.length < 2) return notify("Write a short gratitude reflection first.");

  const entries = read(STORAGE.gratitude);

  entries.push({
    email: currentUser.email,
    note,
    date: todayKey(),
    created: new Date().toISOString()
  });

  write(STORAGE.gratitude, entries);
  $("gratitudeInput").value = "";

  renderGratitude();
  notify("Your gratitude reflection has been saved.");
});

function renderGratitude() {
  const entries = read(STORAGE.gratitude)
    .filter(g => g.email === currentUser?.email)
    .slice(-3)
    .reverse();

  $("gratitudeHistory").innerHTML = entries.map(entry =>
    `<p>♡ ${escapeHTML(entry.note)} <small>· ${formatDate(entry.date)}</small></p>`
  ).join("");
}

/* ==========================================
   DASHBOARD AND ANALYTICS
========================================== */

function renderDashboard() {
  const records = getUserMoods();
  const todayRecord = records.find(m => m.date === todayKey());

  $("todayMood").textContent = todayRecord
    ? `${moodEmoji[todayRecord.mood]} ${todayRecord.mood}`
    : "Not recorded";

  $("totalMoods").textContent = records.length;

  const activeDays = new Set(records.map(m => m.date)).size;
  $("activeDays").textContent = activeDays;

  // Illustrative score, not a clinical wellness measurement.
  const positive = records.filter(m => m.mood === "Happy").length;
  const score = records.length
    ? Math.round((positive / records.length) * 100)
    : 0;

  $("wellnessScore").textContent = records.length ? `${score}/100` : "--/100";

  renderWeeklyChart("dashboardChart");
  renderMoodHistory();
}

function renderWeeklyChart(containerId) {
  const container = $(containerId);
  const records = getUserMoods();
  const today = new Date();

  const labels = [];

  for (let i = 6; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);

    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

    const entry = records.find(m => m.date === key);

    labels.push({
      label: date.toLocaleDateString("en-IN", { weekday: "short" }),
      mood: entry?.mood || null
    });
  }

  const heights = {
    Happy: 100,
    Neutral: 65,
    Sad: 45,
    Anxious: 55,
    Stressed: 40,
    Angry: 35
  };

  container.innerHTML = labels.map(item => `
    <div class="chart-column">
      <div class="chart-bar"
        title="${item.mood || "No entry"}"
        style="height:${item.mood ? heights[item.mood] : 4}%">
      </div>
      <small>${item.label}</small>
      <small>${item.mood ? moodEmoji[item.mood] : "—"}</small>
    </div>
  `).join("");
}

function renderAnalytics() {
  const records = getUserMoods();

  $("analyticsTotal").textContent = records.length;
  $("analyticsDays").textContent = new Set(records.map(m => m.date)).size;

  const counts = {};

  records.forEach(record => {
    counts[record.mood] = (counts[record.mood] || 0) + 1;
  });

  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  $("topMood").textContent = sorted.length ? sorted[0][0] : "—";

  renderWeeklyChart("weeklyChart");

  const moods = Object.keys(moodEmoji);

  $("distributionChart").innerHTML = moods.map(mood => {
    const count = counts[mood] || 0;
    const percentage = records.length
      ? (count / records.length) * 100
      : 0;

    return `
      <div class="distribution-row">
        <span>${moodEmoji[mood]} ${mood}</span>
        <div class="distribution-track">
          <div class="distribution-fill" style="width:${percentage}%"></div>
        </div>
        <b>${count}</b>
      </div>
    `;
  }).join("");
}

/* ==========================================
   DAILY QUOTES
========================================== */

const quotes = [
  "You don't have to be perfect to make progress.",
  "Every small step forward matters.",
  "Give yourself the same kindness you give others.",
  "It's okay to pause. Rest is part of growth.",
  "Your feelings are valid, and you deserve care.",
  "You are allowed to start again whenever you need.",
  "One peaceful moment can make a difference.",
  "You are more than your difficult days."
];

$("newQuote").addEventListener("click", () => {
  const current = $("dailyQuote").textContent;
  const available = quotes.filter(q => q !== current);

  $("dailyQuote").textContent =
    available[Math.floor(Math.random() * available.length)];
});

/* ==========================================
   INITIALIZATION
========================================== */

function renderAll() {
  renderDashboard();
  renderMoodHistory();
  renderCalendar();
  renderAnalytics();
  generateSuggestions();
  renderGratitude();
}

document.addEventListener("DOMContentLoaded", () => {
  currentUser = getCurrentUser();

  if (currentUser) {
    enterApplication();
  } else {
    $("authScreen").classList.remove("hidden");
    $("appScreen").classList.add("hidden");
    showAuth("loginPanel");
  }
});
