import {useMemo} from 'react';

/**
 * Custom hook to parse the raw changes from the backend
 * into a format more suitable for display.
 */
export default function useChangeParser(changes) {
    const parseValue = value => {
        // Make sure null, undefined, and '~' are consistently shown
        if (value === null || value === undefined || value === '~') {
            return '-';
        }

        // For arrays, join them or show '[]'
        if (Array.isArray(value)) {
            return value.length === 0 ? '[]' : value.join(', ');
        }

        // For objects, stringify with indentation
        if (typeof value === 'object') {
            return JSON.stringify(value, null, 2);
        }

        // Otherwise, just cast to string
        return String(value);
    };

    /**
     * Prepare each change entry for display:
     * - `changeType` is a humanized version of "modified", "added", "removed".
     * - `formattedKey` can be the raw `key` from the backend or further modified
     *   if you wish to remove bracket notation, handle special naming, etc.
     */
    const parsedChanges = useMemo(() => {
        if (!Array.isArray(changes)) return [];

        return changes.map((item, index) => {
            const changeType =
                item.change.charAt(0).toUpperCase() +
                item.change.slice(1).toLowerCase();
            const formattedKey = item.key; // or transform item.key if needed

            return {
                id: `${formattedKey}-${index}-${item.change}`, // a stable key
                changeType,
                key: formattedKey,
                from: parseValue(item.from),
                to: parseValue(item.to ?? item.value)
            };
        });
    }, [changes]);

    return parsedChanges;
}
