import React, {useState} from 'react';
import {
    Eye,
    Plus,
    MinusCircle,
    Edit,
    GitBranch,
    AlertTriangle,
    Code,
    FileText,
    Settings,
    File
} from 'lucide-react';
import Tooltip from '../../ui/Tooltip';
import ViewChanges from './modal/ViewChanges';

const ChangeRow = ({change, isSelected, onSelect, isIncoming, isDevMode}) => {
    const [showChanges, setShowChanges] = useState(false);

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
                return <AlertTriangle className='text-gray-400' size={16} />;
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

    const handleViewChanges = e => {
        e.stopPropagation();
        setShowChanges(true);
    };

    const handleRowClick = () => {
        if (!isIncoming && onSelect) {
            onSelect(change.file_path);
        }
    };

    // Determine row classes based on whether it's incoming or selected
    const rowClasses = `border-t border-gray-600 ${
        isIncoming
            ? 'cursor-default'
            : `cursor-pointer ${
                  isSelected ? 'bg-blue-700 bg-opacity-30' : 'hover:bg-gray-700'
              }`
    }`;

    return (
        <>
            <tr className={rowClasses} onClick={handleRowClick}>
                <td className='px-4 py-2 text-gray-300'>
                    <div className='flex items-center relative'>
                        {getStatusIcon(change.status)}
                        <span className='ml-2'>
                            {change.staged
                                ? `${change.status} (Staged)`
                                : change.status}
                        </span>
                        {isIncoming && change.will_conflict && (
                            <span
                                className='inline-block relative'
                                style={{zIndex: 1}}>
                                <Tooltip content='Potential Merge Conflict Detected'>
                                    <AlertTriangle
                                        className='text-yellow-400 ml-2'
                                        size={16}
                                    />
                                </Tooltip>
                            </span>
                        )}
                    </div>
                </td>
                <td className='px-4 py-2 text-gray-300'>
                    <div className='flex items-center'>
                        {getTypeIcon(change.type)}
                        <span className='ml-2'>{change.type}</span>
                    </div>
                </td>
                <td className='px-4 py-2 text-gray-300'>
                    {isIncoming ? (
                        change.incoming_name &&
                        change.incoming_name !== change.local_name ? (
                            <>
                                <span className='mr-3'>
                                    <strong>Local:</strong>{' '}
                                    {change.local_name || 'Unnamed'}
                                </span>
                                <span>
                                    <strong>Incoming:</strong>{' '}
                                    {change.incoming_name || 'Unnamed'}
                                </span>
                            </>
                        ) : (
                            change.local_name ||
                            change.incoming_name ||
                            'Unnamed'
                        )
                    ) : change.outgoing_name &&
                      change.outgoing_name !== change.prior_name ? (
                        <>
                            <span className='mr-3'>
                                <strong>Prior:</strong>{' '}
                                {change.prior_name || 'Unnamed'}
                            </span>
                            <span>
                                <strong>Outgoing:</strong>{' '}
                                {change.outgoing_name || 'Unnamed'}
                            </span>
                        </>
                    ) : (
                        change.outgoing_name || change.prior_name || 'Unnamed'
                    )}
                </td>
                <td className='px-4 py-2 text-left align-middle'>
                    <Tooltip content='View changes'>
                        <button
                            onClick={handleViewChanges}
                            className='flex items-center justify-center px-2 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors text-xs'
                            style={{width: '100%'}}>
                            <Eye size={12} className='mr-1' />
                            Changes
                        </button>
                    </Tooltip>
                </td>
            </tr>
            <ViewChanges
                key={`${change.file_path}-changes`}
                isOpen={showChanges}
                onClose={() => setShowChanges(false)}
                change={change}
                isIncoming={isIncoming}
                isDevMode={isDevMode}
            />
        </>
    );
};

export default ChangeRow;
