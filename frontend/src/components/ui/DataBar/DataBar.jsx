import React, {useState, useEffect} from 'react';
import SearchBar from './SearchBar';
import FilterMenu from './FilterMenu';
import {SortDropdown} from './SortDropdown';
import ToggleSelectButton from './ToggleSelectButton';
import AddButton from './AddButton';

const FloatingBar = ({children}) => (
    <>
        <div className='fixed top-0 left-0 right-0 z-50 animate-slide-down bg-gradient-to-br from-gray-800 to-gray-900 border-b border-gray-700 shadow-xl backdrop-blur-sm'>
            <div className='max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8'>
                <div className='flex items-center gap-4 h-16'>{children}</div>
            </div>
        </div>
        <div className='h-16' />
    </>
);

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
    showAddButton = true,
    className
}) => {
    const [isFloating, setIsFloating] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [activeSearch, setActiveSearch] = useState('');

    useEffect(() => {
        const handleScroll = () => {
            setIsFloating(window.scrollY > 64);
        };

        window.addEventListener('scroll', handleScroll, {passive: true});
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleSearch = term => {
        // First set the search term and trigger the search
        setActiveSearch(term);
        onSearch(term);

        // Then smoothly scroll to top
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    };

    const controls = (
        <>
            <SearchBar
                onSearch={handleSearch}
                placeholder={searchPlaceholder}
                className='flex-1'
                requireEnter
                searchTerm={searchTerm}
                setSearchTerm={setSearchTerm}
                activeSearch={activeSearch}
                setActiveSearch={setActiveSearch}
            />

            <div className='flex items-center gap-3'>
                <SortDropdown
                    options={[
                        {key: 'name', label: 'Sort by Name'},
                        {key: 'dateCreated', label: 'Sort by Date Created'},
                        {key: 'dateModified', label: 'Sort by Date Modified'}
                    ]}
                    currentKey={sortBy}
                    currentDirection='desc'
                    onSort={key => setSortBy(key)}
                />

                <FilterMenu
                    filterType={filterType}
                    setFilterType={setFilterType}
                    filterValue={filterValue}
                    setFilterValue={setFilterValue}
                    allTags={allTags}
                />

                <ToggleSelectButton
                    isSelectionMode={isSelectionMode}
                    onClick={toggleSelectionMode}
                />

                {showAddButton && !isSelectionMode && (
                    <AddButton onClick={onAdd} label={addButtonLabel} />
                )}
            </div>
        </>
    );

    if (isFloating) {
        return <FloatingBar>{controls}</FloatingBar>;
    }

    return (
        <div className={className}>
            <div className='flex items-center h-16 gap-4'>{controls}</div>
        </div>
    );
};

export default DataBar;
