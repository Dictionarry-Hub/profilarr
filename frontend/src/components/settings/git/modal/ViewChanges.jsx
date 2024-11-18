import React, {useState, useEffect} from 'react';
import PropTypes from 'prop-types';
import Modal from '../../../ui/Modal';
import DiffCommit from './DiffCommit';
import {getFormats} from '../../../../api/api';

const ViewChanges = ({isOpen, onClose, change, isIncoming}) => {
    const [formatNames, setFormatNames] = useState({});

    useEffect(() => {
        const fetchFormatNames = async () => {
            try {
                const formats = await getFormats();
                const namesMap = formats.reduce((acc, format) => {
                    acc[format.id] = format.name;
                    return acc;
                }, {});
                setFormatNames(namesMap);
            } catch (error) {
                console.error('Error fetching format names:', error);
            }
        };

        fetchFormatNames();
    }, []);

    const parseKey = param => {
        return param
            .split('_')
            .map(
                word =>
                    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            )
            .join(' ');
    };

    const parseChange = changeType => {
        return (
            changeType.charAt(0).toUpperCase() +
            changeType.slice(1).toLowerCase()
        );
    };

    const renderTable = (title, headers, data, renderRow) => {
        if (!data || !Array.isArray(data) || data.length === 0) {
            return (
                <div className='mb-6'>
                    <h4 className='text-md font-semibold text-gray-200 mb-2'>
                        {title}
                    </h4>
                    <div className='border border-gray-600 rounded-md p-4 text-gray-400'>
                        No data available.
                    </div>
                </div>
            );
        }

        return (
            <div className='mb-6'>
                <h4 className='text-md font-semibold text-gray-200 mb-2'>
                    {title}
                </h4>
                <div className='border border-gray-600 rounded-md overflow-hidden'>
                    <table className='w-full table-fixed'>
                        <colgroup>
                            {headers.map((header, index) => (
                                <col key={index} className={header.width} />
                            ))}
                        </colgroup>
                        <thead className='bg-gray-600'>
                            <tr>
                                {headers.map((header, index) => (
                                    <th
                                        key={index}
                                        className={`px-4 py-2 text-left text-gray-300 ${
                                            header.align || ''
                                        } ${
                                            index === 0 ? 'rounded-tl-md' : ''
                                        } ${
                                            index === headers.length - 1
                                                ? 'rounded-tr-md'
                                                : ''
                                        }`}>
                                        {header.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>{data.map(renderRow)}</tbody>
                    </table>
                </div>
            </div>
        );
    };

    const formatValue = value => {
        if (value === null || value === undefined) return '-';
        if (Array.isArray(value)) {
            return value
                .map(item => {
                    if (
                        typeof item === 'object' &&
                        item.id !== undefined &&
                        item.score !== undefined
                    ) {
                        return `Format ${item.id}: ${item.score}`;
                    }
                    return String(item);
                })
                .join(', ');
        }
        if (typeof value === 'object') {
            return JSON.stringify(value);
        }
        return String(value);
    };

    const renderChanges = () => {
        const isNewFile = change.status === 'New';

        const headers = isNewFile
            ? [
                  {key: 'change', label: 'Change', width: 'w-1/5'},
                  {key: 'key', label: 'Key', width: 'w-1/5'},
                  {key: 'value', label: 'Value', width: 'w-3/5'}
              ]
            : [
                  {key: 'change', label: 'Change', width: 'w-1/5'},
                  {key: 'key', label: 'Key', width: 'w-1/5'},
                  {key: 'from', label: 'From', width: 'w-1/5'},
                  {key: 'to', label: 'Value', width: 'w-3/5'}
              ];

        return renderTable(
            'Changes',
            headers,
            change.changes,
            ({change: changeType, key, from, to, value}, index) => {
                if (key.startsWith('custom_format_')) {
                    const formatId = key.split('_')[2];
                    return (
                        <tr
                            key={`custom_format_${formatId}`}
                            className='border-t border-gray-600'>
                            <td className='px-4 py-2.5 text-gray-300'>
                                {parseChange(changeType)}
                            </td>
                            <td className='px-4 py-2.5 text-gray-300'>
                                {`Custom Format: ${
                                    formatNames[formatId] ||
                                    `Format ${formatId}`
                                }`}
                            </td>
                            {isNewFile ? (
                                <td className='px-4 py-2.5 text-gray-300'>
                                    {to ?? value ?? '-'}
                                </td>
                            ) : (
                                <>
                                    <td className='px-4 py-2.5 text-gray-300'>
                                        {from ?? '-'}
                                    </td>
                                    <td className='px-4 py-2.5 text-gray-300'>
                                        {to ?? value ?? '-'}
                                    </td>
                                </>
                            )}
                        </tr>
                    );
                }

                return (
                    <tr key={index} className='border-t border-gray-600'>
                        <td className='px-4 py-2.5 text-gray-300'>
                            {parseChange(changeType)}
                        </td>
                        <td className='px-4 py-2.5 text-gray-300'>
                            {parseKey(key)}
                        </td>
                        {isNewFile ? (
                            <td className='px-4 py-2.5 text-gray-300'>
                                {formatValue(value)}
                            </td>
                        ) : (
                            <>
                                <td className='px-4 py-2.5 text-gray-300'>
                                    {formatValue(from)}
                                </td>
                                <td className='px-4 py-2.5 text-gray-300'>
                                    {formatValue(to ?? value)}
                                </td>
                            </>
                        )}
                    </tr>
                );
            }
        );
    };

    const titleContent = (
        <div className='flex items-center space-x-2 flex-wrap'>
            <span className='text-lg font-bold'>View Changes</span>
        </div>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={titleContent}
            width='5xl'>
            <div className='space-y-4'>
                {change.commit_message && (
                    <DiffCommit commitMessage={change.commit_message} />
                )}
                {renderChanges()}
            </div>
        </Modal>
    );
};

ViewChanges.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    change: PropTypes.object.isRequired,
    isIncoming: PropTypes.bool.isRequired
};

export default ViewChanges;
