import React from 'react'
import { VideoCameraIcon, UserIcon } from '@heroicons/react/24/outline'

function PlaceholderVideo({ title, subtitle, isLocal = false }) {
  return (
    <div className="w-full h-full bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 25% 25%, rgba(59, 130, 246, 0.3) 0%, transparent 50%),
                           radial-gradient(circle at 75% 75%, rgba(139, 92, 246, 0.3) 0%, transparent 50%)`
        }}></div>
      </div>
      
      {/* Content */}
      <div className="text-center space-y-4 z-10">
        {/* Icon */}
        <div className="relative mx-auto">
          <div className="w-20 h-20 bg-gray-700/50 rounded-full flex items-center justify-center backdrop-blur-sm">
            {isLocal ? (
              <UserIcon className="w-10 h-10 text-gray-300" />
            ) : (
              <VideoCameraIcon className="w-10 h-10 text-gray-300" />
            )}
          </div>
          {/* Pulse effect */}
          <div className="absolute inset-0 w-20 h-20 bg-blue-500/20 rounded-full animate-ping"></div>
        </div>
        
        {/* Text */}
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-white text-shadow">
            {title}
          </h3>
          {subtitle && (
            <p className="text-sm text-gray-300 max-w-xs mx-auto">
              {subtitle}
            </p>
          )}
        </div>
        
        {/* Animated dots */}
        {title.includes('Ожидание') && (
          <div className="flex justify-center space-x-1">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce animation-delay-200"></div>
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce animation-delay-400"></div>
          </div>
        )}
      </div>
    </div>
  )
}

export default PlaceholderVideo