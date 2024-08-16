import { useState, useEffect } from 'react';
import RegexManager from './components/regex/RegexManager';
import CustomFormatManager from './components/format/FormatManager';
import Navbar from './components/ui/Navbar';

function App() {
  const [activeTab, setActiveTab] = useState('format');
  const [darkMode, setDarkMode] = useState(true);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        darkMode={darkMode}
        setDarkMode={setDarkMode}
      />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        {activeTab === 'regex' ? <RegexManager /> : <CustomFormatManager />}
      </div>
    </div>
    
  );
}

export default App;