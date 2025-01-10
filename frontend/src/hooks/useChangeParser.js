import {useMemo} from 'react';

/**
 * Make the first character uppercase and
 * insert spaces before capital letters: "preferFreeleech" -> "Prefer Freeleech"
 */
function toTitleCase(str) {
    return (
        str
            // Insert space before any capital letters (i.e., from "preferFreeleech" -> "prefer Freeleech")
            .replace(/([A-Z])/g, ' $1')
            // Trim out extra spaces in case we introduced any, then uppercase first letter
            .trim()
            .replace(/^./, char => char.toUpperCase())
    );
}

/**
 * Transform a single segment of the key, e.g.:
 * "tweaks" => "Tweaks"
 * "custom_formats[test]" => "Custom Formats [Test]"
 */
function formatSegment(segment) {
    // Replace underscores with spaces
    let newSegment = segment.replace(/_/g, ' ');

    // If there's bracket notation: e.g. [test], transform "test" -> "Test"
    newSegment = newSegment.replace(/\[(.*?)\]/g, (match, group) => {
        return `[${toTitleCase(group)}]`;
    });

    // Finally, transform the segment itself into title case
    // e.g. "custom formats" => "Custom Formats"
    newSegment = toTitleCase(newSegment);

    return newSegment;
}

/**
 * Example:
 * "tweaks.preferFreeleech" => ["tweaks", "preferFreeleech"] => "Tweaks: Prefer Freeleech"
 * "custom_formats[test].score" => ["custom_formats[test]", "score"] => "Custom Formats [Test]: Score"
 */
function formatKey(rawKey) {
    // If there's no dot, it’s just one segment
    const segments = rawKey.split('.');
    const formattedSegments = segments.map(segment => formatSegment(segment));
    return formattedSegments.join(': ');
}

/**
 * Hook to parse the raw changes from the backend into a more display-friendly format.
 */
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
                key: formatKey(item.key), // <--- Use our new formatter here
                from: parseValue(item.from),
                to: parseValue(item.to ?? item.value)
            };
        });
    }, [changes]);

    return parsedChanges;
}
