import React from 'react'
import { 
  CheckCircleIcon, 
  ExclamationTriangleIcon, 
  XCircleIcon,
  ArrowPathIcon 
} from '@heroicons/react/24/solid'

function ConnectionStatus({ status }) {
  const statusConfig = {
    connected: {
      icon: CheckCircleIcon,
      color: 'text-green-400',
      bgColor: 'bg-green-400/10',
      borderColor: 'border-green-400/20',
      message: 'Подключено'
    },
    connecting: {
      icon: ArrowPathIcon,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-400/10',
      borderColor: 'border-yellow-400/20',
      message: 'Подключение...',
      animate: 'animate-spin'
    },
    disconnected: {
      icon: ExclamationTriangleIcon,
      color: 'text-gray-400',
      bgColor: 'bg-gray-400/10',
      borderColor: 'border-gray-400/20',
      message: 'Отключено'
    },
    failed: {
      icon: XCircleIcon,
      color: 'text-red-400',
      bgColor: 'bg-red-400/10',
      borderColor: 'border-red-400/20',
      message: 'Ошибка подключения'
    }
  }

  const config = statusConfig[status] || statusConfig.disconnected
  const Icon = config.icon

  if (status === 'connected') {
    return null // Don't show when connected
  }

  return (
    <div className={`mx-4 mt-2 p-3 rounded-lg border ${config.bgColor} ${config.borderColor} glass-effect`}>
      <div className="flex items-center space-x-3">
        <Icon className={`w-5 h-5 ${config.color} ${config.animate || ''}`} />
        <span className={`text-sm font-medium ${config.color}`}>
          {config.message}
        </span>
      </div>
    </div>
  )
}

export default ConnectionStatus