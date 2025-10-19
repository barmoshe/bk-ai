'use client';

import { Card } from './components/ui/Card';
import { Button } from './components/ui/Button';
import Link from 'next/link';

export default function Home() {
  const tiles = [
    {
      title: 'Create New Book',
      description: 'Start a new AI-generated children\'s book with your own character and story',
      icon: '✨',
      href: '/create',
      color: 'from-purple-500 to-pink-500',
    },
    {
      title: 'My Books',
      description: 'Browse and read all the books you\'ve created',
      icon: '📚',
      href: '/books',
      color: 'from-blue-500 to-cyan-500',
    },
    {
      title: 'View Progress',
      description: 'Track the status of books currently being generated',
      icon: '📊',
      href: '/progress',
      color: 'from-green-500 to-emerald-500',
    },
    {
      title: 'Preferences',
      description: 'Configure voice, speech, and accessibility settings',
      icon: '⚙️',
      href: '/prefs',
      color: 'from-orange-500 to-amber-500',
    },
  ];

  return (
    <div className='mx-auto max-w-6xl'>
      <div className='mb-12 text-center animate-fade-in'>
        <h1 className='mb-4 text-5xl font-bold text-gray-900'>
          Welcome to{' '}
          <span className='bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent'>
            AI Book Creator
          </span>
        </h1>
        <p className='text-xl text-gray-600 max-w-2xl mx-auto'>
          Create personalized, beautifully illustrated children's books powered by AI. 
          Design characters, craft stories, and bring your imagination to life!
        </p>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-6 mb-12'>
        {tiles.map((tile, index) => (
          <Link key={tile.href} href={tile.href}>
            <Card
              className='h-full transition-all duration-300 hover:scale-105 animate-slide-up'
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className={`inline-flex p-4 rounded-2xl bg-gradient-to-br ${tile.color} mb-4`}>
                <span className='text-4xl'>{tile.icon}</span>
              </div>
              <h2 className='text-2xl font-bold text-gray-900 mb-2'>{tile.title}</h2>
              <p className='text-gray-600'>{tile.description}</p>
            </Card>
          </Link>
        ))}
      </div>

      <div className='card bg-gradient-to-br from-purple-50 to-pink-50 border-2 border-purple-200 text-center'>
        <h3 className='text-2xl font-bold text-gray-900 mb-3'>🚀 Quick Start</h3>
        <p className='text-gray-700 mb-6 max-w-2xl mx-auto'>
          Ready to create your first book? Click below to design your character, 
          choose a story topic, and watch as AI brings it to life with beautiful illustrations!
        </p>
        <Link href='/create'>
          <Button size='lg' className='text-lg'>
            ✨ Create Your First Book
          </Button>
        </Link>
      </div>

      <div className='mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-center'>
        <div className='p-6'>
          <div className='text-4xl mb-3'>🎨</div>
          <h4 className='font-bold text-gray-900 mb-2'>AI-Powered Art</h4>
          <p className='text-sm text-gray-600'>Beautiful, consistent illustrations generated for every page</p>
        </div>
        <div className='p-6'>
          <div className='text-4xl mb-3'>📖</div>
          <h4 className='font-bold text-gray-900 mb-2'>Custom Stories</h4>
          <p className='text-sm text-gray-600'>Age-appropriate narratives tailored to your preferences</p>
        </div>
        <div className='p-6'>
          <div className='text-4xl mb-3'>🔊</div>
          <h4 className='font-bold text-gray-900 mb-2'>Read Aloud</h4>
          <p className='text-sm text-gray-600'>Built-in text-to-speech with customizable voices</p>
        </div>
      </div>
    </div>
  );
}
