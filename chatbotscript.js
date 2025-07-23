// Lấy các phần tử cần thiết
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const resetBtn = document.getElementById("reset-btn");
const chatMessages = document.getElementById("chat-messages");

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
    fetch("https://pizzasirojp.vercel.app/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: userMessage,
        sessionId: "user123"
      }),
    })

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
