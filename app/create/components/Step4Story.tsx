'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CreateFlowState, STORY_TOPICS, STORY_TONES, AGE_GROUPS, AgeGroup } from '../types';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';

interface Step4StoryProps {
  state: CreateFlowState;
  updateState: (updates: Partial<CreateFlowState>) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function Step4Story({ state, updateState, onNext, onBack }: Step4StoryProps) {
  const [title, setTitle] = useState(state.story?.title || '');
  const [selectedTopics, setSelectedTopics] = useState<string[]>(state.story?.topics || []);
  const [customTopic, setCustomTopic] = useState(state.story?.customTopic || '');
  const [pages, setPages] = useState(state.story?.pages || 6);
  const [tone, setTone] = useState(state.story?.tone || 'cheerful');
  const [targetAge, setTargetAge] = useState(state.story?.targetAge || 6);
  const [dyslexiaMode, setDyslexiaMode] = useState(state.story?.dyslexiaMode || false);
  const [fontScale, setFontScale] = useState(state.story?.fontScale || 1);
  const [highContrast, setHighContrast] = useState(state.story?.highContrast || false);
  const inferAgeGroup = (n: number): AgeGroup => {
    if (n <= 2) return 'T2';
    if (n <= 3) return 'F2T3';
    if (n <= 5) return 'F3T5';
    if (n <= 7) return 'F5T7';
    return 'F7';
  };
  const [ageGroup, setAgeGroup] = useState<AgeGroup>(state.story?.ageGroup || inferAgeGroup(targetAge));

  // Generate title suggestions
  const characterName = state.characterRoster?.main?.name || 'Hero';

  const titlePlaceholders = [
    `The Adventures of ${characterName}`,
    `${characterName} and the Magic Garden`,
    `When ${characterName} Discovered Courage`,
    `${characterName}'s Amazing Journey`,
  ];

  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((prev) => (prev + 1) % titlePlaceholders.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const toggleTopic = (topicId: string) => {
    setSelectedTopics((prev) =>
      prev.includes(topicId)
        ? prev.filter((t) => t !== topicId)
        : [...prev, topicId]
    );
  };

  const handleContinue = async () => {
    if (!state.bookId) return;

    const storyConfig = {
      title: title || titlePlaceholders[0],
      topics: selectedTopics,
      customTopic,
      pages,
      tone,
      targetAge,
      ageGroup,
      dyslexiaMode,
      fontScale,
      highContrast,
    };

    // Update local state
    updateState({ story: storyConfig });

    // Send to workflow
    try {
      const prefs = {
        title: title || titlePlaceholders[0],
        topic: selectedTopics.length > 0
          ? selectedTopics.map(id => STORY_TOPICS.find(t => t.id === id)?.name).join(' and ')
          : customTopic || 'adventure',
        targetAge,
        pages,
        tone,
        ageGroup,
        dyslexiaMode,
        fontScale,
        highContrast,
      };

      await fetch('/api/workflows/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId: state.bookId,
          type: 'setBookPrefs',
          payload: prefs,
        }),
      });

      onNext();
    } catch (err) {
      console.error('Error setting preferences:', err);
      alert('Failed to save story preferences. Please try again.');
    }
  };

  const canContinue = title.trim() || selectedTopics.length > 0 || customTopic.trim();

  return (
    <div className='max-w-6xl mx-auto'>
      <motion.div
        className='text-center mb-12'
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className='text-5xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent'>
          Shape Your Story 📖
        </h1>
        <p className='text-xl text-gray-600'>
          Let's create an amazing adventure for {characterName}!
        </p>
      </motion.div>

      <div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
        {/* Main Form */}
        <div className='lg:col-span-2 space-y-6'>
          {/* Title */}
          <Card>
            <h3 className='text-2xl font-bold mb-4'>Story Title</h3>
            <Input
              placeholder={titlePlaceholders[placeholderIndex]}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className='text-xl font-semibold'
            />
          </Card>

          {/* Topics */}
          <Card>
            <h3 className='text-2xl font-bold mb-4'>Story Themes (pick one or more)</h3>
            <div className='grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4'>
              {STORY_TOPICS.map((topic) => (
                <motion.button
                  key={topic.id}
                  onClick={() => toggleTopic(topic.id)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    selectedTopics.includes(topic.id)
                      ? 'border-purple-500 bg-purple-50 shadow-md'
                      : 'border-gray-200 hover:border-purple-300'
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <div className='text-3xl mb-2'>{topic.emoji}</div>
                  <div className='text-sm font-semibold'>{topic.name}</div>
                </motion.button>
              ))}
            </div>
            <Input
              placeholder='Or write your own theme...'
              value={customTopic}
              onChange={(e) => setCustomTopic(e.target.value)}
            />
          </Card>

          {/* Story Settings */}
          <Card>
            <h3 className='text-2xl font-bold mb-6'>Story Settings</h3>
            <div className='space-y-6'>
              {/* Age Group */}
              <div>
                <label className='label mb-2'>Reading Age Group</label>
                <Select
                  options={AGE_GROUPS as any}
                  value={ageGroup}
                  onChange={(e) => setAgeGroup(e.target.value as AgeGroup)}
                />
                <p className='text-xs text-gray-500 mt-1'>
                  Text matches this group's simplicity. T2/F2T3: no commas/dialogue. F3–5: up to 1 short dialogue line, ≤1 comma. F5–7: ≤2 dialogue lines, ≤2 commas. F7: ≤2 dialogue lines, ≤3 commas.
                </p>
              </div>
              {/* Pages */}
              <div>
                <label className='label flex items-center gap-2 mb-2'>
                  Number of Pages: <span className='text-2xl font-bold text-purple-600'>{pages}</span>
                </label>
                <input
                  type='range'
                  min='4'
                  max='8'
                  value={pages}
                  onChange={(e) => setPages(Number(e.target.value))}
                  className='w-full h-3 bg-gradient-to-r from-purple-200 to-pink-200 rounded-lg'
                />
                <div className='flex justify-between text-xs text-gray-600 mt-1'>
                  <span>Quick Story (4)</span>
                  <span>Epic Tale (8)</span>
                </div>
              </div>

              {/* Age */}
              <div>
                <label className='label flex items-center gap-2 mb-2'>
                  Target Age: <span className='text-2xl font-bold text-purple-600'>{targetAge}</span>
                </label>
                <input
                  type='range'
                  min='3'
                  max='12'
                  value={targetAge}
                  onChange={(e) => setTargetAge(Number(e.target.value))}
                  className='w-full h-3 bg-gradient-to-r from-purple-200 to-pink-200 rounded-lg'
                />
                <div className='flex justify-between text-xs text-gray-600 mt-1'>
                  <span>👶 3 years</span>
                  <span>🧒 12 years</span>
                </div>
              </div>

              {/* Tone */}
              <div>
                <label className='label mb-2'>Story Tone</label>
                <div className='grid grid-cols-2 gap-3'>
                  {STORY_TONES.map((toneOption) => (
                    <motion.button
                      key={toneOption.id}
                      onClick={() => setTone(toneOption.technicalValue)}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${
                        tone === toneOption.technicalValue
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-purple-300'
                      }`}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <div className='text-2xl mb-1'>{toneOption.emoji}</div>
                      <div className='text-sm font-semibold'>{toneOption.name}</div>
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          {/* Accessibility */}
          <Card>
            <h3 className='text-2xl font-bold mb-4'>📚 Make it Extra Readable</h3>
            <div className='space-y-4'>
              <label className='flex items-center gap-3 p-3 rounded-xl border-2 border-purple-200 cursor-pointer hover:bg-purple-50'>
                <input
                  type='checkbox'
                  checked={dyslexiaMode}
                  onChange={(e) => setDyslexiaMode(e.target.checked)}
                  className='h-5 w-5'
                />
                <span className='font-semibold'>Dyslexia-friendly font</span>
              </label>

              <div className='p-3 rounded-xl border-2 border-purple-200'>
                <label className='label mb-2'>Font Size: {fontScale.toFixed(1)}x</label>
                <input
                  type='range'
                  min='0.9'
                  max='1.4'
                  step='0.1'
                  value={fontScale}
                  onChange={(e) => setFontScale(Number(e.target.value))}
                  className='w-full'
                />
              </div>

              <label className='flex items-center gap-3 p-3 rounded-xl border-2 border-purple-200 cursor-pointer hover:bg-purple-50'>
                <input
                  type='checkbox'
                  checked={highContrast}
                  onChange={(e) => setHighContrast(e.target.checked)}
                  className='h-5 w-5'
                />
                <span className='font-semibold'>High contrast mode</span>
              </label>
            </div>
          </Card>
        </div>

        {/* Preview Panel */}
        <div className='lg:col-span-1'>
          <div className='sticky top-8'>
            <Card className='bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200'>
              <h3 className='text-xl font-bold mb-4 text-center'>📖 Book Preview</h3>
              <div className='aspect-[3/4] bg-white rounded-xl shadow-xl p-6 flex flex-col items-center justify-center'>
                <div className='text-6xl mb-4'>
                  {STORY_TONES.find(t => t.technicalValue === tone)?.emoji || '📖'}
                </div>
                <h4 className='text-xl font-bold text-center mb-2'>
                  {title || titlePlaceholders[0]}
                </h4>
                <p className='text-sm text-gray-600 text-center mb-4'>
                  by {characterName}
                </p>
                <div className='text-xs text-gray-500 text-center'>
                  {pages} pages • Ages {targetAge}+ · {AGE_GROUPS.find(g => g.value === ageGroup)?.label}
                </div>
                {selectedTopics.length > 0 && (
                  <div className='mt-4 flex flex-wrap gap-1 justify-center'>
                    {selectedTopics.slice(0, 3).map((topicId) => {
                      const topic = STORY_TOPICS.find(t => t.id === topicId);
                      return (
                        <span key={topicId} className='text-lg'>
                          {topic?.emoji}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
              <p className='text-xs text-gray-600 text-center mt-4'>
                This is what your book will look like!
              </p>
            </Card>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className='flex gap-4 justify-center mt-8'>
        <Button variant='secondary' onClick={onBack} size='lg'>
          ← Back
        </Button>
        <Button
          onClick={handleContinue}
          disabled={!canContinue}
          size='lg'
          className='min-w-64'
        >
          {canContinue ? '✨ Create My Book!' : 'Add a title or theme first'}
        </Button>
      </div>
    </div>
  );
}

