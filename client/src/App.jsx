import React from 'react'
import { VideoCallProvider } from './context/VideoCallContext'
import VideoCallApp from './components/VideoCallApp'

function App() {
  return (
    <VideoCallProvider>
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
        <div className="futuristic-bg min-h-screen">
          <VideoCallApp />
        </div>
      </div>
    </VideoCallProvider>
  )
}

export default App