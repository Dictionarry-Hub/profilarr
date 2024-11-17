// ConflictTable.jsx

import ConflictRow from './ConflictRow';
const ConflictTable = ({conflicts, isDevMode, fetchGitStatus}) => {
    return (
        <div className='border border-gray-600 rounded-md overflow-hidden mt-3'>
            <table className='w-full text-sm'>
                <thead className='bg-gray-600'>
                    <tr>
                        <th className='px-4 py-2 text-left text-gray-300 w-1/5'>
                            Status
                        </th>
                        <th className='px-4 py-2 text-left text-gray-300 w-1/5'>
                            Type
                        </th>
                        <th className='px-4 py-2 text-left text-gray-300 w-1/2'>
                            Name
                        </th>
                        <th className='px-4 py-2 text-left text-gray-300 w-1/5'>
                            Actions
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {conflicts.map((conflict, index) => (
                        <ConflictRow
                            key={`conflict-${index}`}
                            change={conflict}
                            isDevMode={isDevMode}
                            fetchGitStatus={fetchGitStatus}
                        />
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default ConflictTable;
