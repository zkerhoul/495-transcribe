import { useEffect, useRef, useState } from "react";

export default function TranscriptionApp() {
    const [transcript, setTranscript] = useState([]);
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef(null);

    useEffect(() => {
        if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) {
            alert("Sorry, your browser doesn't support speech recognition.");
            return;
        }

        const SpeechRecognition =
            window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = "en-US";
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event) => {
            let finalTranscript = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                finalTranscript += result[0].transcript;
            }
            setTranscript((prev) => [...prev.slice(0, -1), finalTranscript]);
        };

        recognition.onstart = () => {
            setTranscript(["Listening..."]);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognitionRef.current = recognition;
    }, []);

    const handleListenClick = () => {
        if (!recognitionRef.current) return;
        if (isListening) {
            recognitionRef.current.stop();
            setIsListening(false);
        } else {
            recognitionRef.current.start();
            setIsListening(true);
        }
    };

    return (
        <div style={{ padding: "2rem", fontFamily: "sans-serif", background: "#fff", minHeight: "100vh" }}>
            <h1 style={{ fontSize: "2rem", fontWeight: "bold", marginBottom: "1rem" }}>Live Captioning</h1>

            <div style={{ border: "1px solid #ccc", borderRadius: "1rem", padding: "1rem", maxWidth: "700px", margin: "0 auto" }}>
                {transcript.length === 0 ? (
                    <p style={{ color: "#888" }}>Press start to begin transcription.</p>
                ) : (
                    transcript.map((line, idx) => <p key={idx}>{line}</p>)
                )}
            </div>

            <button
                onClick={handleListenClick}
                style={{
                    marginTop: "2rem",
                    fontSize: "1.2rem",
                    padding: "0.75rem 1.5rem",
                    borderRadius: "0.75rem",
                    border: "2px solid #333",
                    background: isListening ? "#eee" : "#fff",
                    cursor: "pointer"
                }}
            >
                {isListening ? "Stop Listening" : "Start Listening"}
            </button>
        </div>
    );
}
