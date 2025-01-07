import {useEffect} from 'react';

export const useKeyboardShortcut = (key, callback, modifiers = {}) => {
    useEffect(() => {
        const handleKeyDown = event => {
            // Check if any required modifier keys match
            const shiftMatches = modifiers.shift ? event.shiftKey : true;
            const ctrlMatches = modifiers.ctrl ? event.ctrlKey : true;
            const altMatches = modifiers.alt ? event.altKey : true;
            const metaMatches = modifiers.meta ? event.metaKey : true;

            // Check if the pressed key matches (case-insensitive)
            const keyMatches = event.key.toLowerCase() === key.toLowerCase();

            // If all conditions match, execute the callback
            if (
                keyMatches &&
                shiftMatches &&
                ctrlMatches &&
                altMatches &&
                metaMatches
            ) {
                event.preventDefault();
                callback();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [
        key,
        callback,
        modifiers.shift,
        modifiers.ctrl,
        modifiers.alt,
        modifiers.meta
    ]);
};
