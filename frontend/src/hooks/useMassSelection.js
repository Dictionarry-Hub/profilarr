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
        (id, index, e) => {
            if (!isSelectionMode) return;

            setSelectedItems(prev => {
                const newSelection = new Set(prev);

                if (e.shiftKey && lastSelectedIndex !== null) {
                    // Handle shift+click for range selection
                    const start = Math.min(lastSelectedIndex, index);
                    const end = Math.max(lastSelectedIndex, index);

                    // Toggle the range based on whether the last clicked item is selected
                    const shouldSelect = !prev.has(index);

                    for (let i = start; i <= end; i++) {
                        if (shouldSelect) {
                            newSelection.add(i);
                        } else {
                            newSelection.delete(i);
                        }
                    }
                } else {
                    // Toggle single selection
                    if (newSelection.has(index)) {
                        newSelection.delete(index);
                    } else {
                        newSelection.add(index);
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
        lastSelectedIndex,
        toggleSelectionMode,
        handleSelect,
        clearSelection
    };
};
