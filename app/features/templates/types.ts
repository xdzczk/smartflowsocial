/**
 * Template Types
 * Shared TypeScript interfaces for template features
 */

/**
 * Props for TemplateModal component
 */
export interface TemplateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (templateContent: string) => void;
    templates: Array<{
        id: string;
        name: string;
        content: string;
    }>;
}
