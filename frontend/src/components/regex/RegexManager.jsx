import { useState, useEffect } from 'react';
import RegexCard from './RegexCard';
import RegexModal from './RegexModal';
import AddNewCard from '../ui/AddNewCard';
import { getRegexes } from '../../api/api';
import FilterMenu from '../ui/FilterMenu';
import SortMenu from '../ui/SortMenu';

function RegexManager() {
  const [regexes, setRegexes] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRegex, setSelectedRegex] = useState(null);
  const [sortBy, setSortBy] = useState('title');
  const [filterType, setFilterType] = useState('none');
  const [filterValue, setFilterValue] = useState('');
  const [allTags, setAllTags] = useState([]);

  useEffect(() => {
    fetchRegexes();
  }, []);

  const fetchRegexes = async () => {
    try {
      const fetchedRegexes = await getRegexes();
      setRegexes(fetchedRegexes);
      const tags = [...new Set(fetchedRegexes.flatMap(regex => regex.tags || []))];
      setAllTags(tags);
    } catch (error) {
      console.error('Error fetching regexes:', error);
    }
  };

  const handleOpenModal = (regex = null) => {
    setSelectedRegex(regex);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setSelectedRegex(null);
    setIsModalOpen(false);
  };

  const handleSaveRegex = () => {
    fetchRegexes();
    handleCloseModal();
  };

  const handleCloneRegex = (regex) => {
    const clonedRegex = { 
      ...regex, 
      id: 0, // Ensure the ID is 0 for a new entry
      name: `${regex.name} [COPY]`, 
      regex101Link: '' // Remove the regex101 link
    };
    setSelectedRegex(clonedRegex); // Set cloned regex
    setIsModalOpen(true); // Open modal in Add mode
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const sortedAndFilteredRegexes = regexes
    .filter(regex => {
      if (filterType === 'tag') {
        return regex.tags && regex.tags.includes(filterValue);
      }
      if (filterType === 'date') {
        const regexDate = new Date(regex.date_modified);
        const filterDate = new Date(filterValue);
        return regexDate.toDateString() === filterDate.toDateString();
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'title') return a.name.localeCompare(b.name);
      if (sortBy === 'dateCreated') return new Date(b.date_created) - new Date(a.date_created);
      if (sortBy === 'dateModified') return new Date(b.date_modified) - new Date(a.date_modified);
      return 0;
    });

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Manage Regex Patterns</h2>
      <div className="mb-4 flex items-center space-x-4">
        <SortMenu sortBy={sortBy} setSortBy={setSortBy} />
        <FilterMenu
          filterType={filterType}
          setFilterType={setFilterType}
          filterValue={filterValue}
          setFilterValue={setFilterValue}
          allTags={allTags}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-4">
        {sortedAndFilteredRegexes.map((regex) => (
          <RegexCard
            key={regex.id}
            regex={regex}
            onEdit={() => handleOpenModal(regex)}
            onClone={handleCloneRegex} // Pass the clone handler
            showDate={sortBy !== 'title'}
            formatDate={formatDate}
          />
        ))}
        <AddNewCard onAdd={() => handleOpenModal()} />
      </div>
      <RegexModal
        regex={selectedRegex}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveRegex}
        allTags={allTags}
      />
    </div>
  );
}

export default RegexManager;
