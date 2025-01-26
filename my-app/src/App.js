import React, { useState, useRef, useCallback } from "react";
import Xarrow from "react-xarrows";
import PDFViewer from './components/PDFViewer';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

function App() {
  const [maxZIndex, setMaxZIndex] = useState(10);
  
  // Add initial welcome message as a constant
  const WELCOME_MESSAGE = "Welcome! You can select text in a box to generate explanations. Alternatively, upload a PDF and select text from it to generate explanations.";

  // Create a function to initialize the first box using the same logic
  const createInitialBox = () => {
    const tempElement = document.createElement('div');
    tempElement.style.visibility = 'hidden';
    tempElement.style.position = 'absolute';
    tempElement.style.width = 'auto';
    tempElement.style.whiteSpace = 'pre-wrap';
    tempElement.style.fontSize = '14px';
    tempElement.style.padding = '8px';
    tempElement.innerText = WELCOME_MESSAGE;
    document.body.appendChild(tempElement);
    
    const width = Math.min(Math.max(tempElement.offsetWidth + 40, 220), 400);
    document.body.removeChild(tempElement);

    return {
      id: "box-1",
      content: WELCOME_MESSAGE,
      position: { x: -200, y: 100 },
      zIndex: 10,
      width: width
    };
  };

  // Initialize boxes state with useEffect to ensure DOM is available
  const [boxes, setBoxes] = useState([]);
  
  React.useEffect(() => {
    if (boxes.length === 0) {
      setBoxes([createInitialBox()]);
    }
  }, [boxes.length]);

  const [connections, setConnections] = useState([]);
  const [selectedText, setSelectedText] = useState("");
  const [activeBox, setActiveBox] = useState(null);
  const [dragging, setDragging] = useState(null);
  const [editingBox, setEditingBox] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [pdfSelection, setPdfSelection] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const offset = useRef({ x: 0, y: 0 });

  // Add new state for context menu
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, boxId: null });

  // Add new state to track new boxes for animation
  const [newBoxIds, setNewBoxIds] = useState(new Set());

  // Add new state for tracking new connections
  const [newConnIds, setNewConnIds] = useState(new Set());

  const getSelectedText = () => {
    const selection = window.getSelection();
    return selection ? selection.toString() : "";
  };

  const handleMouseUp = (boxId) => {
    if (editingBox) return;
    const text = window.getSelection().toString().trim();
    if (text) {
      setSelectedText(text);
      setActiveBox(boxId);
      setIsSelecting(true);  // Add this line
    } else {
      setSelectedText("");
      setActiveBox(null);
      setIsSelecting(false); // Add this line
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
    const prompt = `Explain the following concept in simple terms in 5 sentences or less. Use LaTeX notation where appropriate for mathematical expressions (enclosed in $ signs for inline math and $$ for block math). Don't lie.: "${textToExplain}"`;
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
    const gridX = 230;  // Reduced from 250
    const gridY = 120;  // Reduced from 150
    const spacing = 12; // Reduced from 20
    const maxWidth = 400;
    const boxHeight = 120; // Reduced from 150

    // Create a grid of occupied spaces
    const occupiedSpaces = boxes.map(box => ({
      left: box.position.x - spacing,
      right: box.position.x + (box.width || 220) + spacing,
      top: box.position.y - spacing,
      bottom: box.position.y + boxHeight + spacing
    }));

    // Check if a position is valid
    const isPositionValid = (x, y) => {
      const proposedSpace = {
        left: x - spacing,
        right: x + maxWidth + spacing,
        top: y - spacing,
        bottom: y + boxHeight + spacing
      };

      return !occupiedSpaces.some(space => 
        !(proposedSpace.left > space.right ||
          proposedSpace.right < space.left ||
          proposedSpace.top > space.bottom ||
          proposedSpace.bottom < space.top)
      );
    };

    // Find next available position
    let x = startX;
    let y = startY;
    let found = false;
    let attempts = 0;
    const maxAttempts = 50;

    while (!found && attempts < maxAttempts) {
      if (isPositionValid(x, y)) {
        found = true;
      } else {
        x += gridX;
        // If we've moved too far right, go to next row
        if (x > startX + gridX * 2) {
          x = startX;
          y += gridY;
        }
      }
      attempts++;
    }

    // If no position found in grid, place below lowest box
    if (!found) {
      const lowestY = Math.max(...boxes.map(box => box.position.y + boxHeight));
      return { x: startX, y: lowestY + gridY };
    }

    return { x, y };
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

  const calculateBoxWidth = (content) => {
    // Create a temporary element to measure text width
    const tempElement = document.createElement('div');
    tempElement.style.visibility = 'hidden';
    tempElement.style.position = 'absolute';
    tempElement.style.width = 'auto';
    tempElement.style.whiteSpace = 'pre-wrap';
    tempElement.style.fontSize = '14px';
    tempElement.style.padding = '8px';
    tempElement.innerText = content;
    document.body.appendChild(tempElement);
    
    // Get the width and add some padding
    const width = Math.min(Math.max(tempElement.offsetWidth + 40, 220), 400);
    document.body.removeChild(tempElement);
    return width;
  };

  const handleGenerateClick = async () => {
    if (!selectedText) return;

    const gptResponse = await callChatGPT(selectedText);
    const newBoxId = `box-${Date.now()}`;
    const boxWidth = calculateBoxWidth(gptResponse);

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
      position,
      zIndex: maxZIndex + 1,
      width: boxWidth
    };

    setNewBoxIds(prev => new Set(prev).add(newBoxId));
    setMaxZIndex(prev => prev + 1);
    setBoxes(prevBoxes => [...prevBoxes, newBox]);

    // Remove the animation class after animation completes
    setTimeout(() => {
      setNewBoxIds(prev => {
        const next = new Set(prev);
        next.delete(newBoxId);
        return next;
      });
    }, 300); // Match this with animation duration

    if (pdfSelection) {
      const highlightId = `highlight-${Date.now()}`;
      const newConn = { 
        id: `conn-${Date.now()}`,
        from: highlightId, 
        to: newBoxId,
        pdfPosition: {
          x: pdfSelection.position.x,
          y: pdfSelection.position.y,
          width: pdfSelection.position.width,
          height: pdfSelection.position.height,
          pageNumber: pdfSelection.position.pageNumber
        }
      };

      // Add connection after box animation starts
      setTimeout(() => {
        setConnections(prevConns => [...prevConns, newConn]);
        setNewConnIds(prev => new Set(prev).add(newConn.id));
        
        // Remove animation class after connection animation
        setTimeout(() => {
          setNewConnIds(prev => {
            const next = new Set(prev);
            next.delete(newConn.id);
            return next;
          });
        }, 300); // Connection animation duration
      }, 300); // Wait for box animation to complete
    } else if (activeBox) {
      const newConn = { 
        id: `conn-${Date.now()}`,
        from: activeBox, 
        to: newBoxId 
      };

      setTimeout(() => {
        setConnections(prevConns => [...prevConns, newConn]);
        setNewConnIds(prev => new Set(prev).add(newConn.id));
        
        setTimeout(() => {
          setNewConnIds(prev => {
            const next = new Set(prev);
            next.delete(newConn.id);
            return next;
          });
        }, 300);
      }, 300);
    }

    setSelectedText("");
    setActiveBox(null);
    setPdfSelection(null);
  };

  const isDragHandle = (element) => {
    return (
      element.classList.contains("drag-handle") || // Top bar
      element.classList.contains("box-border")     // Edges
    );
  };

  const handleMouseDown = (e, boxId) => {
    if (!isDragHandle(e.target) || editingBox) return;

    setDragging(boxId);
    setMaxZIndex(prev => prev + 1);
    setBoxes(prevBoxes =>
      prevBoxes.map(box =>
        box.id === boxId
          ? { ...box, zIndex: maxZIndex + 1 }
          : box
      )
    );

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

  // Add this new function to handle textarea height
  const adjustTextareaHeight = (element) => {
    element.style.height = 'auto';
    element.style.height = `${element.scrollHeight}px`;
  };

  // Remove handleDoubleClick since we'll edit from context menu instead
  const handleEdit = (boxId) => {
    setEditingBox(boxId);
    handleGlobalClick(); // Close context menu
    // Adjust textarea height after render
    setTimeout(() => {
      const textarea = document.querySelector(`#textarea-${boxId}`);
      if (textarea) {
        adjustTextareaHeight(textarea);
      }
    }, 0);
  };

  // Modify handleEditChange to maintain height while typing
  const handleEditChange = (e, boxId) => {
    adjustTextareaHeight(e.target);
    const newWidth = calculateBoxWidth(e.target.value);
    
    setBoxes((prevBoxes) =>
      prevBoxes.map((box) =>
        box.id === boxId ? { 
          ...box, 
          content: e.target.value,
          width: newWidth
        } : box
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

  const renderLatexContent = (content) => {
    if (!content) return null;
    
    // Split content by both LaTeX delimiters: $...$ and \(...\)
    const parts = content.split(/(\$\$[\s\S]+?\$\$|\$[\s\S]+?\$|\\\([\s\S]+?\\\))/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('$$') && part.endsWith('$$')) {
        // Block math
        return <BlockMath key={index}>{part.slice(2, -2)}</BlockMath>;
      } else if (part.startsWith('$') && part.endsWith('$')) {
        // Inline math with $ delimiters
        return <InlineMath key={index}>{part.slice(1, -1)}</InlineMath>;
      } else if (part.startsWith('\\(') && part.endsWith('\\)')) {
        // Inline math with \( \) delimiters
        return <InlineMath key={index}>{part.slice(2, -2)}</InlineMath>;
      }
      // Regular text
      return <span key={index}>{part}</span>;
    });
  };

  // Add cascade deletion function
  const deleteBoxAndChildren = useCallback((boxId) => {
    const deletedBoxes = new Set();
    
    const findChildrenRecursive = (currentId) => {
      deletedBoxes.add(currentId);
      const children = connections.filter(conn => conn.from === currentId).map(conn => conn.to);
      children.forEach(childId => findChildrenRecursive(childId));
    };

    findChildrenRecursive(boxId);

    setBoxes(prevBoxes => prevBoxes.filter(box => !deletedBoxes.has(box.id)));
    setConnections(prevConns => prevConns.filter(conn => 
      !deletedBoxes.has(conn.from) && !deletedBoxes.has(conn.to)
    ));
  }, [connections]);

  // Add context menu handlers
  const handleContextMenu = (e, boxId) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      boxId: boxId
    });
  };

  const handleGlobalClick = useCallback(() => {
    setContextMenu({ visible: false, x: 0, y: 0, boxId: null });
  }, []);

  // Add useEffect for global click handler
  React.useEffect(() => {
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, [handleGlobalClick]);

  // Add this new effect to handle selection clearing
  React.useEffect(() => {
    const handleSelectionChange = () => {
      if (!pdfSelection) {  // Only handle box selections
        const selection = window.getSelection();
        const text = selection.toString().trim();
        if (!text) {
          setIsSelecting(false);
          setSelectedText("");
          setActiveBox(null);
        }
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [pdfSelection]);

  // Create ContextMenu component
  const ContextMenu = ({ x, y, onDelete, onEdit }) => (
    <div style={{
      position: 'fixed',
      top: y,
      left: x,
      background: darkMode ? '#444' : 'white',
      border: '1px solid #ccc',
      borderRadius: '4px',
      padding: '4px 0',
      zIndex: 1000,
      boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
    }}>
      <button
        onClick={onEdit}
        style={{
          display: 'block',
          width: '100%',
          padding: '8px 12px',
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          color: darkMode ? 'white' : 'black',
          ':hover': {
            background: darkMode ? '#555' : '#f0f0f0'
          }
        }}
      >
        Edit Box
      </button>
      <button
        onClick={onDelete}
        style={{
          display: 'block',
          width: '100%',
          padding: '8px 12px',
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          color: darkMode ? 'white' : 'black',
          ':hover': {
            background: darkMode ? '#555' : '#f0f0f0'
          }
        }}
      >
        Delete Box
      </button>
    </div>
  );

  // Add this function to calculate the closest anchors between two boxes
  const calculateAnchors = (fromBox, toBox) => {
    if (!fromBox || !toBox) return { start: "right", end: "left" };

    const fromRect = document.getElementById(fromBox)?.getBoundingClientRect();
    const toRect = document.getElementById(toBox)?.getBoundingClientRect();

    if (!fromRect || !toRect) return { start: "right", end: "left" };

    const fromCenter = {
      x: fromRect.left + fromRect.width / 2,
      y: fromRect.top + fromRect.height / 2
    };

    const toCenter = {
      x: toRect.left + toRect.width / 2,
      y: toRect.top + toRect.height / 2
    };

    // Calculate angles between centers
    const angle = Math.atan2(toCenter.y - fromCenter.y, toCenter.x - fromCenter.x);
    const degrees = angle * (180 / Math.PI);

    // Determine best anchors based on angle
    let startAnchor, endAnchor;

    if (degrees >= -45 && degrees < 45) {
      startAnchor = "right";
      endAnchor = "left";
    } else if (degrees >= 45 && degrees < 135) {
      startAnchor = "bottom";
      endAnchor = "top";
    } else if (degrees >= 135 || degrees < -135) {
      startAnchor = "left";
      endAnchor = "right";
    } else {
      startAnchor = "top";
      endAnchor = "bottom";
    }

    return { start: startAnchor, end: endAnchor };
  };

  return (
    <div
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUpGlobal}
      style={{
        width: "100vw",
        minWidth: "1200px", // Ensure minimum width
        height: "100vh",
        position: "relative",
        background: darkMode ? "#333" : "#f9f9f9",
        color: darkMode ? "#f9f9f9" : "#333",
        display: "flex",
        transition: "background 0.5s, color 0.5s",
        overflowY: "auto",
        overflowX: "auto",  // Changed from hidden to auto
      }}
    >
      <div style={{ 
        display: "flex",
        width: "100%",
        minWidth: "1200px", // Match parent minimum width
        minHeight: "90%",
        paddingTop: "70px",
        position: "relative"  // Added to contain absolute positioned children
      }}>
        <div style={{ 
          flex: "1 0 50%",  // Changed from 1 1 50% to prevent shrinking
          position: "relative",
          minWidth: "600px" // Minimum width for PDF viewer
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
          flex: "1 0 50%",  // Changed from width to flex
          minWidth: "600px",
          position: "relative",
          height: "100%"
        }}>
          {/* Add keyframe animation styles */}
          <style>
            {`
              @keyframes growIn {
                from {
                  transform: scale(0.3);
                  opacity: 0;
                }
                to {
                  transform: scale(1);
                  opacity: 1;
                }
              }
              .new-box {
                animation: growIn 0.3s ease-out forwards;
              }
              @keyframes fadeIn {
                from {
                  opacity: 0;
                }
                to {
                  opacity: 1;
                }
              }
              .new-connection {
                animation: fadeIn 0.3s ease-out forwards;
              }
            `}
          </style>

          {boxes.map((box) => (
            <div
              key={box.id}
              id={box.id}
              className={`box-border ${newBoxIds.has(box.id) ? 'new-box' : ''}`}
              style={{
                position: "absolute",
                left: box.position.x,
                top: box.position.y,
                border: darkMode ? "2px solid #555" : "2px solid #ccc",
                padding: "12px",
                width: box.width || 'fit-content', // Use calculated width or fit-content
                minWidth: "220px",
                backgroundColor: darkMode ? "#444" : "white",
                cursor: "grab",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                borderRadius: "12px",
                boxShadow: darkMode ? "4px 4px 10px rgba(0, 0, 0, 0.5)" : "4px 4px 10px rgba(0, 0, 0, 0.1)",
                transition: "background-color 0.5s, border 0.5s, box-shadow 0.5s",
                zIndex: box.zIndex  // Add higher z-index for boxes
              }}
              onMouseDown={(e) => handleMouseDown(e, box.id)}
              onContextMenu={(e) => handleContextMenu(e, box.id)}
            >
              <div
                className="drag-handle"
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
                  id={`textarea-${box.id}`}
                  autoFocus
                  className="text-content"
                  value={box.content}
                  onChange={(e) => handleEditChange(e, box.id)}
                  onBlur={handleEditBlur}
                  style={{
                    padding: "8px",
                    width: "100%",
                    minHeight: "60px",
                    border: "none",
                    outline: "none",
                    resize: "none",
                    fontSize: "14px",
                    borderRadius: "12px",
                    backgroundColor: darkMode ? "#555" : "white",
                    color: darkMode ? "#f9f9f9" : "#333",
                    transition: "background-color 0.5s, color 0.5s",
                    overflow: "hidden", // Prevents scrollbar flicker
                    minWidth: "200px",  // Add minWidth
                    wordBreak: "break-word",  // Add word breaking
                    whiteSpace: "pre-wrap",   // Preserve whitespace and wrap
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
                    fontSize: "14px",
                    lineHeight: "1.5",
                    wordBreak: "break-word",    // Add word breaking
                    overflowWrap: "break-word", // Ensure long words wrap
                    whiteSpace: "pre-wrap"      // Preserve whitespace and wrap
                  }}
                  onMouseUp={() => handleMouseUp(box.id)}
                >
                  {renderLatexContent(box.content)}
                </div>
              )}
            </div>
          ))}

          {connections.map((conn, idx) => {
            const anchors = calculateAnchors(conn.from, conn.to);
            return (
              <div 
                key={idx} 
                className={newConnIds.has(conn.id) ? 'new-connection' : ''}
                style={{ position: 'absolute', width: '100%', height: '100%' }}
              >
                <Xarrow 
                  start={conn.from} 
                  end={conn.to}
                  startAnchor={anchors.start}
                  endAnchor={anchors.end}
                  color="rgba(0, 123, 255, 0.4)"
                  zIndex={5}
                  strokeWidth={4}
                  path="smooth"  // Add smooth path for better appearance
                  curveness={0.3}  // Adjust curve amount
                />
              </div>
            );
          })}

          {contextMenu.visible && (
            <ContextMenu
              x={contextMenu.x}
              y={contextMenu.y}
              onEdit={() => handleEdit(contextMenu.boxId)}
              onDelete={() => {
                deleteBoxAndChildren(contextMenu.boxId);
                handleGlobalClick();
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
