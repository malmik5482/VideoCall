import React, { useState, useRef, useEffect } from 'react'
import { 
  XMarkIcon,
  PaperAirplaneIcon,
  ChatBubbleLeftRightIcon
} from '@heroicons/react/24/solid'
import { useVideoCall } from '../../context/VideoCallContext'
import MessageItem from './MessageItem'

function ChatPanel({ isOpen, onClose }) {
  const [message, setMessage] = useState('')
  const { messages, sendMessage, isConnected } = useVideoCall()
  const messagesEndRef = useRef(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = (e) => {
    e.preventDefault()
    if (message.trim() && isConnected) {
      sendMessage(message.trim())
      setMessage('')
    }
  }

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Chat Panel */}
      <div className={`
        fixed right-0 top-0 h-full w-80 bg-gray-900/95 backdrop-blur-xl border-l border-gray-700/50
        transform transition-transform duration-300 ease-in-out z-50
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        md:static md:w-80 md:bg-gray-900/80 md:border-l md:border-gray-700/30
      `}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700/50 bg-black/20">
          <div className="flex items-center space-x-2">
            <ChatBubbleLeftRightIcon className="w-5 h-5 text-blue-400" />
            <h3 className="font-semibold text-white">Чат</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700/50 rounded-lg transition-colors md:hidden"
          >
            <XMarkIcon className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 h-[calc(100vh-140px)]">
          {messages.length === 0 ? (
            <div className="text-center text-gray-400 mt-8">
              <ChatBubbleLeftRightIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Пока сообщений нет</p>
              <p className="text-xs mt-1">Начните общение!</p>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <MessageItem key={msg.id} message={msg} />
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-700/50 bg-black/20">
          <form onSubmit={handleSendMessage} className="flex space-x-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={isConnected ? "Напишите сообщение..." : "Нет подключения"}
              disabled={!isConnected}
              className="
                flex-1 bg-gray-800/80 border border-gray-600/50 rounded-lg px-3 py-2
                text-white placeholder-gray-400 focus:outline-none focus:ring-2 
                focus:ring-blue-500 focus:border-transparent transition-all
                disabled:opacity-50 disabled:cursor-not-allowed
              "
              maxLength={500}
            />
            <button
              type="submit"
              disabled={!message.trim() || !isConnected}
              className="
                p-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-600
                disabled:cursor-not-allowed rounded-lg transition-colors
                flex items-center justify-center min-w-[40px]
              "
            >
              <PaperAirplaneIcon className="w-5 h-5 text-white" />
            </button>
          </form>
          
          {/* Character count */}
          <div className="flex justify-between items-center mt-2 text-xs text-gray-500">
            <span>
              {isConnected ? 'Подключено' : 'Отключено'}
            </span>
            <span>
              {message.length}/500
            </span>
          </div>
        </div>
      </div>
    </>
  )
}

export default ChatPanel