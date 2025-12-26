/**
 * EditorJS Type Definitions
 * Proper TypeScript types for EditorJS integration
 */

/**
 * EditorJS block data structure
 */
export interface EditorJSBlock {
    id?: string;
    type: string;
    data: Record<string, unknown>;
}

/**
 * EditorJS output data structure
 */
export interface EditorJSOutput {
    blocks: EditorJSBlock[];
    time?: number;
    version?: string;
}

/**
 * EditorJS API interface
 */
export interface EditorJSAPI {
    saver: {
        save: () => Promise<EditorJSOutput>;
    };
    blocks: {
        getCurrentBlockIndex: () => number;
        insert: (type: string, data: Record<string, unknown>) => void;
    };
    focus: () => void;
    isReady: Promise<void>;
    render: (data: EditorJSOutput) => Promise<void>;
    destroy: () => void;
    _captionObserver?: MutationObserver;
    _dragObserver?: MutationObserver;
}

/**
 * EditorJS instance type
 */
export interface EditorJSInstance extends EditorJSAPI {
    _captionObserver?: MutationObserver;
    _dragObserver?: MutationObserver;
}

declare global {
    interface Window {
        EditorJSInstances?: EditorJSInstance[];
    }
}



