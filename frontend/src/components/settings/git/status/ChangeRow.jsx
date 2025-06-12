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
    File,
    Check,
    Cog
} from 'lucide-react';
import Tooltip from '@ui/Tooltip';
import ViewChanges from './ViewChanges';

const ChangeRow = ({
    change,
    index,
    isSelected,
    willBeSelected,
    onSelect,
    onMouseEnter,
    onMouseLeave,
    onMouseDown,
    isIncoming
}) => {
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
            case 'Media Management':
                return <Cog className='text-orange-400' size={16} />;
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

    const rowClasses = `
        ${
            isIncoming
                ? 'cursor-default bg-gray-900'
                : 'cursor-pointer bg-gray-900 hover:bg-gray-800'
        }
        select-none
    `;

    return (
        <>
            <tr
                className={rowClasses}
                onClick={handleRowClick}
                onMouseEnter={() => onMouseEnter?.(change.file_path)}
                onMouseLeave={onMouseLeave}
                onMouseDown={onMouseDown}>
                <td className='py-2 px-4 text-gray-300'>
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
                <td className='py-2 px-4 text-gray-300'>
                    <div className='flex items-center'>
                        {getTypeIcon(change.type)}
                        <span className='ml-2'>{change.type}</span>
                    </div>
                </td>
                <td className='py-2 px-4 text-gray-300'>
                    {isIncoming ? (
                        change.incoming_name &&
                        change.incoming_name !== change.local_name ? (
                            <>
                                <span className='mr-3'>
                                    <strong>Local:</strong>{' '}
                                    {change.local_name ||
                                        change.name ||
                                        'Unnamed'}
                                </span>
                                <span>
                                    <strong>Incoming:</strong>{' '}
                                    {change.incoming_name ||
                                        change.name ||
                                        'Unnamed'}
                                </span>
                            </>
                        ) : (
                            change.local_name ||
                            change.incoming_name ||
                            change.name ||
                            (change.file_path
                                ? change.file_path.split('/').pop()
                                : 'Unnamed')
                        )
                    ) : change.outgoing_name &&
                      change.outgoing_name !== change.prior_name ? (
                        <>
                            <span className='mr-3'>
                                <strong>Prior:</strong>{' '}
                                {change.prior_name || change.name || 'Unnamed'}
                            </span>
                            <span>
                                <strong>Outgoing:</strong>{' '}
                                {change.outgoing_name ||
                                    change.name ||
                                    'Unnamed'}
                            </span>
                        </>
                    ) : (
                        change.outgoing_name ||
                        change.prior_name ||
                        change.name ||
                        (change.file_path
                            ? change.file_path.split('/').pop()
                            : 'Unnamed')
                    )}
                </td>
                <td className='py-2 px-4'>
                    <div className='flex items-center justify-end space-x-2'>
                        <Tooltip content='View changes'>
                            <button
                                onClick={handleViewChanges}
                                className='p-2 rounded-md bg-gray-700 hover:bg-gray-600 transition-colors'>
                                <Eye size={16} />
                            </button>
                        </Tooltip>
                        {!isIncoming && (
                            <Tooltip
                                content={
                                    isSelected
                                        ? 'Selected'
                                        : willBeSelected
                                        ? 'Will be selected'
                                        : 'Select'
                                }>
                                <div
                                    className={`w-6 h-6 rounded-full flex items-center justify-center ${
                                        isSelected
                                            ? 'bg-blue-500'
                                            : 'bg-gray-700'
                                    }`}>
                                    {isSelected && (
                                        <Check
                                            size={14}
                                            className='text-white'
                                        />
                                    )}
                                    {willBeSelected && !isSelected && (
                                        <div className='w-2 h-2 rounded-full bg-blue-400' />
                                    )}
                                </div>
                            </Tooltip>
                        )}
                    </div>
                </td>
            </tr>
            <ViewChanges
                key={`${change.file_path}-changes`}
                isOpen={showChanges}
                onClose={() => setShowChanges(false)}
                change={change}
                isIncoming={isIncoming}
            />
        </>
    );
};

export default ChangeRow;
