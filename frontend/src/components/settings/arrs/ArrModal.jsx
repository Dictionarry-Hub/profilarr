// ArrModal.js
import React, {useState, useEffect} from 'react';
import {Plus, TestTube, Loader, Save} from 'lucide-react';
import Modal from '../../ui/Modal';

const ArrModal = ({isOpen, onClose, onSubmit, editingArr}) => {
    const [arrType, setArrType] = useState('');
    const [arrName, setArrName] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [isTestingConnection, setIsTestingConnection] = useState(false);

    useEffect(() => {
        if (editingArr) {
            setArrType(editingArr.type);
            setArrName(editingArr.name);
            setApiKey(editingArr.apiKey);
        } else {
            setArrType('');
            setArrName('');
            setApiKey('');
        }
    }, [editingArr]);

    const handleTestConnection = async () => {
        setIsTestingConnection(true);
        try {
            const result = await testConnection(arrType, apiKey);
            if (result.success) {
                alert('Connection successful!');
            } else {
                alert('Connection failed: ' + result.error);
            }
        } catch (error) {
            alert('An error occurred while testing the connection.');
            console.error('Error testing connection:', error);
        } finally {
            setIsTestingConnection(false);
        }
    };

    const handleSubmit = e => {
        e.preventDefault();
        onSubmit({type: arrType, name: arrName, apiKey});
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={editingArr ? 'Edit Arr' : 'Add New Arr'}
            size='md'>
            <form onSubmit={handleSubmit} className='space-y-4'>
                <div>
                    <label
                        htmlFor='arrType'
                        className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
                        Arr Type
                    </label>
                    <select
                        id='arrType'
                        value={arrType}
                        onChange={e => setArrType(e.target.value)}
                        className='mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white'
                        required>
                        <option value=''>Select an arr type</option>
                        <option value='radarr'>Radarr</option>
                        <option value='sonarr'>Sonarr</option>
                        <option value='custom'>Custom</option>
                    </select>
                </div>
                <div>
                    <label
                        htmlFor='arrName'
                        className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
                        Arr Name
                    </label>
                    <input
                        type='text'
                        id='arrName'
                        value={arrName}
                        onChange={e => setArrName(e.target.value)}
                        className='mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white'
                        required
                    />
                </div>
                <div>
                    <label
                        htmlFor='apiKey'
                        className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
                        API Key
                    </label>
                    <input
                        type='text'
                        id='apiKey'
                        value={apiKey}
                        onChange={e => setApiKey(e.target.value)}
                        className='mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white'
                        required
                    />
                </div>
                <div className='flex justify-end space-x-2'>
                    <button
                        type='button'
                        onClick={handleTestConnection}
                        className='px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors duration-200 ease-in-out flex items-center'
                        disabled={isTestingConnection || !arrType || !apiKey}>
                        {isTestingConnection ? (
                            <Loader size={16} className='animate-spin mr-2' />
                        ) : (
                            <TestTube size={16} className='mr-2' />
                        )}
                        Test Connection
                    </button>
                    <button
                        type='submit'
                        className='px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors duration-200 ease-in-out flex items-center'>
                        {editingArr ? (
                            <>
                                <Save size={16} className='mr-2' />
                                Update Arr
                            </>
                        ) : (
                            <>
                                <Plus size={16} className='mr-2' />
                                Add Arr
                            </>
                        )}
                    </button>
                </div>
            </form>
        </Modal>
    );
};

export default ArrModal;
