const els = {
  chatForm: document.querySelector("#chatForm"),
  chatLog: document.querySelector("#chatLog"),
  focusMode: document.querySelector("#focusMode"),
  questionCount: document.querySelector("#questionCount"),
  resetProfile: document.querySelector("#resetProfile"),
  sendButton: document.querySelector("#sendButton"),
  studentInput: document.querySelector("#studentInput"),
  studentLevel: document.querySelector("#studentLevel"),
  subjectFocus: document.querySelector("#subjectFocus"),
  supportStyle: document.querySelector("#supportStyle"),
  toast: document.querySelector("#toast"),
};

let previousInteractionId = localStorage.getItem("scholarmate.previousInteractionId") || "";
let questions = Number(localStorage.getItem("scholarmate.questions") || 0);

const assistantConfig = {
  apiKey: window.SCHOLARMATE_CONFIG?.GEMINI_API_KEY || localStorage.getItem("scholarmate.apiKey") || "",
  model: window.SCHOLARMATE_CONFIG?.GEMINI_MODEL || localStorage.getItem("scholarmate.model") || "gemini-3.5-flash",
};

const systemInstruction = `You are ScholarMate, an academic support assistant for students.
Be warm, precise, and useful. Help with explanations, planning, revision, writing feedback, coding, math, science, humanities, exam prep, note organization, and motivation.
For homework or graded work, teach the method and guide the student instead of simply completing dishonest submissions. You may provide examples, outlines, checks, and step-by-step reasoning.
For math/science/problem-solving, show the important steps and verify the final answer.
For writing, preserve the student's voice and explain why changes help.
If the student seems stressed, be encouraging and break the next step into something manageable.
Do not invent citations. If sources are needed, say what to look for and how to verify them.`;

function init() {
  els.studentLevel.value = localStorage.getItem("scholarmate.level") || "College / University";
  els.subjectFocus.value = localStorage.getItem("scholarmate.subject") || "";
  els.supportStyle.value = localStorage.getItem("scholarmate.style") || "Socratic tutor";
  updateStats();
}

function updateStats() {
  els.questionCount.textContent = questions.toString();
  els.focusMode.textContent = els.supportStyle.value.split(" ")[0];
}

function persistSettings() {
  localStorage.setItem("scholarmate.level", els.studentLevel.value);
  localStorage.setItem("scholarmate.subject", els.subjectFocus.value.trim());
  localStorage.setItem("scholarmate.style", els.supportStyle.value);
  updateStats();
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.setTimeout(() => els.toast.classList.remove("show"), 3200);
}

function addMessage(role, content, loading = false) {
  const article = document.createElement("article");
  article.className = `message ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = role === "user" ? "You" : "AI";

  const bubble = document.createElement("div");
  bubble.className = `bubble${loading ? " loading" : ""}`;
  bubble.textContent = content;

  article.append(avatar, bubble);
  els.chatLog.append(article);
  els.chatLog.scrollTop = els.chatLog.scrollHeight;
  return bubble;
}

function buildInput(question) {
  const subject = els.subjectFocus.value.trim() || "general academics";
  return `Student profile:
- Level: ${els.studentLevel.value}
- Subject focus: ${subject}
- Preferred support style: ${els.supportStyle.value}

Student request:
${question}`;
}

function extractOutputText(data) {
  if (data.output_text) return data.output_text;

  const textBlocks = [];
  for (const step of data.steps || []) {
    for (const part of step.content || step.parts || []) {
      if (part.text) textBlocks.push(part.text);
      if (part.type === "text" && part.text) textBlocks.push(part.text);
    }
  }

  return textBlocks.join("\n").trim() || "I received a response, but could not find text in it.";
}

async function askGemini(question) {
  console.log("askGemini called with:", question);

  addMessage("user", question);

  const responseBubble = addMessage(
    "assistant",
    "Thinking through this...",
    true
  );

  els.sendButton.disabled = true;

  try {
    console.log("Sending request to /api/chat");

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: question,
      }),
    });

    console.log("Status:", response.status);

    const data = await response.json();

    console.log("Response data:", data);

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    responseBubble.classList.remove("loading");
    responseBubble.textContent =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No response received.";

    questions += 1;
    localStorage.setItem("scholarmate.questions", questions.toString());
    updateStats();

  } catch (error) {
    console.error("Chat error:", error);

    responseBubble.classList.remove("loading");
    responseBubble.textContent =
      `I couldn't answer right now.\n\n${error.message}`;
  } finally {
    els.sendButton.disabled = false;
    els.studentInput.focus();
    els.chatLog.scrollTop = els.chatLog.scrollHeight;
  }
}

els.chatForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const question = els.studentInput.value.trim();

  if (!question) return;

  els.studentInput.value = "";
  els.studentInput.style.height = "auto";

  askGemini(question);
});
