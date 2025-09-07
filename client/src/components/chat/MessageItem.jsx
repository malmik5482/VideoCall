import React from 'react'

function MessageItem({ message }) {
  const isLocal = message.sender === 'local'
  
  return (
    <div className={`flex ${isLocal ? 'justify-end' : 'justify-start'} animate-slide-up`}>
      <div className={`
        max-w-[75%] rounded-2xl px-4 py-2 shadow-lg relative
        ${isLocal 
          ? 'bg-blue-500 text-white ml-8' 
          : 'bg-gray-700/80 text-gray-100 mr-8 backdrop-blur-sm'
        }
      `}>
        {/* Message bubble tail */}
        <div className={`
          absolute top-2 w-0 h-0 
          ${isLocal 
            ? 'right-[-6px] border-l-[8px] border-l-blue-500 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent' 
            : 'left-[-6px] border-r-[8px] border-r-gray-700/80 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent'
          }
        `} />
        
        {/* Sender name (for remote messages) */}
        {!isLocal && (
          <div className="text-xs text-blue-300 mb-1 font-medium">
            {message.senderName}
          </div>
        )}
        
        {/* Message text */}
        <div className="text-sm leading-relaxed break-words">
          {message.text}
        </div>
        
        {/* Timestamp */}
        <div className={`
          text-xs mt-1 opacity-75
          ${isLocal ? 'text-blue-100' : 'text-gray-400'}
        `}>
          {message.timestamp}
        </div>
        
        {/* Message status (for local messages) */}
        {isLocal && (
          <div className="absolute bottom-1 right-2 flex items-center space-x-1">
            {/* Sent indicator */}
            <svg className="w-3 h-3 text-blue-200 opacity-75" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        )}
      </div>
    </div>
  )
}

export default MessageItem