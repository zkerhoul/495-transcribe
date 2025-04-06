import { useEffect, useRef, useState } from "react";

export default function TranscriptionApp() {
  // State to store the full transcription text
  const [transcription, setTranscription] = useState("");
  // Set of words the user has clicked (highlighted)
  const [highlightedWords, setHighlightedWords] = useState(new Set());
  // Currently selected word for definition
  const [selectedWord, setSelectedWord] = useState(null);
  // Definition for the selected word
  const [definition, setDefinition] = useState("");
  // WebSocket reference
  const ws = useRef(null);

  // Connect to the WebSocket server on component mount
  useEffect(() => {
    ws.current = new WebSocket("ws://localhost:8000/ws");
    ws.current.onmessage = (event) => {
      setTranscription(event.data); // Update transcription from backend
    };
    return () => ws.current.close(); // Cleanup on unmount
  }, []);

  // Toggle highlight on a word and fetch its definition
  const toggleHighlight = (word) => {
    setHighlightedWords((prev) => {
      const copy = new Set(prev);
      if (copy.has(word)) copy.delete(word);
      else copy.add(word);
      return copy;
    });

    // Set selected word and get its definition
    setSelectedWord(word);
    fetchDefinition(word);
  };

  // Placeholder for fetching a real definition
  const fetchDefinition = async (word) => {
    setDefinition(`Definition for "${word}" goes here.`);
  };

  // Function to render the transcribed text
  const renderText = () => {
    // Split the transcription into words and spaces (\s+ captures all whitespace)
    return transcription.split(/(\s+)/).map((word, idx) => {
      const cleanWord = word.trim();
      const isWord = /\w+/.test(cleanWord); // Check if the chunk is a word
      const isHighlighted = highlightedWords.has(cleanWord); // Check highlight status

      // If it's a word, make it clickable and stylable
      return isWord ? (
        <span
          key={idx}
          onClick={() => toggleHighlight(cleanWord)}
          style={{
            backgroundColor: isHighlighted ? "#facc15" : "transparent", // Yellow highlight if selected
            cursor: "pointer", // Pointer cursor to indicate interactivity
            position: "relative",
          }}
        >
          {word}
        </span>
      ) : (
        // If it's just whitespace or punctuation, render it normally
        <span key={idx}>{word}</span>
      );
    });
  };

  return (
    <div className="p-4 max-w-2xl mx-auto text-lg leading-relaxed">
      <h1 className="text-2xl font-bold mb-4">Live Transcription</h1>

      {/* Display the transcribed words */}
      <div className="whitespace-pre-wrap bg-gray-100 p-4 rounded-xl shadow-md relative">
        {renderText()}

        {/* Display definition box if a word is selected */}
        {selectedWord && definition && (
          <div className="absolute top-0 left-full ml-4 w-64 p-2 bg-white border rounded-lg shadow-xl text-sm z-10">
            <strong>{selectedWord}</strong>: {definition}
          </div>
        )}
      </div>

      <p className="mt-4 text-sm text-gray-500">
        Click on a word to highlight it and see a definition.
      </p>
    </div>
  );
}
