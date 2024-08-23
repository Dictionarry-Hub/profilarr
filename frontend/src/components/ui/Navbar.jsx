import PropTypes from 'prop-types';
import { useState, useEffect, useRef } from 'react';

function ToggleSwitch({ checked, onChange }) {
  return (
    <label className="flex items-center cursor-pointer">
      <div className="relative">
        <input type="checkbox" className="sr-only" checked={checked} onChange={onChange} />
        <div className={`block w-14 h-8 rounded-full ${checked ? 'bg-blue-600' : 'bg-gray-600'} transition-colors duration-300`}></div>
        <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform duration-300 ${checked ? 'transform translate-x-6' : ''}`}></div>
      </div>
      <div className="ml-3 text-gray-300 font-medium">
        {checked ? 'Dark' : 'Light'}
      </div>
    </label>
  );
}

ToggleSwitch.propTypes = {
  checked: PropTypes.bool.isRequired,
  onChange: PropTypes.func.isRequired,
};

function Navbar({ activeTab, setActiveTab, darkMode, setDarkMode }) {
  const [tabOffset, setTabOffset] = useState(0);
  const [tabWidth, setTabWidth] = useState(0);
  const tabsRef = useRef([]);

  useEffect(() => {
    if (tabsRef.current[activeTab]) {
      const tab = tabsRef.current[activeTab];
      setTabOffset(tab.offsetLeft);
      setTabWidth(tab.offsetWidth);
    }
  }, [activeTab]);

  return (
    <nav className="bg-gray-800 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <h1 className="text-2xl font-bold text-white">
              Profilarr
            </h1>
            <div className="relative flex space-x-2">
              <div
                className="absolute top-0 bottom-0 bg-gray-900 rounded-md transition-all duration-300"
                style={{ left: tabOffset, width: tabWidth }}
              ></div>
              <button
                ref={(el) => (tabsRef.current['regex'] = el)}
                className={`px-3 py-2 rounded-md text-sm font-medium relative z-10 ${
                  activeTab === 'regex' ? 'text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
                onClick={() => setActiveTab('regex')}
              >
                Regex
              </button>
              <button
                ref={(el) => (tabsRef.current['format'] = el)}
                className={`px-3 py-2 rounded-md text-sm font-medium relative z-10 ${
                  activeTab === 'format' ? 'text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
                onClick={() => setActiveTab('format')}
              >
                Custom Format
              </button>
              <button
                ref={(el) => (tabsRef.current['settings'] = el)}
                className={`px-3 py-2 rounded-md text-sm font-medium relative z-10 ${
                  activeTab === 'settings' ? 'text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                }`}
                onClick={() => setActiveTab('settings')}
              >
                Settings
              </button>
            </div>
          </div>
          <ToggleSwitch checked={darkMode} onChange={() => setDarkMode(!darkMode)} />
        </div>
      </div>
    </nav>
  );
}

Navbar.propTypes = {
  activeTab: PropTypes.string.isRequired,
  setActiveTab: PropTypes.func.isRequired,
  darkMode: PropTypes.bool.isRequired,
  setDarkMode: PropTypes.func.isRequired,
};

export default Navbar;
