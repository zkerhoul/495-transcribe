import { useEffect, useRef, useState } from "react";
import jsPDF from "jspdf";

export default function TranscriptionApp() {
  const [transcription, setTranscription] = useState("");
  const [highlightedWords, setHighlightedWords] = useState(new Set());
  const [selectedWord, setSelectedWord] = useState(null);
  const [definition, setDefinition] = useState("");
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [micList, setMicList] = useState([]);
  const [selectedMic, setSelectedMic] = useState(null);
  const ws = useRef(null);

  useEffect(() => {
    const fetchMicrophones = async () => {
      try {
        const res = await fetch("http://localhost:8000/list_microphones");
        const data = await res.json();
        setMicList(data.devices);
        if (data.devices.length > 0) setSelectedMic(0);
      } catch (error) {
        console.error("Failed to fetch microphones:", error);
      }
    };

    fetchMicrophones();
  }, []);

  const setMicrophone = async (index) => {
    try {
      const formData = new FormData();
      formData.append("device_index", index);

      const res = await fetch("http://localhost:8000/set_microphone", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      console.log(data.message || data.error);
      setSelectedMic(index);
    } catch (error) {
      console.error("Failed to set microphone:", error);
    }
  };
  const connectWebSocket = async () => {
    try {
      await fetch("http://localhost:8000/reset", { method: "POST" });
    } catch (error) {
      console.error("Failed to reset backend transcription:", error);
    }

    const socket = new WebSocket("ws://localhost:8000/ws");

    socket.onopen = () => {
      console.log("WebSocket connection opened");
      setIsTranscribing(true);
      setTranscription("");
    };

    socket.onmessage = (event) => {
      setTranscription(event.data);
    };

    socket.onclose = () => {
      console.log("WebSocket connection closed");
      setIsTranscribing(false);
    };

    socket.onerror = (error) => {
      console.error("WebSocket error:", error);
      setIsTranscribing(false);
    };

    ws.current = socket;
  };

  const startTranscription = () => {
    setTranscription("");
    setHighlightedWords(new Set());
    setSelectedWord(null);
    setDefinition("");

    if (!ws.current || ws.current.readyState >= WebSocket.CLOSING) {
      connectWebSocket();
    }
  };

  const stopTranscription = () => {
    if (ws.current) {
      ws.current.close();
      ws.current = null;
      saveTranscriptAsPDF();
      fetchNotes();
      setTranscription("");
      setHighlightedWords(new Set());
      setSelectedWord(null);
      setDefinition("");
    }
  };

  const toggleHighlight = (word) => {
    setHighlightedWords((prev) => {
      const copy = new Set(prev);
      if (copy.has(word)) copy.delete(word);
      else copy.add(word);
      return copy;
    });

    setSelectedWord(word);
    fetchDefinition(word);
  };

  const fetchDefinition = async (word) => {
    try {
      const res = await fetch(
        `http://localhost:8000/define?word=${encodeURIComponent(word)}`
      );
      const data = await res.json();
      setDefinition(data.definition);
    } catch (error) {
      console.error("Failed to fetch definition:", error);
      setDefinition("Sorry, no definition available.");
    }
  };

  const fetchNotes = async () => {
    try {
      const res = await fetch("http://localhost:8000/notes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ transcription }),
      });
      const data = await res.json();

      if (data.notes) {
        saveNotesAsPDF(data.notes);
      } else {
        console.error("No notes received.");
      }
    } catch (error) {
      console.error("Failed to fetch notes:", err);
    }
  };

  const saveTranscriptAsPDF = () => {
    const doc = new jsPDF();
    const cleaned = transcription.replace(/\s+/g, " ").trim();
    const lines = doc.splitTextToSize(cleaned, 180);
    doc.text(lines, 10, 10);
    doc.save("transcript.pdf");
  };

  const saveNotesAsPDF = (notes) => {
    const doc = new jsPDF();
    // const cleaned = notes.replace(/\s+/g, " ").trim();
    const lines = doc.splitTextToSize(notes, 180);
    doc.text(lines, 10, 10);
    doc.save("notes.pdf");
  };

  const renderText = () => {
    return transcription.split(/(\s+)/).map((word, idx) => {
      const cleanWord = word.trim();
      const isWord = /\w+/.test(cleanWord);
      const isHighlighted = highlightedWords.has(cleanWord);

      return isWord ? (
        <span
          key={idx}
          onClick={() => toggleHighlight(cleanWord)}
          style={{
            color: isHighlighted ? "#7e22ce" : "inherit",
            cursor: "pointer",
            position: "relative",
          }}
        >
          {word}
        </span>
      ) : (
        <span key={idx}>{word}</span>
      );
    });
  };

  return (
    <div className="max-w-2xl mx-auto text-lg leading-relaxed px-4 pt-2">
      <header className="sticky top-0 z-10 bg-white pb-2 pt-2 shadow-md border-b">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">Live Transcription</h1>
          <div className="flex gap-2 items-center">
            <button
              onClick={startTranscription}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              disabled={isTranscribing}
            >
              Start
            </button>
            <button
              onClick={stopTranscription}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              disabled={!isTranscribing}
            >
              Stop & Save PDF
            </button>
            <div className="flex items-center gap-1">
              <label className="text-sm font-medium mr-1">Mic:</label>
              <select
                value={selectedMic ?? ""}
                onChange={(e) => setMicrophone(Number(e.target.value))}
                className="px-2 py-1 border border-gray-300 rounded bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {micList.map((label, idx) => (
                  <option key={idx} value={idx}>
                    {label || `Microphone ${idx}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </header>

      <div className="mt-2 whitespace-pre-wrap bg-gray-100 p-4 rounded-xl shadow-md relative min-h-[150px]">
        {renderText()}
        {selectedWord && definition && (
          <div className="absolute top-0 left-full ml-4 w-64 p-2 bg-white border rounded-lg shadow-xl text-sm z-10">
            <strong>{selectedWord}</strong>: {definition}
          </div>
        )}
      </div>
    </div>
  );
}
