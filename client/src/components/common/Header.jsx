import React from 'react'
import { VideoCameraIcon } from '@heroicons/react/24/solid'

function Header() {
  return (
    <header className="bg-black/20 backdrop-blur-md border-b border-white/10">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600 rounded-lg shadow-lg">
              <VideoCameraIcon className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">VideoCall</h1>
              <p className="text-xs text-gray-300">Secure Video Communication</p>
            </div>
          </div>
          
          {/* Status Indicator */}
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-300 hidden md:inline">Online</span>
          </div>
        </div>
      </div>
    </header>
  )
}

export default Header