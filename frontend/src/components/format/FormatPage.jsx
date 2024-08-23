import React, { useState, useEffect } from "react";
import FormatCard from "./FormatCard";
import FormatModal from "./FormatModal";
import AddNewCard from "../ui/AddNewCard";
import { getFormats } from "../../api/api";
import FilterMenu from "../ui/FilterMenu";
import SortMenu from "../ui/SortMenu";
import { Loader } from "lucide-react";

function FormatPage() {
  const [formats, setFormats] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState(null);
  const [sortBy, setSortBy] = useState("title");
  const [filterType, setFilterType] = useState("none");
  const [filterValue, setFilterValue] = useState("");
  const [allTags, setAllTags] = useState([]);
  const [isCloning, setIsCloning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadingMessages = [
    "Decoding the custom format matrix...",
    "Parsing the digital alphabet soup...",
    "Untangling the format spaghetti...",
    "Calibrating the format-o-meter...",
    "Indexing your media DNA...",
  ];

  useEffect(() => {
    fetchFormats();
  }, []);

  const fetchFormats = async () => {
    try {
      const fetchedFormats = await getFormats();
      setFormats(fetchedFormats);
      const tags = [
        ...new Set(fetchedFormats.flatMap((format) => format.tags || [])),
      ];
      setAllTags(tags);
    } catch (error) {
      console.error("Error fetching formats:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (format = null) => {
    setSelectedFormat(format);
    setIsModalOpen(true);
    setIsCloning(false);
  };

  const handleCloseModal = () => {
    setSelectedFormat(null);
    setIsModalOpen(false);
    setIsCloning(false);
  };

  const handleCloneFormat = (format) => {
    const clonedFormat = {
      ...format,
      id: 0,
      name: `${format.name} [COPY]`,
    };
    setSelectedFormat(clonedFormat);
    setIsModalOpen(true);
    setIsCloning(true);
  };

  const handleSaveFormat = () => {
    fetchFormats();
    handleCloseModal();
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const sortedAndFilteredFormats = formats
    .filter((format) => {
      if (filterType === "tag") {
        return format.tags && format.tags.includes(filterValue);
      }
      if (filterType === "date") {
        const formatDate = new Date(format.date_modified);
        const filterDate = new Date(filterValue);
        return formatDate.toDateString() === filterDate.toDateString();
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
      <h2 className="text-2xl font-bold mb-4">Manage Custom Formats</h2>
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
        {sortedAndFilteredFormats.map((format) => (
          <FormatCard
            key={format.id}
            format={format}
            onEdit={() => handleOpenModal(format)}
            onClone={handleCloneFormat} // Pass the clone handler
            showDate={sortBy !== "title"}
            formatDate={formatDate}
          />
        ))}
        <AddNewCard onAdd={() => handleOpenModal()} />
      </div>
      <FormatModal
        format={selectedFormat}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveFormat}
        allTags={allTags}
        isCloning={isCloning}
      />
    </div>
  );
}

export default FormatPage;
