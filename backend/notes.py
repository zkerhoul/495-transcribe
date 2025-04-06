import os
from google import genai
import PyPDF2
from datetime import datetime

# Configuration
PDF_FOLDER = "save_pdf"  # Folder containing lecture transcriptions
NOTES_FOLDER = "lecture_notes"  # Output folder for study notes
GEMINI_API_KEY = "AIzaSyDdqpWRbNrHIfrpJbksYEdCGVeo6R_xBJw"  # Removed API key as requested
MODEL_NAME = "gemini-1.5-flash"  # Model to use

def initialize_client():
    """Initialize Gemini client with error handling"""
    if not GEMINI_API_KEY:
        print("Error: Gemini API key not configured")
        return None
    try:
        return genai.Client(api_key=GEMINI_API_KEY)
    except Exception as e:
        print(f"Error initializing Gemini client: {str(e)}")
        return None

client = initialize_client()

def extract_text_from_pdf(pdf_path):
    """Safely extract text from lecture transcripts"""
    if not pdf_path or not os.path.exists(pdf_path):
        return "No text :("
    
    try:
        text = ""
        with open(pdf_path, 'rb') as file:
            reader = PyPDF2.PdfReader(file)
            if not reader.pages:
                return "No text :("
                
            for page in reader.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        return text.strip() if text else "No text :("
    except Exception as e:
        print(f"Error reading PDF: {str(e)}")
        return "No text :("

def generate_study_notes(transcript):
    """Generate structured study notes with enhanced error handling"""
    if not client:
        return "Error: Gemini client not initialized"
    if transcript == "No text :(":
        return "No audio in recorded"

    try:
        prompt = f"""Transform this lecture transcript into comprehensive study notes:

        Lecture Content:
        {transcript[:30000]}

        Create notes with these sections:
        1. Key Concepts (Bullet points of main ideas)
        2. Definitions (Important terms with explanations)
        3. Examples (Key examples mentioned)
        4. Formulas/Equations (Highlighted and explained)
        5. Study Questions (3-5 questions to test understanding)
        6. Summary (Concise paragraph of the lecture's essence)
        """
        
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt
        )
        return response.text if hasattr(response, 'text') else "Error: No response from API"
    except Exception as e:
        return f"Error generating notes: {str(e)}"

def process_specific_lecture(filename=None):
    """Process lecture with comprehensive error handling"""
    try:
        pdf_path = os.path.join(PDF_FOLDER, filename) if filename else None
        
        if filename and not os.path.exists(pdf_path):
            print(f"Error: File '{filename}' not found in {PDF_FOLDER}")
            return
            
        text = extract_text_from_pdf(pdf_path)
        notes = generate_study_notes(text)
        
        if filename:
            try:
                lecture_date = filename.split("_")[0] if "_" in filename else datetime.now().strftime("%Y-%m-%d")
                notes_filename = f"notes_{lecture_date}.md"
                notes_path = os.path.join(NOTES_FOLDER, notes_filename)
                
                os.makedirs(NOTES_FOLDER, exist_ok=True)
                
                with open(notes_path, 'w', encoding='utf-8') as f:
                    f.write(f"# Lecture Notes - {lecture_date}\n\n")
                    f.write(notes)
                
                print(f"Successfully saved notes to: {notes_path}")
            except Exception as e:
                print(f"Error saving notes: {str(e)}")
        
        print(notes)
    except Exception as e:
        print(f"Unexpected error: {str(e)}")

if __name__ == "__main__":
    import sys
    filename = sys.argv[1] if len(sys.argv) > 1 else None
    process_specific_lecture(filename)
    print("Operation completed")