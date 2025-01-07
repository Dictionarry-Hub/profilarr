// ConflictTable.jsx

import ConflictRow from './ConflictRow';
import {Check} from 'lucide-react';

const EmptyState = () => (
    <div className='flex flex-col items-center justify-center p-8 text-gray-300'>
        <div className='bg-green-500/10 rounded-full p-3 mb-3'>
            <Check className='w-6 h-6 text-green-500' />
        </div>
        <p className='text-lg font-medium'>No conflicts to resolve</p>
        <p className='text-sm text-gray-400'>Everything is up to date!</p>
    </div>
);

const ConflictTable = ({conflicts, fetchGitStatus}) => {
    return (
        <div className='rounded-lg border border-gray-700 overflow-hidden mt-3'>
            {conflicts.length === 0 ? (
                <EmptyState />
            ) : (
                <table className='w-full'>
                    <thead>
                        <tr className='bg-gray-800 border-b border-gray-700'>
                            <th className='py-2 px-4 text-left text-gray-400 font-medium w-1/5 rounded-tl-lg'>
                                Status
                            </th>
                            <th className='py-2 px-4 text-left text-gray-400 font-medium w-1/5'>
                                Type
                            </th>
                            <th className='py-2 px-4 text-left text-gray-400 font-medium w-1/2'>
                                Name
                            </th>
                            <th className='py-2 px-4 text-middle text-gray-400 font-medium w-1/5 rounded-tr-lg'>
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {conflicts.map((conflict, index) => (
                            <ConflictRow
                                key={`conflict-${index}`}
                                change={conflict}
                                fetchGitStatus={fetchGitStatus}
                            />
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};

export default ConflictTable;
