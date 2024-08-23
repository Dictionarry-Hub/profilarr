import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";

function Modal({
  isOpen,
  onClose,
  title,
  children,
  level = 0,
  disableCloseOnOutsideClick = false,
  disableCloseOnEscape = false,
  size = "lg",
}) {
  const modalRef = useRef();
  const [isAnimating, setIsAnimating] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsClosing(false);
      setShouldRender(true);
      setTimeout(() => setIsAnimating(true), 10);
    } else {
      setIsClosing(true);
      setIsAnimating(false);
      const timer = setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && !disableCloseOnEscape) {
      const handleEscape = (event) => {
        if (event.key === "Escape") {
          onClose();
        }
      };
      document.addEventListener("keydown", handleEscape);
      return () => {
        document.removeEventListener("keydown", handleEscape);
      };
    }
  }, [isOpen, onClose, disableCloseOnEscape]);

  if (!shouldRender && !isClosing) return null;

  const handleClickOutside = (e) => {
    if (
      modalRef.current &&
      !modalRef.current.contains(e.target) &&
      !disableCloseOnOutsideClick
    ) {
      onClose();
    }
  };

  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "3xl": "max-w-3xl",
    "4xl": "max-w-4xl",
    "5xl": "max-w-5xl",
    "6xl": "max-w-6xl",
    "7xl": "max-w-7xl",
  };

  return (
    <div
      className={`fixed inset-0 overflow-y-auto h-full w-full flex items-center justify-center transition-opacity duration-300 ease-in-out ${
        isAnimating ? "opacity-100" : "opacity-0"
      }`}
      style={{ zIndex: 1000 + level * 10 }}
      onClickCapture={handleClickOutside}
    >
      <div
        className="fixed inset-0 bg-black bg-opacity-50"
        style={{ zIndex: 1000 + level * 10 }}
      ></div>
      <div
        ref={modalRef}
        className={`relative bg-white dark:bg-gray-800 p-8 rounded-lg shadow-xl w-full ${
          sizeClasses[size]
        } transform transition-all duration-300 ease-in-out ${
          isAnimating ? "translate-y-0 opacity-100" : "translate-y-10 opacity-0"
        }`}
        style={{
          zIndex: 1001 + level * 10,
          minHeight: "300px",
          maxHeight: "90vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-bold dark:text-gray-200">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              ></path>
            </svg>
          </button>
        </div>
        <div className="pt-2">{children}</div>
      </div>
    </div>
  );
}

Modal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  title: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
  level: PropTypes.number,
  disableCloseOnOutsideClick: PropTypes.bool,
  disableCloseOnEscape: PropTypes.bool,
  size: PropTypes.oneOf([
    "sm",
    "md",
    "lg",
    "xl",
    "2xl",
    "3xl",
    "4xl",
    "5xl",
    "6xl",
    "7xl",
  ]),
};

export default Modal;
