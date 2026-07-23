import ReactModal from 'react-modal';
import { ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

const customStyles: ReactModal.Styles = {
  overlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 1000,
  },
  content: {
    top: '50%',
    left: '50%',
    right: 'auto',
    bottom: 'auto',
    transform: 'translate(-50%, -50%)',
    borderRadius: 8,
    padding: 24,
    minWidth: 1320,
    maxWidth: '90vw',
    maxHeight: '90vh',
    border: 'none',
    boxShadow: '0 10px 25px rgba(0, 0, 0, 0.2)',
  },
};

export default function Modal({ open, onClose, title, children }: ModalProps) {
  return (
    <ReactModal
      isOpen={open}
      onRequestClose={onClose}
      style={customStyles}
      shouldCloseOnOverlayClick
      shouldCloseOnEsc
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        {title && <h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2>}
        <button
          onClick={onClose}
          style={{
            border: 'none',
            background: 'none',
            fontSize: 20,
            cursor: 'pointer',
            lineHeight: 1,
          }}
          aria-label="Fechar"
        >
          ×
        </button>
      </div>

      {children}
    </ReactModal>
  );
}

