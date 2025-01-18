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
    let newSegment = segment.replace(/_/g, ' ');
    newSegment = newSegment.replace(/\[(.*?)\]/g, (match, group) => {
        return `[${toTitleCase(group.trim())}]`;
    });
    newSegment = toTitleCase(newSegment);
    newSegment = newSegment
        .replace(/\[\s+/g, '[')
        .replace(/([^\s])\[/g, '$1 [');
    return newSegment;
}

function formatKey(rawKey) {
    // Add type checking
    if (typeof rawKey !== 'string') {
        console.warn('Expected string for key, received:', rawKey);
        return String(rawKey || ''); // Convert to string or use empty string as fallback
    }

    const segments = rawKey.split('.');
    const formattedSegments = segments.map(segment => formatSegment(segment));
    return formattedSegments.join(': ');
}

function parseValue(value) {
    if (value === null || value === undefined || value === '~') {
        return '-';
    }

    if (Array.isArray(value)) {
        if (value.length === 0) return '[]';

        // Special handling for conditions array
        if (value[0]?.name && value[0]?.pattern) {
            const formattedConditions = value.map(condition => {
                const parts = [];
                // Add name
                parts.push(condition.name);

                // Add important attributes
                const attributes = [];
                if (condition.required) attributes.push('Required');
                if (condition.negate) attributes.push('Negated');

                // Add pattern if different from name
                if (condition.pattern && condition.pattern !== condition.name) {
                    attributes.push(`Pattern: ${condition.pattern}`);
                }

                // Add any additional properties worth showing
                if (condition.type) attributes.push(`Type: ${condition.type}`);

                // Combine all parts
                if (attributes.length > 0) {
                    parts.push(`(${attributes.join(', ')})`);
                }

                return parts.join(' ');
            });

            return formattedConditions.join('\n');
        }

        // Handle other arrays of objects
        return value
            .map(item => {
                if (typeof item === 'object' && item !== null) {
                    return Object.entries(item)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(', ');
                }
                return String(item);
            })
            .join(', ');
    }

    if (typeof value === 'object' && value !== null) {
        return Object.entries(value)
            .map(([k, v]) => `${k}: ${parseValue(v)}`)
            .join(', ');
    }

    return String(value);
}

export default function useChangeParser(changes) {
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
