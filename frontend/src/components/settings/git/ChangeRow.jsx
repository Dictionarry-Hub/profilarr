import React, {useState} from 'react';
import {
    Eye,
    Plus,
    MinusCircle,
    Edit,
    GitBranch,
    AlertCircle,
    Code,
    FileText,
    Settings,
    File
} from 'lucide-react';
import Tooltip from '../../ui/Tooltip';
import ViewDiff from './modal/ViewDiff';

const ChangeRow = ({
    change,
    isSelected,
    onSelect,
    isIncoming,
    isDevMode,
    diffContent
}) => {
    const [showDiff, setShowDiff] = useState(false);

    const getStatusIcon = status => {
        switch (status) {
            case 'Untracked':
                return <Plus className='text-blue-400' size={16} />;
            case 'Staged (New)':
                return <Plus className='text-green-400' size={16} />;
            case 'Staged (Modified)':
            case 'Modified':
                return <Edit className='text-yellow-400' size={16} />;
            case 'Deleted':
                return <MinusCircle className='text-red-400' size={16} />;
            case 'Deleted (Staged)':
                return <MinusCircle className='text-red-600' size={16} />;
            case 'Renamed':
                return <GitBranch className='text-purple-400' size={16} />;
            default:
                return <AlertCircle className='text-gray-400' size={16} />;
        }
    };

    const getTypeIcon = type => {
        switch (type) {
            case 'Regex Pattern':
                return <Code className='text-blue-400' size={16} />;
            case 'Custom Format':
                return <FileText className='text-green-400' size={16} />;
            case 'Quality Profile':
                return <Settings className='text-purple-400' size={16} />;
            default:
                return <File className='text-gray-400' size={16} />;
        }
    };

    const handleViewDiff = e => {
        e.stopPropagation();
        console.log('Change Object: ', JSON.stringify(change, null, 2));
        setShowDiff(true);
    };

    return (
        <>
            <tr
                className={`border-t border-gray-600 cursor-pointer hover:bg-gray-700 ${
                    isSelected ? 'bg-gray-700' : ''
                }`}
                onClick={() => onSelect(change.file_path)}>
                <td className='px-4 py-2 text-gray-300'>
                    <div className='flex items-center'>
                        {getStatusIcon(change.status)}
                        <span className='ml-2'>
                            {change.staged
                                ? `${change.status} (Staged)`
                                : change.status}
                        </span>
                    </div>
                </td>
                <td className='px-4 py-2 text-gray-300'>
                    <div className='flex items-center'>
                        {getTypeIcon(change.type)}
                        <span className='ml-2'>{change.type}</span>
                    </div>
                </td>
                <td className='px-4 py-2 text-gray-300'>
                    {change.name || 'Unnamed'}
                </td>
                <td className='px-4 py-2 text-left align-middle'>
                    <Tooltip content='View differences'>
                        <button
                            onClick={handleViewDiff}
                            className='flex items-center justify-center px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-xs'
                            style={{width: '100%'}}>
                            <Eye size={12} className='mr-1' />
                            View Diff
                        </button>
                    </Tooltip>
                </td>
                <td className='px-4 py-2 text-right text-gray-300 align-middle'>
                    <input
                        type='checkbox'
                        checked={isSelected}
                        onChange={e => e.stopPropagation()}
                        disabled={!isIncoming && change.staged}
                    />
                </td>
            </tr>
            <ViewDiff
                key={`${change.file_path}-diff`}
                isOpen={showDiff}
                onClose={() => setShowDiff(false)}
                diffContent={diffContent}
                type={change.type}
                name={change.name}
                commitMessage={change.commit_message}
                isDevMode={isDevMode}
                isIncoming={isIncoming}
            />
        </>
    );
};

export default ChangeRow;
