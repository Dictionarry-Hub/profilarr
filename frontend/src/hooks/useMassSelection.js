import {useState, useCallback} from 'react';

export const useMassSelection = () => {
    const [selectedItems, setSelectedItems] = useState(new Set());
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [lastSelectedIndex, setLastSelectedIndex] = useState(null);

    const toggleSelectionMode = useCallback(() => {
        setIsSelectionMode(prev => !prev);
        if (isSelectionMode) {
            // Clear selection when exiting selection mode
            setSelectedItems(new Set());
            setLastSelectedIndex(null);
        }
    }, [isSelectionMode]);

    const handleSelect = useCallback(
        (id, index, event, items) => {
            // Add items parameter to access the data array
            if (!isSelectionMode) return;

            setSelectedItems(prev => {
                const newSelection = new Set(prev);

                if (event.shiftKey && lastSelectedIndex !== null) {
                    // Handle shift+click for range selection
                    const start = Math.min(lastSelectedIndex, index);
                    const end = Math.max(lastSelectedIndex, index);

                    // Get all items in range using their unique identifiers
                    for (let i = start; i <= end; i++) {
                        const item = items[i];
                        if (item) {
                            // For formats: item.content.name
                            // For profiles: item.file_name
                            const identifier =
                                item.content?.name ||
                                item.file_name.replace('.yml', '');
                            newSelection.add(identifier);
                        }
                    }
                } else {
                    // Toggle single selection using identifier
                    if (newSelection.has(id)) {
                        newSelection.delete(id);
                    } else {
                        newSelection.add(id);
                    }
                    setLastSelectedIndex(index);
                }

                return newSelection;
            });
        },
        [isSelectionMode, lastSelectedIndex]
    );

    const clearSelection = useCallback(() => {
        setSelectedItems(new Set());
        setLastSelectedIndex(null);
    }, []);

    return {
        selectedItems,
        isSelectionMode,
        toggleSelectionMode,
        handleSelect,
        clearSelection
    };
};
