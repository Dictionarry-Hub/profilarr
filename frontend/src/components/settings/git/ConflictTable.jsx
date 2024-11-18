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

const ConflictTable = ({conflicts, isDevMode, fetchGitStatus}) => {
    const hasUnresolvedConflicts = conflicts.some(
        conflict => conflict.status !== 'RESOLVED'
    );

    return (
        <div className='border border-gray-600 rounded-md overflow-hidden mt-3'>
            {conflicts.length === 0 ? (
                <EmptyState />
            ) : (
                <>
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
                </>
            )}
        </div>
    );
};

export default ConflictTable;
