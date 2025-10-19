'use client';

import { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { useSearchParams } from 'next/navigation';
import { useToast } from '../components/ui/Toast';

export default function PrefsPage() {
  const searchParams = useSearchParams();
  const bookId = searchParams?.get('bookId') || '';
  const { showToast } = useToast();

  // Book preferences (only if bookId is provided)
  const [title, setTitle] = useState('Ava and the Moon Garden');
  const [topic, setTopic] = useState('friendship and exploration');
  const [targetAge, setTargetAge] = useState(5);
  const [pages, setPages] = useState(4);
  const [tone, setTone] = useState('cheerful');
  const [dyslexiaMode, setDyslexiaMode] = useState(false);
  const [fontScale, setFontScale] = useState(1);
  const [highContrast, setHighContrast] = useState(false);
  const [loading, setLoading] = useState(false);

  // Voice preferences
  const [voiceRate, setVoiceRate] = useState(1);
  const [voicePitch, setVoicePitch] = useState(1);
  const [voiceIndex, setVoiceIndex] = useState(0);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Load voice preferences from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('voicePrefs');
      if (stored) {
        try {
          const prefs = JSON.parse(stored);
          setVoiceRate(prefs.rate || 1);
          setVoicePitch(prefs.pitch || 1);
          setVoiceIndex(prefs.voiceIndex || 0);
        } catch {
          // Ignore parse errors
        }
      }

      // Load available voices
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        setAvailableVoices(voices);
      };
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const saveVoicePrefs = () => {
    const prefs = { rate: voiceRate, pitch: voicePitch, voiceIndex };
    localStorage.setItem('voicePrefs', JSON.stringify(prefs));
    showToast('Voice preferences saved!', 'success');
  };

  const testVoice = () => {
    const utterance = new SpeechSynthesisUtterance('Hello! This is a test of your voice settings.');
    utterance.rate = voiceRate;
    utterance.pitch = voicePitch;
    if (availableVoices.length > voiceIndex) {
      utterance.voice = availableVoices[voiceIndex];
    }
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!bookId) {
      showToast('No workflow ID provided', 'error');
      return;
    }
    setLoading(true);
    try {
      const prefs = {
        title,
        topic,
        targetAge: Number(targetAge),
        pages: Number(pages),
        tone,
        dyslexiaMode,
        fontScale: Number(fontScale),
        highContrast,
      };
      await fetch('/api/workflows/signal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId, type: 'setBookPrefs', payload: prefs }),
      });
      showToast('Book preferences set successfully!', 'success');
      window.location.href = `/progress?workflowId=book-${bookId}`;
    } catch (error) {
      setLoading(false);
      showToast('Error setting preferences. Please try again.', 'error');
    }
  }

  if (bookId) {
    // Book workflow preferences page
    return (
      <div className='mx-auto max-w-3xl'>
        <Card>
          <div className='mb-6'>
            <h1 className='mb-2 text-3xl font-bold text-gray-900'>📚 Book Preferences</h1>
            <p className='text-gray-600'>
              Now let's shape your story! Tell us what you want to create.
            </p>
          </div>

          <form onSubmit={onSubmit} className='space-y-5'>
            <Input
              label='Book Title'
              placeholder='e.g., The Adventures of Luna'
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
            />

            <Input
              label='Story Topic'
              placeholder='e.g., friendship, adventure, learning'
              value={topic}
              onChange={e => setTopic(e.target.value)}
              required
            />

            <div className='grid grid-cols-2 gap-4'>
              <Input
                label='Target Age'
                type='number'
                min={3}
                max={12}
                value={targetAge}
                onChange={e => setTargetAge(Number(e.target.value))}
                required
              />
              <Input
                label='Number of Pages'
                type='number'
                min={2}
                max={8}
                value={pages}
                onChange={e => setPages(Number(e.target.value))}
                required
              />
            </div>

            <Select
              label='Story Tone'
              value={tone}
              onChange={e => setTone(e.target.value)}
              options={[
                { value: 'cheerful', label: 'Cheerful & Uplifting' },
                { value: 'adventurous', label: 'Adventurous & Exciting' },
                { value: 'calm', label: 'Calm & Soothing' },
                { value: 'funny', label: 'Funny & Playful' },
                { value: 'educational', label: 'Educational & Informative' },
              ]}
            />

            <div className='space-y-3'>
              <h3 className='font-semibold text-gray-900'>Accessibility Options</h3>
              <div className='grid grid-cols-1 gap-3 md:grid-cols-3'>
                <label className='flex items-center gap-3 rounded-xl border-2 border-purple-200 bg-white p-3 cursor-pointer hover:bg-purple-50'>
                  <input type='checkbox' checked={dyslexiaMode} onChange={e => setDyslexiaMode(e.target.checked)} className='h-4 w-4' />
                  <span className='text-sm font-semibold text-gray-800'>Dyslexia-friendly</span>
                </label>
                <div className='rounded-xl border-2 border-purple-200 bg-white p-3'>
                  <label className='mb-1 block text-sm font-semibold text-gray-700'>Font Scale</label>
                  <input type='range' min='0.9' max='1.4' step='0.1' value={fontScale} onChange={e => setFontScale(Number(e.target.value))} className='w-full' />
                  <div className='mt-1 text-xs text-gray-600'>Current: {fontScale.toFixed(1)}x</div>
                </div>
                <label className='flex items-center gap-3 rounded-xl border-2 border-purple-200 bg-white p-3 cursor-pointer hover:bg-purple-50'>
                  <input type='checkbox' checked={highContrast} onChange={e => setHighContrast(e.target.checked)} className='h-4 w-4' />
                  <span className='text-sm font-semibold text-gray-800'>High contrast</span>
                </label>
              </div>
            </div>

            <Button type='submit' isLoading={loading} className='w-full'>
              📚 Create My Book
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  // General preferences page (voice settings)
  return (
    <div className='mx-auto max-w-3xl'>
      <h1 className='text-4xl font-bold text-gray-900 mb-2'>⚙️ Preferences</h1>
      <p className='text-gray-600 mb-8'>Configure your voice and accessibility settings</p>

      <Card className='mb-6'>
        <h2 className='text-2xl font-bold text-gray-900 mb-4'>🔊 Voice Settings</h2>
        <p className='text-gray-600 mb-6'>
          Customize how the read-aloud feature sounds
        </p>

        <div className='space-y-5'>
          <Select
            label='Voice'
            value={String(voiceIndex)}
            onChange={e => setVoiceIndex(Number(e.target.value))}
            options={availableVoices.map((voice, index) => ({
              value: String(index),
              label: `${voice.name} (${voice.lang})`,
            }))}
          />

          <div>
            <label className='label'>Speech Rate: {voiceRate.toFixed(1)}x</label>
            <input
              type='range'
              min='0.5'
              max='2'
              step='0.1'
              value={voiceRate}
              onChange={e => setVoiceRate(Number(e.target.value))}
              className='w-full'
            />
            <div className='flex justify-between text-xs text-gray-600 mt-1'>
              <span>Slow</span>
              <span>Normal</span>
              <span>Fast</span>
            </div>
          </div>

          <div>
            <label className='label'>Pitch: {voicePitch.toFixed(1)}</label>
            <input
              type='range'
              min='0.5'
              max='2'
              step='0.1'
              value={voicePitch}
              onChange={e => setVoicePitch(Number(e.target.value))}
              className='w-full'
            />
            <div className='flex justify-between text-xs text-gray-600 mt-1'>
              <span>Low</span>
              <span>Normal</span>
              <span>High</span>
            </div>
          </div>

          <div className='flex gap-3'>
            <Button onClick={testVoice} variant='secondary' className='flex-1'>
              🔊 Test Voice
            </Button>
            <Button onClick={saveVoicePrefs} className='flex-1'>
              💾 Save Settings
            </Button>
          </div>
        </div>
      </Card>

      <Card className='bg-gradient-to-br from-purple-50 to-pink-50'>
        <h2 className='text-xl font-bold text-gray-900 mb-2'>ℹ️ About Preferences</h2>
        <p className='text-sm text-gray-700'>
          Voice settings are saved locally in your browser and will apply to all read-aloud
          buttons throughout the app. These settings are separate from book-specific
          accessibility options set during book creation.
        </p>
      </Card>
    </div>
  );
}
