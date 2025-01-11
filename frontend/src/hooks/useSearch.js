import {useState, useCallback, useMemo} from 'react';

const useSearch = (
    items = [],
    {
        searchableFields = ['name', 'tags'],
        initialSortBy = 'name',
        initialFilterType = 'none',
        initialFilterValue = '',
        sortOptions = {
            name: (a, b) => a.name.localeCompare(b.name),
            dateModified: (a, b) =>
                new Date(b.modified_date) - new Date(a.modified_date)
        }
    } = {}
) => {
    // Search state
    const [searchTerms, setSearchTerms] = useState([]);
    const [currentInput, setCurrentInput] = useState('');

    // Filter state
    const [filterType, setFilterType] = useState(initialFilterType);
    const [filterValue, setFilterValue] = useState(initialFilterValue);

    // Sort state
    const [sortBy, setSortBy] = useState(initialSortBy);

    // Search term management
    const addSearchTerm = useCallback(
        term => {
            const trimmedTerm = term.trim();
            if (trimmedTerm && !searchTerms.includes(trimmedTerm)) {
                setSearchTerms(prev => [...prev, trimmedTerm]);
                setCurrentInput('');
                return true;
            }
            return false;
        },
        [searchTerms]
    );

    const removeSearchTerm = useCallback(termToRemove => {
        setSearchTerms(prev => prev.filter(term => term !== termToRemove));
    }, []);

    const clearSearchTerms = useCallback(() => {
        setSearchTerms([]);
        setCurrentInput('');
    }, []);

    // Helper function to check if a value matches a search term
    const matchesSearchTerm = useCallback((value, searchTerm) => {
        if (!value) return false;
        if (Array.isArray(value)) {
            return value.some(v =>
                String(v).toLowerCase().includes(searchTerm.toLowerCase())
            );
        }
        return String(value).toLowerCase().includes(searchTerm.toLowerCase());
    }, []);

    // Helper function to get nested object values
    const getNestedValue = useCallback((obj, path) => {
        return path.split('.').reduce((current, part) => current?.[part], obj);
    }, []);

    // Process items through search, filter, and sort
    const processedItems = useMemo(() => {
        let result = [...items];

        // Apply search terms (if any)
        if (searchTerms.length > 0) {
            result = result.filter(item =>
                searchTerms.every(term =>
                    searchableFields.some(field => {
                        const value = getNestedValue(item, field);
                        return matchesSearchTerm(value, term);
                    })
                )
            );
        }

        // Apply filters (if any)
        if (filterType === 'tag' && filterValue) {
            result = result.filter(item => item.tags?.includes(filterValue));
        }

        // Apply sorting
        const sortFn = sortOptions[sortBy];
        if (sortFn) {
            result.sort(sortFn);
        }

        return result;
    }, [
        items,
        searchTerms,
        filterType,
        filterValue,
        sortBy,
        searchableFields,
        sortOptions,
        getNestedValue,
        matchesSearchTerm
    ]);

    // Clear all filters
    const clearAllFilters = useCallback(() => {
        clearSearchTerms();
        setFilterType('none');
        setFilterValue('');
        setSortBy(initialSortBy);
    }, [clearSearchTerms, initialSortBy]);

    return {
        // Search-related
        searchTerms,
        currentInput,
        setCurrentInput,
        addSearchTerm,
        removeSearchTerm,
        clearSearchTerms,

        // Filter-related
        filterType,
        setFilterType,
        filterValue,
        setFilterValue,

        // Sort-related
        sortBy,
        setSortBy,

        // Results
        items: processedItems,

        // Utilities
        clearAllFilters,
        hasFilters:
            searchTerms.length > 0 ||
            filterType !== 'none' ||
            filterValue !== ''
    };
};

export default useSearch;
