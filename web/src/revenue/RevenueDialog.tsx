import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { RevenueIcon } from "./RevenueIcon";
export function RevenueDialog({
  title,
  description,
  close,
  children,
}: {
  title: string;
  description?: string;
  close: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    const before = document.activeElement as HTMLElement | null;
    el?.showModal();
    return () => {
      el?.close();
      before?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="rev-dialog"
      onCancel={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
      aria-labelledby="rev-dialog-title"
    >
      <div className="rev-dialog-inner">
        <header>
          <div>
            <h2 id="rev-dialog-title">{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button className="rev-icon-button" onClick={close} aria-label="닫기">
            <RevenueIcon name="close" />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
export function DataForm({
  submit,
  children,
  label = "저장",
  cancel,
}: {
  submit: (f: FormData) => void | Promise<void>;
  children: ReactNode;
  label?: string;
  cancel: () => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError("");
    setBusy(true);
    try {
      await submit(form);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장 실패");
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={(e) => void onSubmit(e)} className="rev-form">
      {children}
      {error && (
        <p className="rev-error" role="alert">
          {error}
        </p>
      )}
      <footer>
        <button type="button" className="rev-button" onClick={cancel}>
          취소
        </button>
        <button
          type="submit"
          className="rev-button rev-button-primary"
          disabled={busy}
        >
          {busy ? "저장 중…" : label}
        </button>
      </footer>
    </form>
  );
}
