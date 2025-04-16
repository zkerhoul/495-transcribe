import google.generativeai as genai

# Configure the Gemini client
genai.configure(api_key="AIzaSyDdqpWRbNrHIfrpJbksYEdCGVeo6R_xBJw")

# Simple in-memory cache
definition_cache = {}

# Create the model
generation_config = {
    "temperature": 0.2,
    "top_p": 0.95,
    "top_k": 40,
    "max_output_tokens": 8192,
    "response_mime_type": "text/plain",
}

model = genai.GenerativeModel(
    model_name="gemini-1.5-flash",
    generation_config=generation_config,
)

chat_session = model.start_chat(
    history=[
    ]
)


def get_definition(word: str) -> str:
    word = word.lower().strip()

    # Check if already cached
    if word in definition_cache:
        return definition_cache[word]

    prompt = f"Give a simple definition of the word \"{word}\"."

    try:
        response = chat_session.send_message(prompt)
        definition = response.text.strip()
        definition_cache[word] = definition
        return definition
    except Exception as e:
        print("Gemini error:", e)
        response = "Sorry, I couldn't define that word right now."
        return response.text.strip()


def get_notes(transcript: str) -> str:
    transcript = transcript.strip()

    prompt = f"Provide notes for the following transcript: \"{transcript}\". Don't use any text formatting (bold, italics, etc.) except for separating unique ideas into paragraphs"

    try:
        response = chat_session.send_message(prompt)
        notes = response.text.strip()
        return notes
    except Exception as e:
        print("Gemini error:", e)
        response = "Sorry, I couldn't generate notes right now."
        return response.text.strip()
