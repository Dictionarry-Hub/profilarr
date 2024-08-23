import React, { useState, useEffect } from "react";
import RegexCard from "./RegexCard";
import RegexModal from "./RegexModal";
import AddNewCard from "../ui/AddNewCard";
import { getRegexes } from "../../api/api";
import FilterMenu from "../ui/FilterMenu";
import SortMenu from "../ui/SortMenu";
import { Loader } from "lucide-react";

function RegexPage() {
  const [regexes, setRegexes] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedRegex, setSelectedRegex] = useState(null);
  const [sortBy, setSortBy] = useState("title");
  const [filterType, setFilterType] = useState("none");
  const [filterValue, setFilterValue] = useState("");
  const [allTags, setAllTags] = useState([]);
  const [isCloning, setIsCloning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadingMessages = [
    "Matching patterns in the digital universe...",
    "Capturing groups of binary brilliance...",
    "Escaping special characters in the wild...",
    "Quantifying the unquantifiable...",
    "Regex-ing the un-regex-able...",
  ];

  useEffect(() => {
    fetchRegexes();
  }, []);

  const fetchRegexes = async () => {
    try {
      const fetchedRegexes = await getRegexes();
      setRegexes(fetchedRegexes);
      const tags = [
        ...new Set(fetchedRegexes.flatMap((regex) => regex.tags || [])),
      ];
      setAllTags(tags);
    } catch (error) {
      console.error("Error fetching regexes:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (regex = null) => {
    setSelectedRegex(regex);
    setIsModalOpen(true);
    setIsCloning(false);
  };

  const handleCloseModal = () => {
    setSelectedRegex(null);
    setIsModalOpen(false);
    setIsCloning(false);
  };

  const handleCloneRegex = (regex) => {
    const clonedRegex = {
      ...regex,
      id: 0,
      name: `${regex.name} [COPY]`,
      regex101Link: "",
    };
    setSelectedRegex(clonedRegex);
    setIsModalOpen(true);
    setIsCloning(true);
  };

  const handleSaveRegex = () => {
    fetchRegexes();
    handleCloseModal();
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const sortedAndFilteredRegexes = regexes
    .filter((regex) => {
      if (filterType === "tag") {
        return regex.tags && regex.tags.includes(filterValue);
      }
      if (filterType === "date") {
        const regexDate = new Date(regex.date_modified);
        const filterDate = new Date(filterValue);
        return regexDate.toDateString() === filterDate.toDateString();
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "title") return a.name.localeCompare(b.name);
      if (sortBy === "dateCreated")
        return new Date(b.date_created) - new Date(a.date_created);
      if (sortBy === "dateModified")
        return new Date(b.date_modified) - new Date(a.date_modified);
      return 0;
    });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Loader size={48} className="animate-spin text-blue-500 mb-4" />
        <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
          {loadingMessages[Math.floor(Math.random() * loadingMessages.length)]}
        </p>
      </div>
    );
  }

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
            showDate={sortBy !== "title"}
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
        isCloning={isCloning}
      />
    </div>
  );
}

export default RegexPage;
