import React, { useState, useEffect } from "react";
import ProfileCard from "./ProfileCard";
import ProfileModal from "./ProfileModal";
import AddNewCard from "../ui/AddNewCard";
import { getProfiles, getFormats } from "../../api/api";
import FilterMenu from "../ui/FilterMenu";
import SortMenu from "../ui/SortMenu";

function ProfilePage() {
  const [profiles, setProfiles] = useState([]);
  const [formats, setFormats] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [sortBy, setSortBy] = useState("name");
  const [filterType, setFilterType] = useState("none");
  const [filterValue, setFilterValue] = useState("");
  const [allTags, setAllTags] = useState([]);
  const [isCloning, setIsCloning] = useState(false);

  useEffect(() => {
    fetchProfiles();
    fetchFormats();
  }, []);

  const fetchProfiles = async () => {
    try {
      const fetchedProfiles = await getProfiles();
      setProfiles(fetchedProfiles);
      const tags = [
        ...new Set(fetchedProfiles.flatMap((profile) => profile.tags || [])),
      ];
      setAllTags(tags);
    } catch (error) {
      console.error("Error fetching profiles:", error);
    }
  };

  const fetchFormats = async () => {
    try {
      const fetchedFormats = await getFormats();
      setFormats(fetchedFormats);
    } catch (error) {
      console.error("Error fetching formats:", error);
    }
  };

  const handleOpenModal = (profile = null) => {
    const safeProfile = profile
      ? {
          ...profile,
          custom_formats: profile.custom_formats || [],
        }
      : null;
    setSelectedProfile(safeProfile);
    setIsModalOpen(true);
    setIsCloning(false);
  };

  const handleCloseModal = () => {
    setSelectedProfile(null);
    setIsModalOpen(false);
    setIsCloning(false);
  };

  const handleCloneProfile = (profile) => {
    const clonedProfile = {
      ...profile,
      id: 0,
      name: `${profile.name} [COPY]`,
      custom_formats: profile.custom_formats || [],
    };
    setSelectedProfile(clonedProfile);
    setIsModalOpen(true);
    setIsCloning(true);
  };

  const handleSaveProfile = () => {
    fetchProfiles();
    handleCloseModal();
  };

  // Define the missing formatDate function
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  const sortedAndFilteredProfiles = profiles
    .filter((profile) => {
      if (filterType === "tag") {
        return profile.tags && profile.tags.includes(filterValue);
      }
      if (filterType === "date") {
        const profileDate = new Date(profile.date_modified);
        const filterDate = new Date(filterValue);
        return profileDate.toDateString() === filterDate.toDateString();
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "dateCreated")
        return new Date(b.date_created) - new Date(a.date_created);
      if (sortBy === "dateModified")
        return new Date(b.date_modified) - new Date(a.date_modified);
      return 0;
    });

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Manage Profiles</h2>
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
        {sortedAndFilteredProfiles.map((profile) => (
          <ProfileCard
            key={profile.id}
            profile={profile}
            onEdit={() => handleOpenModal(profile)}
            onClone={handleCloneProfile}
            showDate={sortBy !== "name"}
            formatDate={formatDate} // Pass the formatDate function to the ProfileCard
          />
        ))}
        <AddNewCard onAdd={() => handleOpenModal()} />
      </div>
      <ProfileModal
        profile={selectedProfile}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveProfile}
        formats={formats}
        isCloning={isCloning}
      />
    </div>
  );
}

export default ProfilePage;
