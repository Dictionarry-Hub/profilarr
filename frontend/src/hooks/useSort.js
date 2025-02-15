// hooks/useSort.js
import {useState, useMemo} from 'react';

export const useSort = ({
    data,
    options,
    defaultSort = `${options[0]?.value}-desc`
}) => {
    const [sort, setSort] = useState(defaultSort);

    const sortedData = useMemo(() => {
        const [field, direction] = sort.split('-');
        return [...data].sort((a, b) => {
            const multiplier = direction === 'asc' ? 1 : -1;
            const value = a[field];
            const compareValue = b[field];

            if (typeof value === 'string') {
                return multiplier * value.localeCompare(compareValue);
            }
            return multiplier * (value - compareValue);
        });
    }, [data, sort]);

    return {
        sortedData,
        sort,
        setSort,
        options
    };
};
