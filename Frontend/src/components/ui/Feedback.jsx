/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";

export function Spinner({ size = 18 }) {
  return <span className="spinner" style={{ width: size, height: size }} role="status" aria-label="Loading" />;
}

export function FullPageSpinner() {
  return (
    <div className="fullpage-center">
      <Spinner size={28} />
    </div>
  );
}

/* ---------- Toasts + confirm dialog, available anywhere via hooks ---------- */

const FeedbackContext = createContext(null);
const TOAST_ICONS = { success: CheckCircle2, error: XCircle, info: Info };

export function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const push = useCallback((type, message) => {
    const id = nextId.current++;
    setToasts((list) => [...list.slice(-3), { id, type, message }]);
    setTimeout(() => dismiss(id), type === "error" ? 6000 : 3500);
  }, [dismiss]);

  const toast = useMemo(() => ({
    success: (m) => push("success", m),
    error: (m) => push("error", m),
    info: (m) => push("info", m),
  }), [push]);

  const confirm = useCallback(
    (options) => new Promise((resolve) => setDialog({ ...options, resolve })),
    []
  );

  const close = (answer) => {
    dialog?.resolve(answer);
    setDialog(null);
  };

  useEffect(() => {
    if (!dialog) return undefined;
    const onKey = (e) => { if (e.key === "Escape") { dialog.resolve(false); setDialog(null); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [dialog]);

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      <div className="toast-stack" aria-live="polite">
        {toasts.map((t) => {
          const Icon = TOAST_ICONS[t.type];
          return (
            <div key={t.id} className={`toast toast--${t.type}`}>
              <Icon size={18} className="toast__icon" />
              <span className="toast__text">{t.message}</span>
              <button className="toast__close" onClick={() => dismiss(t.id)} aria-label="Dismiss">
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {dialog && (
        <div className="modal-backdrop" onMouseDown={() => close(false)}>
          <div className="modal modal--sm" role="alertdialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
            <div className={`modal__icon ${dialog.danger ? "modal__icon--danger" : ""}`}>
              <AlertTriangle size={20} />
            </div>
            <h3 className="modal__title">{dialog.title}</h3>
            {dialog.message && <p className="modal__text">{dialog.message}</p>}
            <div className="modal__actions">
              <button className="btn btn--secondary" onClick={() => close(false)}>Cancel</button>
              <button className={`btn ${dialog.danger ? "btn--danger" : "btn--primary"}`} onClick={() => close(true)} autoFocus>
                {dialog.confirmLabel || "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  );
}

export const useToast = () => useContext(FeedbackContext).toast;
export const useConfirm = () => useContext(FeedbackContext).confirm;
