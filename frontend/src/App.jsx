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
    <div
      style={{
        maxWidth: "768px",
        margin: "0 auto",
        padding: "1rem",
        fontSize: "1.125rem",
        lineHeight: "1.75rem",
      }}
    >
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 10,
          backgroundColor: "white",
          padding: "0.5rem 0",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
          }}
        >
          <h1 style={{ fontSize: "1.5rem", fontWeight: "bold" }}>
            Live Transcription
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <button
              onClick={startTranscription}
              disabled={isTranscribing}
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: "#16a34a",
                color: "white",
                borderRadius: "0.375rem",
                opacity: isTranscribing ? 0.5 : 1,
              }}
            >
              Start
            </button>
            <button
              onClick={stopTranscription}
              disabled={!isTranscribing}
              style={{
                padding: "0.5rem 1rem",
                backgroundColor: "#dc2626",
                color: "white",
                borderRadius: "0.375rem",
                opacity: !isTranscribing ? 0.5 : 1,
              }}
            >
              Stop & Save PDF
            </button>
            <div
              style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}
            >
              <label style={{ fontSize: "0.875rem", fontWeight: 500 }}>
                Mic:
              </label>
              <select
                value={selectedMic ?? ""}
                onChange={(e) => setMicrophone(Number(e.target.value))}
                style={{
                  padding: "0.25rem 0.5rem",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.375rem",
                  backgroundColor: "white",
                }}
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

      <div style={{ position: "relative" }}>
        <div
          style={{
            marginTop: "0.5rem",
            backgroundColor: "#f3f4f6",
            padding: "1rem",
            borderRadius: "0.75rem",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
            minHeight: "150px",
            whiteSpace: "pre-wrap",
            maxHeight: "400px",
            overflowY: "auto",
          }}
        >
          {renderText()}
        </div>

        {selectedWord && definition && (
          <div
            style={{
              position: "absolute",
              top: 0,
              right: "-18rem",
              width: "16rem",
              padding: "0.5rem",
              backgroundColor: "white",
              border: "1px solid #d1d5db",
              borderRadius: "0.5rem",
              boxShadow: "0 10px 15px rgba(0, 0, 0, 0.1)",
              fontSize: "0.875rem",
              zIndex: 10,
            }}
          >
            <strong>{selectedWord}</strong>: {definition}
          </div>
        )}
      </div>
    </div>
  );
}