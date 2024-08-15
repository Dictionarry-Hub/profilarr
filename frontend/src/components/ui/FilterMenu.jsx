// FilterMenu.jsx
import { useState, useRef, useEffect } from 'react';
import PropTypes from 'prop-types';

function FilterMenu({ filterType, setFilterType, filterValue, setFilterValue, allTags }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const options = [
    { value: 'none', label: 'No Filter' },
    { value: 'tag', label: 'Filter by Tag' },
    { value: 'date', label: 'Filter by Date' },
  ];

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="flex items-center space-x-2">
      <div className="relative inline-block text-left" ref={dropdownRef}>
        <div>
          <button
            type="button"
            className="inline-flex justify-between items-center w-full rounded-md border border-gray-600 shadow-sm px-4 py-2 bg-gray-700 text-sm font-medium text-white hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-white"
            onClick={() => setIsOpen(!isOpen)}
          >
            {options.find(option => option.value === filterType)?.label}
            <svg className="-mr-1 ml-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        {isOpen && (
          <div className="origin-top-right absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-gray-700 ring-1 ring-black ring-opacity-5 z-50">
            <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
              {options.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setFilterType(option.value);
                    setFilterValue('');
                    setIsOpen(false);
                  }}
                  className={`${
                    filterType === option.value ? 'bg-gray-600 text-white' : 'text-gray-200'
                  } block w-full text-left px-4 py-2 text-sm hover:bg-gray-600 hover:text-white`}
                  role="menuitem"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {filterType === 'tag' && (
        <select
          value={filterValue}
          onChange={(e) => setFilterValue(e.target.value)}
          className="appearance-none bg-gray-700 text-white py-2 px-4 pr-8 rounded-md border border-gray-600 leading-tight focus:outline-none focus:bg-gray-600 focus:border-white cursor-pointer"
        >
          <option value="">Select a tag</option>
          {allTags.map(tag => (
            <option key={tag} value={tag}>{tag}</option>
          ))}
        </select>
      )}
      {filterType === 'date' && (
        <input
          type="date"
          value={filterValue}
          onChange={(e) => setFilterValue(e.target.value)}
          className="bg-gray-700 text-white py-2 px-4 rounded-md border border-gray-600 leading-tight focus:outline-none focus:bg-gray-600 focus:border-white cursor-pointer"
        />
      )}
    </div>
  );
}

FilterMenu.propTypes = {
  filterType: PropTypes.string.isRequired,
  setFilterType: PropTypes.func.isRequired,
  filterValue: PropTypes.string.isRequired,
  setFilterValue: PropTypes.func.isRequired,
  allTags: PropTypes.arrayOf(PropTypes.string).isRequired,
};

export default FilterMenu;