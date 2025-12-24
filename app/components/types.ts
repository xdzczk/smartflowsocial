/**
 * Component Types
 * Shared TypeScript interfaces for generic UI components
 */

/**
 * Props for MediaPlayer component
 */
export interface MediaPlayerProps {
    src: string;
    className?: string;
    autoPlay?: boolean;
    muted?: boolean;
    loop?: boolean;
    controls?: boolean;
    poster?: string;
}

/**
 * Props for NavigationItem component
 */
export interface NavigationItemProps {
    href: string;
    label: string;
    icon: React.ReactNode;
    isActive?: boolean;
    onClick?: () => void;
}

/**
 * Toast message type for notifications
 */
export interface ToastMessage {
    type: "success" | "error";
    message: string;
    link?: string;
    linkText?: string;
}
