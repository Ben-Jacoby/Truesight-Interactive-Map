import React, { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

const PDFViewer = ({ onTextSelect }) => {
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pdfFile, setPdfFile] = useState(null);

  const onFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setPdfFile(URL.createObjectURL(file));
    }
  };

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages);
  };

  const handleTextSelection = () => {
    const selection = window.getSelection();
    const text = selection.toString().trim();
    if (text) {
      const range = selection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      onTextSelect(text, rect);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <input
        type="file"
        accept=".pdf"
        onChange={onFileChange}
        style={{ marginBottom: '20px' }}
      />
      
      {pdfFile && (
        <div>
          <Document
            file={pdfFile}
            onLoadSuccess={onDocumentLoadSuccess}
            onMouseUp={handleTextSelection}
          >
            <Page 
              pageNumber={pageNumber}
              renderTextLayer={true}
              renderAnnotationLayer={true}
            />
          </Document>
          <div style={{ marginTop: '10px' }}>
            <button 
              disabled={pageNumber <= 1} 
              onClick={() => setPageNumber(pageNumber - 1)}
            >
              Previous
            </button>
            <span style={{ margin: '0 10px' }}>
              Page {pageNumber} of {numPages}
            </span>
            <button 
              disabled={pageNumber >= numPages} 
              onClick={() => setPageNumber(pageNumber + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PDFViewer;
