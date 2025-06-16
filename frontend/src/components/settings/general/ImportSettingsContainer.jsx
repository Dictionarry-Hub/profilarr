import React, {useState, useEffect} from 'react';
import {Save, Check} from 'lucide-react';
import {fetchLanguageImportScore, updateLanguageImportScore} from '@api/settings';
import Alert from '@ui/Alert';
import NumberInput from '@ui/NumberInput';
import CategoryContainer from './CategoryContainer';

const ImportSettingsContainer = () => {
    const [formData, setFormData] = useState({
        languageImportScore: 0
    });
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchScore();
    }, []);

    const fetchScore = async () => {
        setLoading(true);
        try {
            const {score} = await fetchLanguageImportScore();
            setFormData({
                languageImportScore: score
            });
        } catch (error) {
            console.error('Error fetching language import score:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleScoreChange = value => {
        setFormData(prev => ({...prev, languageImportScore: value}));
    };

    const handleSave = async () => {
        const score = formData.languageImportScore;

        if (score >= 0) {
            Alert.error('Score must be negative');
            return;
        }

        try {
            await updateLanguageImportScore(score);
            setSaveSuccess(true);
            setTimeout(() => setSaveSuccess(false), 1000);
        } catch (error) {
            console.error('Error updating language import score:', error);
        }
    };

    if (loading) {
        return (
            <CategoryContainer title='Import Settings'>
                <div className='flex items-center justify-center h-16'>
                    <div className='w-4 h-4 bg-gray-400 rounded-full animate-pulse'></div>
                </div>
            </CategoryContainer>
        );
    }

    return (
        <CategoryContainer title='Import Settings'>
            <div className='space-y-4'>
                <div className='space-y-2'>
                    <label className='text-sm font-medium text-gray-300'>
                        Language Import Score
                    </label>
                    <p className='text-xs text-gray-400'>
                        Default score assigned to language-specific custom formats when importing profiles. Must be negative.
                    </p>
                    <div className='flex gap-2'>
                        <NumberInput
                            value={formData.languageImportScore}
                            onChange={handleScoreChange}
                            className='flex-1'
                            step={1000}
                            max={-1}
                        />
                        <button
                            onClick={handleSave}
                            title='Save language import score'
                            className='px-3 py-1.5 bg-gray-700/50 border border-gray-700 rounded-lg hover:bg-gray-700 text-gray-200 text-sm flex items-center gap-2 transition-colors'>
                            {saveSuccess ? (
                                <Check size={16} className='text-green-500' />
                            ) : (
                                <Save size={16} className='text-blue-500' />
                            )}
                            Save
                        </button>
                    </div>
                </div>
            </div>
        </CategoryContainer>
    );
};

export default ImportSettingsContainer;