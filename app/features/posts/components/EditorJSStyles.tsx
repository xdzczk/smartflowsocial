/**
 * EditorJS custom styles for longform editor
 */
export function EditorJSStyles() {
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `
        #longform-editorjs {
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
        
        /* Remove image captions */
        .image-tool__caption,
        .image-tool__caption[contenteditable="true"],
        .image-tool__caption[contenteditable="false"],
        .image-tool .cdx-input {
          display: none !important;
          visibility: hidden !important;
        }
      `,
      }}
    />
  );
}





