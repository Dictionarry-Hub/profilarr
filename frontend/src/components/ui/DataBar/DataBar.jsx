import React, {useState, useEffect} from 'react';
import SearchBar from './SearchBar';
import FilterMenu from './FilterMenu';
import {SortDropdown} from './SortDropdown';
import ToggleSelectButton from './ToggleSelectButton';
import AddButton from './AddButton';

const FloatingBar = ({children}) => (
    <>
        <div className='fixed top-0 left-0 right-0 z-50 bg-gradient-to-br from-gray-800 to-gray-900 border-b border-gray-700 shadow-xl backdrop-blur-sm'>
            <div className='max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8'>
                <div className='flex items-center gap-1 sm:gap-4 h-16'>{children}</div>
            </div>
        </div>
        <div className='h-16' />
    </>
);

const DataBar = ({
    searchPlaceholder = 'Search by name or tag...',
    searchTerms,
    currentInput,
    onInputChange,
    onAddTerm,
    onRemoveTerm,
    onClearTerms,
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
    const [isMobile, setIsMobile] = useState(false);
    const [isSearchFocused, setIsSearchFocused] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setIsFloating(window.scrollY > 64);
        };
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };
        
        handleResize();
        window.addEventListener('scroll', handleScroll, {passive: true});
        window.addEventListener('resize', handleResize);
        
        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    const controls = (
        <>
            <SearchBar
                searchTerms={searchTerms}
                currentInput={currentInput}
                onInputChange={onInputChange}
                onAddTerm={onAddTerm}
                onRemoveTerm={onRemoveTerm}
                onClearTerms={onClearTerms}
                placeholder={isMobile ? 'Search' : searchPlaceholder}
                className={`${isMobile && isSearchFocused ? 'w-full' : 'flex-1'} transition-all duration-700 ease-out`}
                requireEnter
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
            />
            {(!isMobile || !isSearchFocused) && (
                <div className={`flex items-center ${isMobile ? 'gap-1' : 'gap-3'} transition-all duration-500 ${isMobile && isSearchFocused ? 'opacity-0 translate-x-4 scale-95' : 'opacity-100 translate-x-0 scale-100'}`}>
                <SortDropdown
                    options={[
                        {key: 'name', label: 'Sort by Name'},
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
                {showAddButton && !isSelectionMode && (
                    <AddButton onClick={onAdd} label={addButtonLabel} />
                )}
                <ToggleSelectButton
                    isSelectionMode={isSelectionMode}
                    onClick={toggleSelectionMode}
                />
            </div>
            )}
        </>
    );

    if (isFloating) {
        return <FloatingBar>{controls}</FloatingBar>;
    }

    return (
        <div className={className}>
            <div className={`flex items-center h-16 ${isMobile ? 'gap-1' : 'gap-4'}`}>{controls}</div>
        </div>
    );
};

export default DataBar;
