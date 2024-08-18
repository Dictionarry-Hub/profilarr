import React from 'react';

const Tooltip = ({ content, children }) => {
  return (
    <div className="relative flex items-center group">
      {children}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        <div className="bg-gray-900 text-white text-xs rounded py-1 px-2 shadow-lg whitespace-nowrap z-50">
          {content}
        </div>
        <div className="absolute w-2.5 h-2.5 bg-gray-900 transform rotate-45 -bottom-1 left-1/2 -translate-x-1/2"></div>
      </div>
    </div>
  );
};

export default Tooltip;