// Lấy các phần tử cần thiết
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const resetBtn = document.getElementById("reset-btn");
const chatMessages = document.getElementById("chat-messages");

// Tạo sessionId động hoặc lấy từ localStorage
function getSessionId() {
  let sessionId = localStorage.getItem('chatSessionId');
  if (!sessionId) {
    sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('chatSessionId', sessionId);
  }
  return sessionId;
}

// Hàm hiển thị tin nhắn vào khung chat
function appendMessage(text, sender) {
  const messageDiv = document.createElement("div");
  messageDiv.classList.add("message");
  messageDiv.classList.add(sender); // "user" hoặc "bot"
  messageDiv.textContent = text;
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight; // tự cuộn xuống dưới
}

// Hàm reset chat
function resetChat() {
  chatMessages.innerHTML = "";
  // Tạo sessionId mới khi reset
  const newSessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  localStorage.setItem('chatSessionId', newSessionId);
  appendMessage("こんにちは！PIZZERIAへようこそ！ご質問があればお知らせください！", "bot");
}

// Gán sự kiện nút gửi
sendBtn.addEventListener("click", sendMessage);

// Gán sự kiện nút reset chat
resetBtn.addEventListener("click", resetChat);

// Cho phép gửi khi nhấn Enter trong ô input
userInput.addEventListener("keypress", function (e) {
  if (e.key === "Enter") {
    sendMessage();
  }
});

async function sendMessage() {
  const text = userInput.value.trim();
  if (text === "") return;

  appendMessage(text, "user");
  userInput.value = "";

  appendMessage("返信中です...", "bot");

  try {
    const response = await fetch("http://localhost:3000/api/chat", { // URL backend rõ ràng
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        sessionId: getSessionId(),
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    const loadingMsg = document.querySelector(".message.bot:last-child");
    if (loadingMsg && loadingMsg.textContent === "返信中です...") {
      loadingMsg.remove();
    }
    appendMessage(data.reply, "bot");
  } catch (error) {
    console.error("Error sending message:", error);
    const loadingMsg = document.querySelector(".message.bot:last-child");
    if (loadingMsg && loadingMsg.textContent === "返信中です...") {
      loadingMsg.remove();
    }
    appendMessage("申し訳ありません。現在返信できません。", "bot");
  }
}

// Khởi tạo chat khi trang được load
document.addEventListener('DOMContentLoaded', function() {
  appendMessage("こんにちは！PIZZERIAへようこそ！ご質問があればお知らせください！", "bot");
});
