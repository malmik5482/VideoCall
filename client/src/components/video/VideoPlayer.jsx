import React, { forwardRef, useEffect } from 'react'
import { useVideoCall } from '../../context/VideoCallContext'

const VideoPlayer = forwardRef(({ 
  stream, 
  isLocal = false, 
  muted = false, 
  className = '', 
  label 
}, ref) => {
  const { isMuted, isVideoOff } = useVideoCall()

  useEffect(() => {
    if (ref?.current && stream) {
      ref.current.srcObject = stream
    }
  }, [stream, ref])

  return (
    <div className="relative w-full h-full group">
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={muted || (isLocal && isMuted)}
        className={`${className} transition-all duration-300 ${
          isLocal && isVideoOff ? 'opacity-0' : 'opacity-100'
        }`}
      />
      
      {/* Video Off Overlay (for local video) */}
      {isLocal && isVideoOff && (
        <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center mx-auto">
              <span className="text-2xl">👤</span>
            </div>
            <p className="text-gray-300 text-sm">Видео отключено</p>
          </div>
        </div>
      )}
      
      {/* Muted Indicator */}
      {isLocal && isMuted && (
        <div className="absolute top-3 left-3 bg-red-500 rounded-full p-2 shadow-lg">
          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.797L4.383 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.383l4-3.797zm7.617 2.924a1 1 0 011 1v6a1 1 0 11-2 0V7a1 1 0 011-1zM5 8v4H3V8h2z" clipRule="evenodd" />
            <path d="M15.293 6.293a1 1 0 011.414 0L18 7.586l1.293-1.293a1 1 0 111.414 1.414L19.414 9l1.293 1.293a1 1 0 01-1.414 1.414L18 10.414l-1.293 1.293a1 1 0 01-1.414-1.414L16.586 9l-1.293-1.293a1 1 0 010-1.414z" />
          </svg>
        </div>
      )}
      
      {/* Label */}
      <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm rounded-lg px-3 py-1">
        <span className="text-white text-sm font-medium">{label}</span>
      </div>
      
      {/* Connection Quality Indicator */}
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex space-x-1">
          <div className="w-1 h-3 bg-green-400 rounded"></div>
          <div className="w-1 h-4 bg-green-400 rounded"></div>
          <div className="w-1 h-5 bg-green-400 rounded"></div>
        </div>
      </div>
    </div>
  )
})

VideoPlayer.displayName = 'VideoPlayer'

export default VideoPlayer