import { useState, useEffect } from "react";
import ProfileCard from "./ProfileCard";
import ProfileModal from "./ProfileModal";
import AddNewCard from "../ui/AddNewCard";
import { getProfiles } from "../../api/api";
import FilterMenu from "../ui/FilterMenu";
import SortMenu from "../ui/SortMenu";

function ProfilePage() {
  const [profiles, setProfiles] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [sortBy, setSortBy] = useState("name");
  const [filterType, setFilterType] = useState("none");
  const [filterValue, setFilterValue] = useState("");
  const [allTags, setAllTags] = useState([]);

  useEffect(() => {
    fetchProfiles();
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

  const handleOpenModal = (profile = null) => {
    setSelectedProfile(profile);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setSelectedProfile(null);
    setIsModalOpen(false);
  };

  const handleSaveProfile = () => {
    fetchProfiles();
    handleCloseModal();
  };

  const handleCloneProfile = (profile) => {
    const clonedProfile = {
      ...profile,
      id: 0, // Ensure the ID is 0 for a new entry
      name: `${profile.name} [COPY]`,
    };
    setSelectedProfile(clonedProfile);
    setIsModalOpen(true);
  };

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
            formatDate={formatDate}
          />
        ))}
        <AddNewCard onAdd={() => handleOpenModal()} />
      </div>
      <ProfileModal
        profile={selectedProfile}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveProfile}
        allTags={allTags}
      />
    </div>
  );
}

export default ProfilePage;
