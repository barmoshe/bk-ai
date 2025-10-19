'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ImageWithFallback from './ImageWithFallback';

interface Page {
  pageIndex: number;
  text?: string;
  formatted?: { lines: string[] };
}

interface BookSliderProps {
  bookId: string;
  pages: Page[];
  title: string;
  onClose?: () => void;
  aspectRatio?: '4:3' | '3:2' | '1:1';
  printMode?: boolean;
  onTogglePrintMode?: () => void;
}

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 1000 : -1000,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 1000 : -1000,
    opacity: 0,
  }),
};

const swipeConfidenceThreshold = 10000;
const swipePower = (offset: number, velocity: number) => {
  return Math.abs(offset) * velocity;
};

export default function BookSlider({ bookId, pages, title, onClose, aspectRatio, printMode = false, onTogglePrintMode }: BookSliderProps) {
  const [[currentPage, direction], setPage] = useState([0, 0]);
  const [isDragging, setIsDragging] = useState(false);

  const pageIndex = currentPage;
  const currentPageData = pages[pageIndex];

  const paginate = useCallback((newDirection: number) => {
    const newPage = currentPage + newDirection;
    if (newPage >= 0 && newPage < pages.length) {
      setPage([newPage, newDirection]);
    }
  }, [currentPage, pages.length]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        paginate(-1);
      } else if (e.key === 'ArrowRight') {
        paginate(1);
      } else if (e.key === 'Escape' && onClose) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [paginate, onClose]);

  const canGoPrev = currentPage > 0;
  const canGoNext = currentPage < pages.length - 1;

  return (
    <div className={`fixed inset-0 ${printMode ? 'bg-white' : 'bg-gradient-to-br from-purple-900 via-pink-900 to-blue-900'} z-50 flex flex-col`}>
      {/* Header */}
      <div className={`flex items-center justify-between p-3 md:p-4 ${printMode ? 'bg-white border-b border-gray-200' : 'bg-black/20 backdrop-blur-sm'}`}>
        <div className="flex items-center gap-4">
          {onClose && (
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors p-2 rounded-lg hover:bg-white/10"
              aria-label="Close preview"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <h2 className={`${printMode ? 'text-gray-800' : 'text-white'} text-lg font-semibold`}>{title}</h2>
        </div>
        <div className="flex items-center gap-3">
          <div className={`${printMode ? 'text-gray-600' : 'text-white/80'} text-sm font-medium`}>
            Page {currentPage + 1} of {pages.length}
          </div>
          <button
            onClick={onTogglePrintMode}
            className={`${printMode ? 'text-gray-700 border-gray-300' : 'text-white border-white/40'} text-xs font-medium px-3 py-1 rounded-lg border`}
            aria-pressed={printMode}
            aria-label="Toggle print view"
          >
            {printMode ? 'Print View' : 'Web View'}
          </button>
        </div>
      </div>

      {/* Slider Container */}
      <div className="flex-1 relative overflow-hidden flex flex-col items-center justify-center px-2 md:px-6 gap-0">
        {/* Previous Button */}
        <button
          onClick={() => paginate(-1)}
          disabled={!canGoPrev}
          className={`absolute left-4 top-1/2 -translate-y-1/2 z-20 p-4 md:p-5 rounded-full ${printMode ? 'bg-gray-100 border' : 'bg-white/90 backdrop-blur-sm shadow-xl'} transition-all duration-200 ${canGoPrev ? 'hover:scale-110 cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}
          aria-label="Previous page"
        >
          <svg className={`w-8 h-8 md:w-10 md:h-10 ${printMode ? 'text-gray-700' : 'text-purple-700'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Page Content */}
        <div className="relative w-full h-full flex items-center justify-center px-0 md:px-2">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={currentPage}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: 'spring', stiffness: 300, damping: 30 },
                opacity: { duration: 0.2 },
              }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={1}
              onDragStart={() => setIsDragging(true)}
              onDragEnd={(e, { offset, velocity }) => {
                setIsDragging(false);
                const swipe = swipePower(offset.x, velocity.x);

                if (swipe < -swipeConfidenceThreshold && canGoNext) {
                  paginate(1);
                } else if (swipe > swipeConfidenceThreshold && canGoPrev) {
                  paginate(-1);
                }
              }}
              className="absolute w-full h-full flex flex-col items-center justify-center"
            >
              <div className="w-full h-full flex items-center justify-center max-w-6xl mx-auto">
                <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-white w-full h-full">
                  <ImageWithFallback
                    src={`/data/${bookId}/pages/${currentPageData.pageIndex}/page-print.jpg`}
                    fallbackSrc={`/data/${bookId}/pages/${currentPageData.pageIndex}/page.jpg`}
                    alt={`Page ${currentPageData.pageIndex}`}
                    className="w-full h-full"
                    objectFit="contain"
                    aspectRatio={aspectRatio ? (aspectRatio === '4:3' ? '4 / 3' : aspectRatio === '3:2' ? '3 / 2' : '1 / 1') : undefined}
                    sizes="(max-width: 768px) 100vw, 80vw"
                  />
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Next Button */}
        <button
          onClick={() => paginate(1)}
          disabled={!canGoNext}
          className={`absolute right-4 top-1/2 -translate-y-1/2 z-20 p-4 md:p-5 rounded-full ${printMode ? 'bg-gray-100 border' : 'bg-white/90 backdrop-blur-sm shadow-xl'} transition-all duration-200 ${canGoNext ? 'hover:scale-110 cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}
          aria-label="Next page"
        >
          <svg className={`w-8 h-8 md:w-10 md:h-10 ${printMode ? 'text-gray-700' : 'text-purple-700'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Progress Indicator */}
      <div className={`p-4 ${printMode ? 'bg-white border-t border-gray-200' : 'bg-black/20 backdrop-blur-sm'}`}>
        <div className="max-w-5xl mx-auto">
          <div className="h-2 bg-white/20 rounded-full overflow-hidden">
            <motion.div
              className={`h-full ${printMode ? 'bg-gray-400' : 'bg-gradient-to-r from-purple-400 to-pink-400'}`}
              initial={{ width: 0 }}
              animate={{ width: `${((currentPage + 1) / pages.length) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

