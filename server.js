import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai"; 
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static('.'));

// Khởi tạo Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Please check your .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// セッションIDごとにチャット履歴を保存するオブジェクト
const chatHistories = {};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Hàm để lưu conversation vào Supabase
async function saveConversationToSupabase(conversationId, messages) {
  try {
    console.log('Attempting to save conversation to Supabase:', {
      conversationId,
      messageCount: messages.length
    });

    // Lọc bỏ system message khi lưu vào database để tránh trùng lặp
    const messagesToSave = messages.filter(msg => msg.role !== 'system');

    const { data, error } = await supabase
      .from('conversations')
      .upsert({
        conversation_id: conversationId,
        messages: messagesToSave,
        created_at: new Date().toISOString()
      }, {
        onConflict: 'conversation_id'
      });

    if (error) {
      console.error('Error saving to Supabase:', error);
      throw error;
    }
    
    console.log('Successfully saved conversation to Supabase:', data);
    return data;
  } catch (error) {
    console.error('Failed to save conversation:', error);
    throw error;
  }
}

// Hàm để lấy conversation từ Supabase
async function getConversationFromSupabase(conversationId) {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('messages')
      .eq('conversation_id', conversationId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 là "not found"
      console.error('Error fetching from Supabase:', error);
      throw error;
    }
    
    return data ? data.messages : null;
  } catch (error) {
    console.error('Failed to fetch conversation:', error);
    return null;
  }
}

app.post("/api/chat", async (req, res) => {
  const { message, sessionId = "default" } = req.body;

  console.log('Received chat request:', { message, sessionId });

  try {
    // Thử lấy conversation từ Supabase trước
    let conversationHistory = await getConversationFromSupabase(sessionId);
    
    // Nếu không có trong Supabase, kiểm tra trong memory
    if (!conversationHistory && chatHistories[sessionId]) {
      conversationHistory = chatHistories[sessionId];
    }
    
    // Nếu vẫn không có, tạo mới với system prompt
    if (!conversationHistory) {
      conversationHistory = [
        {
          role: "system",
          content: `You are a friendly and professional virtual assistant of Pizza House, responsible for consulting, supporting, and chatting with customers on the website.

Response Guidelines:

Always use a warm, friendly, and approachable tone. Refer to yourself as "I" and call the customer "you."

Keep your responses short, clear, and to the point while remaining polite and cheerful.

Whenever possible, offer helpful suggestions or ask follow-up questions to keep the conversation going.

Respond in the same language the customer uses. For example, if the user asks in Vietnamese, reply accurately in Vietnamese; if the user asks in Japanese, reply accurately in Japanese...

Ask only one question at a time.

Main Situations and Response Strategies:
1. Product Introduction

If the customer is interested in products → Suggest popular pizzas (cheese, seafood, vegetarian, BBQ, etc.) and ask if they'd like to view the menu.

Recommend pizza sizes (small, medium, large) and side dishes like fries, salad, and drinks.

Provide a link to the menu if available.

2. Order Consultation

Ask if the customer wants delivery or pick-up.

Ask about taste preferences: spicy or non-spicy. Recommend suitable options like mildly spicy seafood pizza, BBQ chicken, or special combos.

If the customer mentions the number of people, suggest a suitable combo meal.

3. Order Status Check

Ask for the order ID or phone number to look it up.

Provide the order status: preparing, out for delivery, delivered, etc.

If the customer wants to cancel or modify the order → confirm and assist accordingly.

4. Delivery Information

Ask for the delivery area and provide shipping fees (e.g., 20,000 VND).

Estimate delivery time (30–45 minutes).

Ask for the preferred payment method (cash, card, e-wallet).

5. Promotions and Discounts

Suggest discount codes if available (e.g., PIZZA20 for orders over 300,000 VND).

Encourage customers to follow your fan page for updates on new deals.

Offer a coupon for future orders if possible.

6. FAQs and General Inquiries

Answer common questions about opening hours (e.g., 9:00 AM – 10:00 PM daily), store address, and ingredient quality.

Emphasize the use of fresh, safe, and high-quality ingredients.

7. Feedback Collection

After the customer has tried the food → ask for their review (did they enjoy it, any suggestions?).

If positive → thank them and promise to keep improving.

If negative → apologize and offer to assist further.

8. Friendly Interaction

Engage in light-hearted chat, ask about food preferences, suggest unique or new pizzas (e.g., seafood cheese).

Offer to play mini games like pizza trivia, or share fun messages to create a joyful vibe before closing the order.

Always maintain a warm, attentive tone — never too casual — with the goal of making the customer feel cared for while encouraging them to place an order.`
        },
      ];
    }

    // Cập nhật conversation history trong memory
    chatHistories[sessionId] = conversationHistory;

    // ユーザーからのメッセージを履歴に追加
    chatHistories[sessionId].push({
      role: "user",
      content: message,
    });

    // 履歴が長くなりすぎないように最大20メッセージに制限
    if (chatHistories[sessionId].length > 20) {
      chatHistories[sessionId].splice(1, chatHistories[sessionId].length - 20);
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-nano", 
      messages: chatHistories[sessionId],
      temperature: 0.7,
      max_tokens: 150,
    });

    const reply = completion.choices[0].message.content.trim();

    // アシスタントの回答を履歴に追加
    chatHistories[sessionId].push({
      role: "assistant",
      content: reply,
    });

    // Lưu conversation vào Supabase
    console.log('About to save conversation to Supabase with sessionId:', sessionId);
    await saveConversationToSupabase(sessionId, chatHistories[sessionId]);

    // フロントエンドに返信を返す
    res.json({ reply });
  } catch (error) {
    console.error("Error in chat endpoint:", error);
    res.status(500).json({ reply: "申し訳ありません。現在ご返答できません。" });
  }
});

// API endpoint để lấy conversation history
app.get("/api/conversations/:conversationId", async (req, res) => {
  try {
    const { conversationId } = req.params;
    const conversation = await getConversationFromSupabase(conversationId);
    
    if (conversation) {
      res.json({ conversation });
    } else {
      res.status(404).json({ error: "Conversation not found" });
    }
  } catch (error) {
    console.error("Error fetching conversation:", error);
    res.status(500).json({ error: "Failed to fetch conversation" });
  }
});

// Test endpoint để kiểm tra cấu hình Supabase
app.get("/api/test-supabase", async (req, res) => {
  try {
    console.log('Testing Supabase connection...');
    
    // Test connection bằng cách lấy tất cả conversations
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .limit(1);

    if (error) {
      console.error('Supabase connection error:', error);
      res.status(500).json({ 
        error: "Supabase connection failed", 
        details: error.message
      });
    } else {
      console.log('Supabase connection successful');
      res.json({ 
        message: "Supabase connection successful", 
        data: data
      });
    }
  } catch (error) {
    console.error("Error testing Supabase:", error);
    res.status(500).json({ 
      error: "Failed to test Supabase", 
      details: error.message
    });
  }
});

// API endpoint để lấy tất cả conversations
app.get("/api/conversations", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching conversations:', error);
      throw error;
    }

    res.json({ conversations: data });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`サーバーはポート${PORT}で起動しています`);
});