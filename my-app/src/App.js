import React, { useState, useRef } from "react";
import Xarrow from "react-xarrows";
import PDFViewer from './components/PDFViewer';

function App() {
  const [boxes, setBoxes] = useState([
    {
      id: "box-1",
      content: "This is some sample text. Try selecting me!",
      position: { x: 50, y: 50 },
    },
  ]);
  const [connections, setConnections] = useState([]);
  const [selectedText, setSelectedText] = useState("");
  const [activeBox, setActiveBox] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [editingBox, setEditingBox] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [pdfSelection, setPdfSelection] = useState(null);
  const offset = useRef({ x: 0, y: 0 });

  const getSelectedText = () => {
    const selection = window.getSelection();
    return selection ? selection.toString() : "";
  };

  const handleMouseUp = (boxId) => {
    if (editingBox) return;
    const text = getSelectedText();
    if (text) {
      setSelectedText(text);
      setActiveBox(boxId);
    } else {
      setSelectedText("");
      setActiveBox(null);
    }
  };

  const handlePDFTextSelect = (text, rect) => {
    setSelectedText(text);
    setPdfSelection({
      text,
      position: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      }
    });
  };

  const callChatGPT = async (textToExplain) => {
    const prompt = `Explain the following concept in simple terms: "${textToExplain}"`;
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer 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`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await response.json();
    return data.choices?.[0]?.message?.content || "No explanation available.";
  };

  const findNextAvailablePosition = (startX, startY) => {
    const offsetX = 250;
    const offsetY = 120;
    let x = startX;
    let y = startY;

    if (!boxes.some((box) => box.position.x === x + offsetX && box.position.y === y)) {
      return { x: x + offsetX, y };
    }

    if (!boxes.some((box) => box.position.x === x && box.position.y === y + offsetY)) {
      return { x, y: y + offsetY };
    }

    let maxY = Math.max(...boxes.map((box) => box.position.y));
    return { x: 50, y: maxY + offsetY };
  };

  const handleGenerateClick = async () => {
    if (!selectedText) return;

    const gptResponse = await callChatGPT(selectedText);
    const newBoxId = `box-${Date.now()}`;

    let position;
    if (pdfSelection) {
      position = {
        x: pdfSelection.position.x + pdfSelection.position.width + 50,
        y: pdfSelection.position.y
      };
    } else {
      const selectedBox = boxes.find((box) => box.id === activeBox);
      if (!selectedBox) return;
      position = findNextAvailablePosition(selectedBox.position.x, selectedBox.position.y);
    }

    const newBox = {
      id: newBoxId,
      content: gptResponse,
      position
    };

    setBoxes(prevBoxes => [...prevBoxes, newBox]);
    
    if (pdfSelection) {
      const highlightId = `highlight-${Date.now()}`;
      setConnections(prevConns => [...prevConns, { 
        from: highlightId, 
        to: newBoxId,
        pdfPosition: pdfSelection.position 
      }]);
    } else if (activeBox) {
      setConnections(prevConns => [...prevConns, { from: activeBox, to: newBoxId }]);
    }

    setSelectedText("");
    setActiveBox(null);
    setPdfSelection(null);
  };

  const handleMouseDown = (e, boxId) => {
    if (e.target.classList.contains("text-content") || editingBox) return;

    setDragging(boxId);
    const box = boxes.find((b) => b.id === boxId);
    if (box) {
      offset.current = {
        x: e.clientX - box.position.x,
        y: e.clientY - box.position.y,
      };
    }
  };

  const handleMouseMove = (e) => {
    if (!dragging) return;

    setBoxes((prevBoxes) =>
      prevBoxes.map((box) =>
        box.id === dragging
          ? {
              ...box,
              position: {
                x: e.clientX - offset.current.x,
                y: e.clientY - offset.current.y,
              },
            }
          : box
      )
    );
  };

  const handleMouseUpGlobal = () => {
    setDragging(null);
    if (!getSelectedText()) {
      setSelectedText("");
      setActiveBox(null);
    }
  };

  const handleDoubleClick = (boxId) => {
    setEditingBox(boxId);
  };

  const handleEditChange = (e, boxId) => {
    setBoxes((prevBoxes) =>
      prevBoxes.map((box) =>
        box.id === boxId ? { ...box, content: e.target.value } : box
      )
    );
  };

  const handleEditBlur = () => {
    setEditingBox(null);
  };

  const toggleDarkMode = () => {
    setDarkMode((prevMode) => !prevMode);
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUpGlobal}
      style={{
        width: "100vw",
        height: "100vh",
        position: "relative",
        background: darkMode ? "#333" : "#f9f9f9",
        color: darkMode ? "#f9f9f9" : "#333",
        display: "flex",
        transition: "background 0.5s, color 0.5s",
      }}
    >
      <div style={{ width: "50%", height: "100vh", overflowY: "auto", borderRight: "1px solid #ccc" }}>
        <PDFViewer onTextSelect={handlePDFTextSelect} />
      </div>
      
      <div style={{ width: "50%", height: "100vh", position: "relative" }}>
        <button
          onClick={toggleDarkMode}
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            padding: "8px 12px",
            background: darkMode ? "#555" : "#007bff",
            color: "white",
            border: "none",
            cursor: "pointer",
            borderRadius: "8px",
            fontSize: "14px",
            boxShadow: "2px 2px 6px rgba(0, 0, 0, 0.15)",
            transition: "background 0.5s",
          }}
        >
          Toggle Dark Mode
        </button>

        {boxes.map((box) => (
          <div
            key={box.id}
            id={box.id}
            style={{
              position: "absolute",
              left: box.position.x,
              top: box.position.y,
              border: darkMode ? "2px solid #555" : "2px solid #ccc",
              padding: "12px",
              width: "220px",
              backgroundColor: darkMode ? "#444" : "white",
              cursor: "grab",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              borderRadius: "12px",
              boxShadow: darkMode ? "4px 4px 10px rgba(0, 0, 0, 0.5)" : "4px 4px 10px rgba(0, 0, 0, 0.1)",
              transition: "background-color 0.5s, border 0.5s, box-shadow 0.5s",
            }}
            onMouseDown={(e) => handleMouseDown(e, box.id)}
            onDoubleClick={() => handleDoubleClick(box.id)}
          >
            <div
              style={{
                width: "100%",
                height: "8px",
                cursor: "grab",
                backgroundColor: darkMode ? "#666" : "#ddd",
                borderRadius: "12px 12px 0 0",
                transition: "background-color 0.5s",
              }}
              onMouseDown={(e) => handleMouseDown(e, box.id)}
            />
            {editingBox === box.id ? (
              <textarea
                autoFocus
                className="text-content"
                value={box.content}
                onChange={(e) => handleEditChange(e, box.id)}
                onBlur={handleEditBlur}
                style={{
                  padding: "8px",
                  width: "100%",
                  height: "60px",
                  border: "none",
                  outline: "none",
                  resize: "none",
                  fontSize: "14px",
                  borderRadius: "12px",
                  backgroundColor: darkMode ? "#555" : "white",
                  color: darkMode ? "#f9f9f9" : "#333",
                  transition: "background-color 0.5s, color 0.5s",
                }}
              />
            ) : (
              <div
                className="text-content"
                style={{
                  padding: "8px",
                  cursor: "text",
                  userSelect: "text",
                  width: "100%",
                }}
                onMouseUp={() => handleMouseUp(box.id)}
              >
                {box.content}
              </div>
            )}
          </div>
        ))}

        {connections.map((conn, idx) => {
          if (conn.pdfPosition) {
            const anchorStyle = {
              position: 'absolute',
              left: conn.pdfPosition.x,
              top: conn.pdfPosition.y,
              width: conn.pdfPosition.width,
              height: conn.pdfPosition.height,
              backgroundColor: 'rgba(255, 255, 0, 0.3)',
              pointerEvents: 'none'
            };
            return (
              <React.Fragment key={idx}>
                <div id={conn.from} style={anchorStyle} />
                <Xarrow start={conn.from} end={conn.to} />
              </React.Fragment>
            );
          }
          return <Xarrow key={idx} start={conn.from} end={conn.to} />;
        })}

        {(selectedText || pdfSelection) && (
          <button
            onClick={handleGenerateClick}
            style={{
              position: "absolute",
              top: "10px",
              left: "10px",
              padding: "8px 12px",
              background: "#007bff",
              color: "white",
              border: "none",
              cursor: "pointer",
              borderRadius: "8px",
              fontSize: "14px",
              boxShadow: "2px 2px 6px rgba(0, 0, 0, 0.15)",
            }}
          >
            Generate Explanation
          </button>
        )}
      </div>
    </div>
  );
}

export default App;
