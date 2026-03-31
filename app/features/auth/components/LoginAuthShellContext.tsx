import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface LoginAuthShellContextValue {
  /** Replaces default right-column brand content when non-null */
  rightPanel: ReactNode | null;
  setRightPanel: (node: ReactNode | null) => void;
  /** When true, login shell uses awaiting-specific layout (e.g. column order on mobile) */
  isAwaitingApproval: boolean;
  setAwaitingApproval: (active: boolean) => void;
}

const LoginAuthShellContext = createContext<LoginAuthShellContextValue | null>(
  null
);

export function LoginAuthShellProvider({ children }: { children: ReactNode }) {
  const [rightPanel, setRightPanelState] = useState<ReactNode | null>(null);
  const [isAwaitingApproval, setAwaitingApprovalState] = useState(false);

  const setRightPanel = useCallback((node: ReactNode | null) => {
    setRightPanelState(node);
  }, []);

  const setAwaitingApproval = useCallback((active: boolean) => {
    setAwaitingApprovalState(active);
  }, []);

  const value = useMemo(
    (): LoginAuthShellContextValue => ({
      rightPanel,
      setRightPanel,
      isAwaitingApproval,
      setAwaitingApproval,
    }),
    [rightPanel, setRightPanel, isAwaitingApproval, setAwaitingApproval]
  );

  return (
    <LoginAuthShellContext.Provider value={value}>
      {children}
    </LoginAuthShellContext.Provider>
  );
}

export function useLoginAuthShell(): LoginAuthShellContextValue {
  const ctx = useContext(LoginAuthShellContext);
  if (!ctx) {
    throw new Error(
      "useLoginAuthShell must be used within LoginAuthShellProvider"
    );
  }
  return ctx;
}
