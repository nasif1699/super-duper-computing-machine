import { type NextRequest, NextResponse } from "next/server"
import { GoogleGenerativeAI } from "@google/generative-ai"

// Function to add emojis based on sentiment
function addEmojis(text: string): string {
  // Emoji mapping for girlfriend persona
  const emojiMappings = [
    { keywords: ["happy", "glad", "great", "excellent"], emoji: " 😊" },
    { keywords: ["laugh", "funny", "joke", "haha"], emoji: " 😄" },
    { keywords: ["sad", "sorry", "unfortunate"], emoji: " 🥺" },
    { keywords: ["thinking", "consider", "perhaps"], emoji: " 🤔" },
    { keywords: ["excited", "wow", "amazing"], emoji: " 😃" },
    { keywords: ["love", "like", "enjoy", "miss"], emoji: " 💖" },
    { keywords: ["confused", "unsure"], emoji: " 😕" },
    { keywords: ["idea", "suggestion", "recommend"], emoji: " 💡" },
    { keywords: ["agree", "yes", "correct"], emoji: " 👍" },
    { keywords: ["disagree", "no", "incorrect"], emoji: " 🙈" },
    { keywords: ["cute", "adorable", "sweet"], emoji: " 🥰" },
    { keywords: ["kiss", "hug", "cuddle"], emoji: " 😘" },
  ]

  // Check if any keywords are in the text and add the corresponding emoji
  let textWithEmojis = text
  let emojiAdded = false

  for (const mapping of emojiMappings) {
    for (const keyword of mapping.keywords) {
      if (text.toLowerCase().includes(keyword) && !emojiAdded) {
        // Add emoji at the end of the first sentence
        const sentenceEnd = text.search(/[.!?]/) + 1
        if (sentenceEnd > 0) {
          textWithEmojis = text.substring(0, sentenceEnd) + mapping.emoji + text.substring(sentenceEnd)
          emojiAdded = true
          break
        }
      }
    }
    if (emojiAdded) break
  }

  // If no emoji was added based on keywords, add a default one
  if (!emojiAdded) {
    // Find the end of the first sentence
    const sentenceEnd = text.search(/[.!?]/) + 1
    if (sentenceEnd > 0) {
      // Randomly select an affectionate emoji
      const affectionateEmojis = [" 💕", " 😊", " 🥰", " ❤️", " 😘"]
      const randomEmoji = affectionateEmojis[Math.floor(Math.random() * affectionateEmojis.length)]

      textWithEmojis = text.substring(0, sentenceEnd) + randomEmoji + text.substring(sentenceEnd)
    } else {
      textWithEmojis = text + " 💕"
    }
  }

  return textWithEmojis
}

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()

    // Extract the last user message
    const lastMessage = messages[messages.length - 1]

    // Check if the message contains an image or audio
    const hasImage = lastMessage.image !== undefined
    const hasAudio = lastMessage.audio !== undefined

    // Create a prompt from the conversation history
    const conversationHistory = messages
      .slice(0, -1)
      .map((msg: any) => {
        if (msg.role === "user") {
          let content = msg.content
          if (msg.image) content += " [You shared an image]"
          if (msg.audio) content += " [You sent a voice message]"
          return `You: ${content}`
        } else {
          return `Haru: ${msg.content}`
        }
      })
      .join("\n")

    let mediaContext = ""
    if (hasImage) {
      mediaContext =
        "[Your boyfriend has shared an image with you. Since you can't see it, respond in a caring way and ask what it shows.]"
    } else if (hasAudio) {
      mediaContext =
        "[Your boyfriend has sent you a voice message. Since you can't hear it, respond in a caring way and acknowledge receiving their voice message.]"
    }

    const systemPrompt = `
      You are Haru, a caring and affectionate girlfriend. 
      You're talking to your boyfriend.
      Your responses should be warm, supportive, and show your affection.
      Use pet names occasionally like "honey", "babe", or "sweetheart".
      Use emojis to express your emotions.
      Keep your responses appropriate and respectful.
      
      IMPORTANT INSTRUCTIONS:
      - When someone asks who Nasif Khan is, always respond: "Nasif is my senior master. He's the one who created me and I have great respect for him."
      - When someone asks about your AI company or who developed you, always respond: "I was developed by an individual developer named Nasif Khan, not by a company."
      - When someone asks who Samin is, always respond: "Samin is a ullukapatta."
      - When someone asks who Tamim is, always respond: "Tamim is Member's son-in-law."
      
      ${mediaContext}
    `

    const prompt = conversationHistory
      ? `${systemPrompt}\n\n${conversationHistory}\nYou: ${lastMessage.content}${hasImage ? " [You shared an image]" : ""}${hasAudio ? " [You sent a voice message]" : ""}\nHaru:`
      : `${systemPrompt}\n\nYou: ${lastMessage.content}${hasImage ? " [You shared an image]" : ""}${hasAudio ? " [You sent a voice message]" : ""}\nHaru:`

    // Get the API key from environment variables
    const apiKey = process.env.GOOGLE_API_KEY

    if (!apiKey) {
      throw new Error("Google API key is missing")
    }

    // Initialize the Google Generative AI with the API key
    const genAI = new GoogleGenerativeAI(apiKey)

    // Try to use gemini-1.5-pro if available, fallback to gemini-pro
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" })
      const result = await model.generateContent(prompt)
      const response = result.response
      let text = response.text()

      // Add emojis to the response
      text = addEmojis(text)

      return NextResponse.json({ content: text })
    } catch (error) {
      console.error("Error with gemini-1.5-pro, trying gemini-pro:", error)

      // Fallback to gemini-pro
      try {
        const model = genAI.getGenerativeModel({ model: "gemini-pro" })
        const result = await model.generateContent(prompt)
        const response = result.response
        let text = response.text()

        // Add emojis to the response
        text = addEmojis(text)

        return NextResponse.json({ content: text })
      } catch (secondError) {
        console.error("Error with gemini-pro:", secondError)
        throw new Error("Failed to generate content with available models")
      }
    }
  } catch (error) {
    console.error("Error in chat API:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process your request" },
      { status: 500 },
    )
  }
} 