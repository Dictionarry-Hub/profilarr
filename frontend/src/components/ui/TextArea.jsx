import React from 'react';
const Textarea = React.forwardRef(({className, ...props}, ref) => {
    return (
        <textarea
            className={`flex min-h-[300px] w-full border-none bg-white 
        dark:bg-gray-700 px-4 py-3 text-sm text-gray-900 dark:text-gray-100 
        placeholder-gray-500 dark:placeholder-gray-400 
        focus:outline-none focus:ring-2 focus:ring-blue-500 
        focus:border-transparent disabled:cursor-not-allowed 
        disabled:opacity-50 rounded-none ${className}`}
            ref={ref}
            {...props}
        />
    );
});
Textarea.displayName = 'Textarea';

export default Textarea;
