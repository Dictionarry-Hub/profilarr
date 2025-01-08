import React, {useState, useEffect} from 'react';
import SearchBar from './SearchBar';
import FilterMenu from './FilterMenu';
import {SortDropdown} from './SortDropdown';
import ToggleSelectButton from './ToggleSelectButton';
import AddButton from './AddButton';

const DataBar = ({
    onSearch,
    searchPlaceholder = 'Search by name or tag...',
    filterType,
    setFilterType,
    filterValue,
    setFilterValue,
    allTags,
    sortBy,
    setSortBy,
    isSelectionMode,
    toggleSelectionMode,
    onAdd,
    addButtonLabel = 'Add New',
    showAddButton = true
}) => {
    const [isFloating, setIsFloating] = useState(false);
    const [isVisible, setIsVisible] = useState(true);
    const [lastScrollY, setLastScrollY] = useState(0);

    useEffect(() => {
        const handleScroll = () => {
            const currentScrollY = window.scrollY;

            // Show/hide based on scroll direction
            setIsVisible(currentScrollY <= 0 || currentScrollY < lastScrollY);

            // Start floating once we scroll past the initial position
            setIsFloating(currentScrollY > 64); // Approximately the height of the bar

            setLastScrollY(currentScrollY);
        };

        window.addEventListener('scroll', handleScroll, {passive: true});
        return () => window.removeEventListener('scroll', handleScroll);
    }, [lastScrollY]);

    return (
        <div
            className={`transition-all duration-300 ${
                isFloating
                    ? 'fixed top-0 left-0 right-0 z-50 px-6 py-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm shadow-md'
                    : 'relative w-full mb-4'
            } ${isVisible ? 'translate-y-0' : '-translate-y-full'}`}>
            <div className='flex items-center gap-4'>
                <SearchBar
                    onSearch={onSearch}
                    placeholder={searchPlaceholder}
                    className='flex-1'
                />

                <div className='flex-none'>
                    <SortDropdown
                        options={[
                            {key: 'name', label: 'Sort by Name'},
                            {key: 'dateCreated', label: 'Sort by Date Created'},
                            {
                                key: 'dateModified',
                                label: 'Sort by Date Modified'
                            }
                        ]}
                        currentKey={sortBy}
                        currentDirection='desc'
                        onSort={key => setSortBy(key)}
                    />
                </div>

                <div className='flex-none'>
                    <FilterMenu
                        filterType={filterType}
                        setFilterType={setFilterType}
                        filterValue={filterValue}
                        setFilterValue={setFilterValue}
                        allTags={allTags}
                    />
                </div>

                <div className='flex-none'>
                    <ToggleSelectButton
                        isSelectionMode={isSelectionMode}
                        onClick={toggleSelectionMode}
                    />
                </div>

                {showAddButton && !isSelectionMode && (
                    <div className='flex-none'>
                        <AddButton onClick={onAdd} label={addButtonLabel} />
                    </div>
                )}
            </div>
        </div>
    );
};

export default DataBar;
