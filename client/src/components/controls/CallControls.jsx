import React from 'react'
import { 
  PhoneIcon,
  PhoneXMarkIcon,
  MicrophoneIcon,
  VideoCameraIcon,
  VideoCameraSlashIcon,
  ChatBubbleLeftRightIcon,
  SpeakerWaveIcon,
  CogIcon
} from '@heroicons/react/24/solid'
import { MicrophoneIcon as MicrophoneOffIcon } from '@heroicons/react/24/outline'
import { useVideoCall } from '../../context/VideoCallContext'

function CallControls({ onToggleChat, isChatOpen }) {
  const { 
    isCallActive, 
    isMuted, 
    isVideoOff, 
    startCall, 
    endCall, 
    toggleMute, 
    toggleVideo,
    isConnected 
  } = useVideoCall()

  const controlButtons = [
    {
      id: 'mute',
      icon: isMuted ? MicrophoneOffIcon : MicrophoneIcon,
      active: !isMuted,
      onClick: toggleMute,
      label: isMuted ? 'Включить микрофон' : 'Выключить микрофон',
      disabled: !isCallActive,
      className: isMuted ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-600/80 hover:bg-gray-500'
    },
    {
      id: 'video',
      icon: isVideoOff ? VideoCameraSlashIcon : VideoCameraIcon,
      active: !isVideoOff,
      onClick: toggleVideo,
      label: isVideoOff ? 'Включить видео' : 'Выключить видео',
      disabled: !isCallActive,
      className: isVideoOff ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-600/80 hover:bg-gray-500'
    },
    {
      id: 'speaker',
      icon: SpeakerWaveIcon,
      active: true,
      onClick: () => {},
      label: 'Настройки звука',
      disabled: false,
      className: 'bg-gray-600/80 hover:bg-gray-500'
    },
    {
      id: 'chat',
      icon: ChatBubbleLeftRightIcon,
      active: isChatOpen,
      onClick: onToggleChat,
      label: 'Чат',
      disabled: false,
      className: isChatOpen ? 'bg-blue-500 hover:bg-blue-600' : 'bg-gray-600/80 hover:bg-gray-500'
    },
    {
      id: 'settings',
      icon: CogIcon,
      active: false,
      onClick: () => {},
      label: 'Настройки',
      disabled: false,
      className: 'bg-gray-600/80 hover:bg-gray-500'
    }
  ]

  return (
    <div className="flex justify-center items-center space-x-4">
      {/* Control Buttons */}
      <div className="flex items-center space-x-3 bg-black/30 backdrop-blur-lg rounded-2xl px-6 py-4 border border-white/10">
        {controlButtons.map((button) => {
          const Icon = button.icon
          return (
            <button
              key={button.id}
              onClick={button.onClick}
              disabled={button.disabled}
              className={`
                control-button ${button.className}
                ${button.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110 active:scale-95'}
                transition-all duration-200 backdrop-blur-sm
              `}
              title={button.label}
            >
              <Icon className="w-6 h-6 text-white" />
            </button>
          )
        })}
      </div>

      {/* Main Call Button */}
      <div className="flex items-center">
        {!isCallActive ? (
          <button
            onClick={startCall}
            disabled={!isConnected}
            className={`
              flex items-center justify-center w-16 h-16 rounded-full 
              bg-green-500 hover:bg-green-600 text-white shadow-2xl
              transition-all duration-300 hover:scale-110 active:scale-95
              ${!isConnected ? 'opacity-50 cursor-not-allowed' : 'animate-pulse-slow'}
            `}
            title="Начать звонок"
          >
            <PhoneIcon className="w-8 h-8" />
          </button>
        ) : (
          <button
            onClick={endCall}
            className="
              flex items-center justify-center w-16 h-16 rounded-full 
              bg-red-500 hover:bg-red-600 text-white shadow-2xl
              transition-all duration-300 hover:scale-110 active:scale-95
            "
            title="Завершить звонок"
          >
            <PhoneXMarkIcon className="w-8 h-8" />
          </button>
        )}
      </div>

      {/* Mobile responsive - hide some buttons on small screens */}
      <style jsx>{`
        @media (max-width: 640px) {
          .control-button:nth-child(n+4) {
            display: none;
          }
        }
      `}</style>
    </div>
  )
}

export default CallControls