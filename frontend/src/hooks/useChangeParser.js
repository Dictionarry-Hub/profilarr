import {useMemo} from 'react';

function toTitleCase(str) {
    return str
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/([A-Z])([a-z])/g, ' $1$2')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^./, char => char.toUpperCase());
}

function formatSegment(segment) {
    // Replace underscores with spaces
    let newSegment = segment.replace(/_/g, ' ');

    // Handle the bracket content first
    newSegment = newSegment.replace(/\[(.*?)\]/g, (match, group) => {
        return `[${toTitleCase(group.trim())}]`;
    });

    // Transform to title case
    newSegment = toTitleCase(newSegment);

    // Final cleanup: ensure proper bracket spacing
    newSegment = newSegment
        // First remove any spaces after [
        .replace(/\[\s+/g, '[')
        // Then ensure one space before [
        .replace(/([^\s])\[/g, '$1 [');

    return newSegment;
}

function formatKey(rawKey) {
    const segments = rawKey.split('.');
    const formattedSegments = segments.map(segment => formatSegment(segment));
    return formattedSegments.join(': ');
}

export default function useChangeParser(changes) {
    const parseValue = value => {
        if (value === null || value === undefined || value === '~') {
            return '-';
        }
        if (Array.isArray(value)) {
            return value.length === 0 ? '[]' : value.join(', ');
        }
        if (typeof value === 'object') {
            return JSON.stringify(value, null, 2);
        }
        return String(value);
    };

    const parsedChanges = useMemo(() => {
        if (!Array.isArray(changes)) return [];

        return changes.map((item, index) => {
            const changeType =
                item.change.charAt(0).toUpperCase() +
                item.change.slice(1).toLowerCase();

            return {
                id: `${item.key}-${index}-${item.change}`,
                changeType,
                key: formatKey(item.key),
                from: parseValue(item.from),
                to: parseValue(item.to ?? item.value)
            };
        });
    }, [changes]);

    return parsedChanges;
}
