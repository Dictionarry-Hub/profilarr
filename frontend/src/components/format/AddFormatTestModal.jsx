import React, {useState, useEffect} from 'react';
import PropTypes from 'prop-types';
import Modal from '@ui/Modal';

const AddFormatTestModal = ({
    isOpen,
    onClose,
    onAdd,
    tests,
    editTest = null
}) => {
    const [input, setInput] = useState('');
    const [expected, setExpected] = useState(true);

    // Reset form when opening modal, handling both new and edit cases
    useEffect(() => {
        if (isOpen) {
            if (editTest) {
                setInput(editTest.input);
                setExpected(editTest.expected);
            } else {
                setInput('');
                setExpected(true);
            }
        }
    }, [isOpen, editTest]);

    const handleSubmit = () => {
        const getNextTestId = testArray => {
            if (!testArray || testArray.length === 0) return 1;
            return Math.max(...testArray.map(test => test.id)) + 1;
        };

        const testData = {
            id: editTest ? editTest.id : getNextTestId(tests),
            input,
            expected,
            passes: false,
            lastRun: null,
            conditionResults: [] // This will be populated when the test is run
        };

        onAdd(testData);
        handleClose();
    };

    const handleClose = () => {
        setInput('');
        setExpected(true);
        onClose();
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title={editTest ? 'Edit Test Case' : 'Add Test Case'}
            width='3xl'
            footer={
                <div className='flex justify-end space-x-3'>
                    <button
                        onClick={handleClose}
                        className='px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 
            bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md 
            hover:bg-gray-50 dark:hover:bg-gray-700'>
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!input.trim()}
                        className='px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-md 
            hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed'>
                        {editTest ? 'Save Changes' : 'Add Test'}
                    </button>
                </div>
            }>
            <div className='space-y-4'>
                <div className='space-y-2'>
                    <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
                        Test String
                    </label>
                    <input
                        type='text'
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        className='w-full px-3 py-2 border border-gray-300 dark:border-gray-600 
            rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 
            placeholder-gray-500 dark:placeholder-gray-400
            focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'
                        placeholder='Enter release title to test...'
                        autoFocus
                    />
                </div>

                <div className='space-y-2'>
                    <label className='block text-sm font-medium text-gray-700 dark:text-gray-300'>
                        Expected Result
                    </label>
                    <div className='flex space-x-4'>
                        <label className='flex items-center space-x-2'>
                            <input
                                type='radio'
                                checked={expected}
                                onChange={() => setExpected(true)}
                                className='text-blue-600 focus:ring-blue-500'
                            />
                            <span className='text-sm text-gray-700 dark:text-gray-300'>
                                Format Should Apply
                            </span>
                        </label>
                        <label className='flex items-center space-x-2'>
                            <input
                                type='radio'
                                checked={!expected}
                                onChange={() => setExpected(false)}
                                className='text-blue-600 focus:ring-blue-500'
                            />
                            <span className='text-sm text-gray-700 dark:text-gray-300'>
                                Format Should Not Apply
                            </span>
                        </label>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

AddFormatTestModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onAdd: PropTypes.func.isRequired,
    tests: PropTypes.array.isRequired,
    editTest: PropTypes.shape({
        id: PropTypes.number.isRequired,
        input: PropTypes.string.isRequired,
        expected: PropTypes.bool.isRequired
    })
};

export default AddFormatTestModal;
