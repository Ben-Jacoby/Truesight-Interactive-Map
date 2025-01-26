import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const PDFViewer = ({ 
  onTextSelect, 
  darkMode, 
  onDarkModeToggle, 
  selectedText, 
  pdfSelection, 
  onGenerateClick, 
  connections,
  isSelecting,
  setIsSelecting,
  onSelectionClear  // Add this prop
}) => {
  const [numPages, setNumPages] = useState(null);
  const [pdfFile, setPdfFile] = useState(null);
  const [fileName, setFileName] = useState(''); // Add fileName state

  const onFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setPdfFile(URL.createObjectURL(file));
      setFileName(file.name); // Store the file name
    }
  };

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  const handleTextSelection = (pageNumber) => {
    const selection = window.getSelection();
    const text = selection.toString().trim();
    if (text.length > 1) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      const page = document.querySelector(`#page_${pageNumber}`);
      const pageRect = page?.getBoundingClientRect();
      const scrollContainer = document.querySelector('.pdf-scroll-container');
      const scrollTop = scrollContainer?.scrollTop || 0;
      
      setIsSelecting(true); // Show button while selecting
      
      if (pageRect) {
        const relativeRect = {
          x: rect.left - pageRect.left,
          y: (rect.top + scrollTop) - pageRect.top,  // Add scroll offset
          width: rect.width,
          height: rect.height,
          pageNumber: pageNumber,
          pageOffset: page.offsetTop
        };
        
        onTextSelect(text, relativeRect);
      }
    } else {
      setIsSelecting(false); // Hide button when no selection
      onSelectionClear(); // Call this when selection is cleared
    }
  };

  // Add handler for selection changes
  React.useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection();
      const text = selection.toString().trim();
      setIsSelecting(!!text);
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  React.useEffect(() => {
    const handleGlobalMouseUp = () => {
      const selection = window.getSelection();
      const text = selection.toString().trim();
      if (!text) {
        setIsSelecting(false);
        onSelectionClear(); // Call this when selection is cleared
      }
    };

    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [setIsSelecting, onSelectionClear]);

  const buttonStyle = {
    padding: "8px 12px",
    background: "#007bff",
    color: "white",
    border: "none",
    cursor: "pointer",
    borderRadius: "8px",
    fontSize: "14px",
    boxShadow: "2px 2px 6px rgba(0, 0, 0, 0.15)",
    zIndex: 2,
    transition: "background 0.3s",
    margin: "0 5px"
  };


  return (
    <div style={{ width: 'fit-content' }}>
      <div style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        padding: '20px',
        background: darkMode ? '#333' : '#f9f9f9',
        zIndex: 1000,
        width: '100%',
        borderBottom: '1px solid #ccc',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingRight: 'calc(50% + 20px)' // Ensure space for right panel
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
          <label style={{
            ...buttonStyle,
            display: 'inline-block',
            cursor: 'pointer'
          }}>
            Choose File
            <input
              type="file"
              accept=".pdf"
              onChange={onFileChange}
              style={{ display: 'none' }}
            />
          </label>
          {fileName && (
            <span style={{ 
              marginLeft: '10px',
              color: darkMode ? '#fff' : '#333',
              fontSize: '14px'
            }}>
              {fileName}
            </span>
          )}
          {((isSelecting && selectedText) || pdfSelection) && (
            <button
              onClick={onGenerateClick}
              style={buttonStyle}
            >
              Generate Explanation
            </button>
          )}
        </div>
        <div style={{ marginRight: '40px' }}> {/* Increased margin */}
          <button
            onClick={onDarkModeToggle}
            style={{
              ...buttonStyle,
              background: darkMode ? "#555" : "#007bff",
              transition: "background 0.5s"
            }}
          >
            {darkMode ? "Light Mode ☀️" : "Dark Mode 🌙"}
          </button>
        </div>
      </div>
      
      {pdfFile && (
        <div 
          className="pdf-scroll-container"
          style={{ 
            display: 'inline-block',
            marginTop: '10px',
            padding: '20px',
            width: 'fit-content',
            position: 'relative',
          }}
        >
          <Document
            file={pdfFile}
            onLoadSuccess={onDocumentLoadSuccess}
            className="pdf-document"
          >
            {Array.from(new Array(numPages), (el, index) => (
              <div 
                key={`page_${index + 1}`}
                id={`page_${index + 1}`} 
                style={{ 
                  position: 'relative', 
                  marginBottom: '20px',
                  boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)',
                  backgroundColor: 'white',
                  borderRadius: '2px'
                }}
              >
                <Page 
                  pageNumber={index + 1}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  onMouseUp={() => handleTextSelection(index + 1)}
                  className="pdf-page"
                  scale={1}
                />
                {connections.map((conn, idx) => {
                  if (conn.pdfPosition && conn.pdfPosition.pageNumber === index + 1) {
                    const highlightStyle = {
                      position: 'absolute',
                      left: `${conn.pdfPosition.x}px`,
                      top: `${conn.pdfPosition.y}px`,
                      width: `${conn.pdfPosition.width}px`,
                      height: `${conn.pdfPosition.height}px`,
                      backgroundColor: 'rgba(255, 255, 0, 0.3)',
                      pointerEvents: 'none',
                      zIndex: 3
                    };
                    return (
                      <div key={idx} id={conn.from} style={highlightStyle} />
                    );
                  }
                  return null;
                })}
              </div>
            ))}
          </Document>
          <style>{`
            .pdf-document {
              position: relative;
              display: inline-block;
            }

            .pdf-page {
              position: relative;
              display: inline-block;
            }
            
            .react-pdf__Page__textContent {
              position: absolute !important;
              left: 0;
              top: 0;
              right: 0;
              bottom: 0;
              z-index: 1;
              line-height: 1;
              pointer-events: all;
            }

            .react-pdf__Page__textContent > span {
              color: transparent;
              position: absolute;
              white-space: pre;
              cursor: text;
              transform-origin: 0% 0%;
            }

            ::selection {
              background: rgba(33, 150, 243, 0.2); /* Lowered opacity from 1 to 0.2 */
              opacity: 1;
            }

            .react-pdf__Page__textContent > span::selection {
              background: rgba(33, 150, 243, 0.2); /* Lowered opacity from 1 to 0.2 */
              color: transparent;
            }

            .react-pdf__Page__canvas {
              position: relative;
              z-index: 0;
              display: block;
              user-select: none;
            }
          `}</style>
        </div>
      )}
    </div>
  );
};

export default PDFViewer;
