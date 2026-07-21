import { ReactNode, useState, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import { MobileSheet } from './MobileSheet';

export interface NavStackFrame {
  title: string;
  subtitle?: string;
  content: ReactNode;
  footer?: ReactNode;
}

/**
 * Manages the push/pop state for a list -> detail (-> detail...) drill-down,
 * replacing side-by-side desktop split panes with a mobile navigation stack.
 * Supports arbitrary depth (e.g. trip -> invoices -> line items).
 */
export function useNavStack() {
  const [stack, setStack] = useState<NavStackFrame[]>([]);

  const push = useCallback((frame: NavStackFrame) => {
    setStack((s) => [...s, frame]);
  }, []);

  const pop = useCallback(() => {
    setStack((s) => s.slice(0, -1));
  }, []);

  const reset = useCallback(() => {
    setStack([]);
  }, []);

  return { stack, push, pop, reset, depth: stack.length };
}

interface MobileNavStackProps {
  isOpen: boolean;
  onClose: () => void;
  root: NavStackFrame;
  stack: NavStackFrame[];
  onPop: () => void;
}

export function MobileNavStack({ isOpen, onClose, root, stack, onPop }: MobileNavStackProps) {
  const current = stack.length > 0 ? stack[stack.length - 1] : root;

  return (
    <MobileSheet
      isOpen={isOpen}
      onClose={onClose}
      title={current.title}
      subtitle={current.subtitle}
      footer={current.footer}
      headerLeft={
        stack.length > 0 ? (
          <button
            type="button"
            onClick={onPop}
            title="Back"
            className="p-2 -ml-2 hover:bg-zinc-100 rounded-xl text-zinc-500 transition-all shrink-0 mobile-tap-target"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        ) : undefined
      }
    >
      {current.content}
    </MobileSheet>
  );
}
