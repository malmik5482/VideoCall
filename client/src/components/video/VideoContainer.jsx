import React from 'react'
import { useVideoCall } from '../../context/VideoCallContext'
import VideoPlayer from './VideoPlayer'
import PlaceholderVideo from './PlaceholderVideo'

function VideoContainer() {
  const { 
    localStream, 
    remoteStream, 
    localVideoRef, 
    remoteVideoRef, 
    isCallActive 
  } = useVideoCall()

  return (
    <div className="h-full flex flex-col lg:flex-row gap-4">
      {/* Remote Video (Main) */}
      <div className="flex-1 relative">
        <div className="video-container h-full min-h-[300px] lg:min-h-[400px]">
          {remoteStream ? (
            <VideoPlayer
              ref={remoteVideoRef}
              stream={remoteStream}
              isLocal={false}
              className="w-full h-full object-cover"
              label="Собеседник"
            />
          ) : (
            <PlaceholderVideo
              title={isCallActive ? "Ожидание собеседника..." : "Готов к звонку"}
              subtitle={isCallActive ? 
                "Подключение к собеседнику" : 
                "Нажмите кнопку для начала звонка"
              }
            />
          )}
          
          {/* Call Status Overlay */}
          {isCallActive && !remoteStream && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <p className="text-white font-medium">Установка соединения...</p>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Local Video (Picture-in-Picture) */}
      <div className="w-full lg:w-80 relative">
        <div className="video-container h-48 lg:h-60">
          {localStream ? (
            <VideoPlayer
              ref={localVideoRef}
              stream={localStream}
              isLocal={true}
              muted={true}
              className="w-full h-full object-cover"
              label="Вы"
            />
          ) : (
            <PlaceholderVideo
              title="Ваше видео"
              subtitle="Камера отключена"
              isLocal={true}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default VideoContainer