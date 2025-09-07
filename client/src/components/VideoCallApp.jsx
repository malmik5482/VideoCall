import React, { useState } from 'react'
import { useVideoCall } from '../context/VideoCallContext'
import VideoContainer from './video/VideoContainer'
import CallControls from './controls/CallControls'
import ChatPanel from './chat/ChatPanel'
import ConnectionStatus from './common/ConnectionStatus'
import Header from './common/Header'

function VideoCallApp() {
  const [isChatOpen, setIsChatOpen] = useState(false)
  const { isConnected, isCallActive, connectionStatus } = useVideoCall()

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <Header />
      
      {/* Connection Status */}
      <ConnectionStatus status={connectionStatus} />
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video Area */}
        <div className={`flex-1 flex flex-col transition-all duration-300 ${
          isChatOpen ? 'md:mr-80' : ''
        }`}>
          {/* Video Container */}
          <div className="flex-1 p-4">
            <VideoContainer />
          </div>
          
          {/* Call Controls */}
          <div className="p-4 pb-6">
            <CallControls 
              onToggleChat={() => setIsChatOpen(!isChatOpen)}
              isChatOpen={isChatOpen}
            />
          </div>
        </div>
        
        {/* Chat Panel */}
        <ChatPanel 
          isOpen={isChatOpen} 
          onClose={() => setIsChatOpen(false)}
        />
      </div>
    </div>
  )
}

export default VideoCallApp