import React from 'react';
import PushRow from './PushRow';

const PushTable = ({changes}) => (
    <div className='rounded-lg border border-gray-700 overflow-hidden'>
        <table className='w-full'>
            <thead>
                <tr className='bg-gray-800 border-b border-gray-700'>
                    <th className='py-2 px-4 text-left text-gray-400 font-medium w-1/4'>
                        Status
                    </th>
                    <th className='py-2 px-4 text-left text-gray-400 font-medium w-1/4'>
                        Type
                    </th>
                    <th className='py-2 px-4 text-left text-gray-400 font-medium w-2/4'>
                        Name
                    </th>
                </tr>
            </thead>
            <tbody>
                {changes.map((change, index) => (
                    <PushRow key={`push-${index}`} change={change} />
                ))}
            </tbody>
        </table>
    </div>
);

export default PushTable;
