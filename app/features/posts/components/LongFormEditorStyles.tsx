export function LongFormEditorStyles() {
    return (
        <style
            dangerouslySetInnerHTML={{
                __html: `
        #editorjs {
          font-family: inherit;
        }
        
        .ce-block {
          padding: 0.5rem 0;
        }
        
        .ce-block__content {
          max-width: none !important;
        }
        
        .ce-toolbar__actions {
          right: -30px;
        }
        
        .ce-toolbar__plus {
          background: #374151 !important;
          color: white !important;
        }
        
        .ce-toolbar__plus:hover {
          background: #1f2937 !important;
        }
        
        .cdx-block {
          padding: 0.25rem 0;
        }
        
        .ce-block--selected {
          background: rgba(59, 130, 246, 0.1) !important;
          border-radius: 0.375rem;
        }
        
        .image-tool {
          margin: 1rem 0;
        }
        
        .image-tool__image {
          max-width: 100%;
          height: auto;
          border-radius: 0.5rem;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
        }
        
        /* Completely remove image captions */
        .image-tool__caption,
        .image-tool__caption[contenteditable="true"],
        .image-tool__caption[contenteditable="false"],
        .ce-block[data-tool="image"] .image-tool__caption,
        .image-tool .cdx-input,
        .image-tool__caption-input,
        .image-tool__tune {
          display: none !important;
          visibility: hidden !important;
          height: 0 !important;
          padding: 0 !important;
          margin: 0 !important;
          border: none !important;
        }
        
        /* Ensure image tool content area doesn't have space for caption */
        .image-tool {
          margin: 1rem 0;
        }
        
        .image-tool__image-container {
          margin-bottom: 0 !important;
        }
        
        /* Remove any input focus styles that might appear */
        .image-tool input,
        .image-tool textarea {
          display: none !important;
        }
        
        .ce-block:hover .ce-toolbar__actions {
          opacity: 1;
        }
        
        .ce-toolbar__settings-btn {
          background: #374151 !important;
          color: white !important;
        }
        
        .ce-toolbar__settings-btn:hover {
          background: #1f2937 !important;
        }
        
        /* Custom Drag and Drop Styles */
        .ce-block[draggable="true"] {
          cursor: move !important;
          transition: all 0.2s ease;
          position: relative;
        }
        
        .ce-block[draggable="true"]:hover {
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        
        .ce-block.dragging {
          opacity: 0.6 !important;
          transform: scale(0.95) rotate(2deg);
          z-index: 1000;
        }
        
        .ce-block.drag-over {
          border: 2px dashed #3B82F6 !important;
          background: rgba(59, 130, 246, 0.05) !important;
          border-radius: 0.375rem;
        }
        
        .ce-block--selected {
          background: rgba(59, 130, 246, 0.1) !important;
          border-radius: 0.375rem;
          border: 1px solid #3B82F6;
        }
        
        /* Add a subtle drag indicator */
        .ce-block[draggable="true"]:before {
          content: '⋮⋮';
          position: absolute;
          left: -20px;
          top: 50%;
          transform: translateY(-50%);
          color: #9CA3AF;
          opacity: 0;
          transition: opacity 0.2s;
          font-size: 14px;
          line-height: 1;
        }
        
        .ce-block[draggable="true"]:hover:before {
          opacity: 1;
        }
      `,
            }}
        />
    );
}
