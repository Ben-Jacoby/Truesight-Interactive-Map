import React, { useState, useRef } from "react";
import Xarrow from "react-xarrows";
import PDFViewer from './components/PDFViewer';

function App() {
  const [boxes, setBoxes] = useState([
    {
      id: "box-1",
      content: "This is some sample text. Try selecting me!",
      position: { x: -200, y: 100 },  
    },
  ]);
  const [connections, setConnections] = useState([]);
  const [selectedText, setSelectedText] = useState("");
  const [activeBox, setActiveBox] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [editingBox, setEditingBox] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [pdfSelection, setPdfSelection] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);
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

  const handlePDFTextSelect = (text, rect, isCurrentlySelecting) => {
    setSelectedText(text);
    setIsSelecting(isCurrentlySelecting);
    setPdfSelection({
      text,
      position: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        absoluteX: rect.absoluteX,
        absoluteY: rect.absoluteY,
        pageNumber: rect.pageNumber
      }
    });
  };

  const callChatGPT = async (textToExplain) => {
    const prompt = `Explain the following concept in simple terms: "${textToExplain}"`;
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.REACT_APP_OPENAI_API_KEY}`,
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

  const findAvailableSpaceForBox = (y, width = 220, height = 100) => {
    // Get both the PDF document and its container
    const scrollOffset = window.scrollY;
    
    // Calculate starting X position right after the PDF viewer
    // pdfBox.left accounts for the PDF viewer's offset from the left edge
    let x = -200;
    const startX = x;
    
    // Rest of the function remains the same...
    const finalY = y - scrollOffset;
    
    const boxesAtSameHeight = boxes.filter(box => 
      Math.abs(box.position.y - finalY) < height
    ).sort((a, b) => a.position.x - b.position.x);

    for (const box of boxesAtSameHeight) {
      if (box.position.x > x + width) {
        break;
      }
      x = box.position.x + width + 20;
    }
    
    return { x: startX, y: finalY };
  };

  const handleGenerateClick = async () => {
    if (!selectedText) return;

    const gptResponse = await callChatGPT(selectedText);
    const newBoxId = `box-${Date.now()}`;

    let position;
    if (pdfSelection) {
      const pageElement = document.querySelector(`#page_${pdfSelection.position.pageNumber}`);
      if (pageElement) {
        const scrollTop = document.querySelector('.pdf-scroll-container')?.scrollTop || 0;
        const y = pageElement.offsetTop + pdfSelection.position.y - scrollTop;
        
        const availableSpace = findAvailableSpaceForBox(y + window.scrollY);
        position = {
          x: availableSpace.x,
          y: availableSpace.y
        };
      }
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
        pdfPosition: {
          x: pdfSelection.position.x,
          y: pdfSelection.position.y,
          width: pdfSelection.position.width,
          height: pdfSelection.position.height,
          pageNumber: pdfSelection.position.pageNumber
        }
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

  const handleSelectionClear = () => {
    setSelectedText("");
    setActiveBox(null);
    setPdfSelection(null);
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
        overflowY: "auto",  // Main scroll for both panels
        overflowX: "hidden"
      }}
    >
      <div style={{ 
        display: "flex",
        width: "100%",
        minHeight: "100%",
        paddingTop: "70px"  // Account for fixed header
      }}>
        <div style={{ 
          flex: "1 1 50%",
          position: "relative"
        }}>
          <PDFViewer 
            onTextSelect={handlePDFTextSelect} 
            darkMode={darkMode}
            onDarkModeToggle={toggleDarkMode}
            selectedText={selectedText}
            pdfSelection={pdfSelection}
            onGenerateClick={handleGenerateClick}
            connections={connections}  // Add this prop
            isSelecting={isSelecting}
            setIsSelecting={setIsSelecting}
            onSelectionClear={handleSelectionClear}
          />
        </div>
        
        <div style={{ 
          width: "50%",
          minWidth: "600px",
          position: "relative"
        }}>
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
                zIndex: 10  // Add higher z-index for boxes
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

          {connections.map((conn, idx) => (
            <Xarrow 
              key={idx} 
              start={conn.from} 
              end={conn.to}
              startAnchor="right"
              endAnchor="left"
              color="rgba(0, 123, 255, 0.4)"
              zIndex={5}  // Lower z-index for arrows, but still above PDF
              strokeWidth={4}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
