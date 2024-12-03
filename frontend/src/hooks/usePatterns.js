import {useState, useEffect} from 'react';
import {RegexPatterns} from '@api/data';

export const usePatterns = () => {
    const [patterns, setPatterns] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchPatterns = async () => {
            try {
                const response = await RegexPatterns.getAll();
                const patternsData = response.map(item => ({
                    name: item.content.name,
                    description: item.content.description,
                    pattern: item.content.pattern
                }));
                setPatterns(patternsData);
                setError(null);
            } catch (err) {
                setError('Failed to load patterns');
                console.error('Error loading patterns:', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchPatterns();
    }, []);

    return {patterns, isLoading, error};
};
