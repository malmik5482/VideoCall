import React, { useState, useRef, useEffect } from 'react';

interface VideoCallProps {
  className?: string;
}

const VideoCall: React.FC<VideoCallProps> = ({ className }) => {
  const [isCallActive, setIsCallActive] = useState<boolean>(false);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);
  const [isVideoOff, setIsVideoOff] = useState<boolean>(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    return () => {
      // Очистка при размонтировании компонента
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startCall = async () => {
    try {
      // Получаем доступ к камере и микрофону
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true, 
        audio: true 
      });
      
      localStreamRef.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      setIsCallActive(true);
    } catch (error) {
      console.error('Ошибка при получении медиа-устройств:', error);
    }
  };

  const stopCall = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = null;
    }
    
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = null;
    }
    
    setIsCallActive(false);
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsAudioMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  return (
    <div className={`video-call ${className || ''}`} style={styles.container}>
      <div style={styles.videoContainer}>
        {/* Локальное видео */}
        <div style={styles.localVideo}>
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            style={styles.video}
          />
          <div style={styles.videoLabel}>Я</div>
        </div>
        
        {/* Удаленное видео */}
        <div style={styles.remoteVideo}>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            style={styles.video}
          />
          <div style={styles.videoLabel}>Собеседник</div>
        </div>
      </div>
      
      {/* Панель управления */}
      <div style={styles.controls}>
        <button
          onClick={isCallActive ? stopCall : startCall}
          style={{
            ...styles.button,
            ...(isCallActive ? styles.stopButton : styles.startButton)
          }}
        >
          {isCallActive ? '🔴 Завершить звонок' : '📹 Начать звонок'}
        </button>
        
        {isCallActive && (
          <div style={styles.mediaControls}>
            <button
              onClick={toggleAudio}
              style={{
                ...styles.button,
                ...styles.mediaButton,
                backgroundColor: isAudioMuted ? '#ff4757' : '#5f27cd'
              }}
            >
              {isAudioMuted ? '🔇' : '🎤'}
            </button>
            
            <button
              onClick={toggleVideo}
              style={{
                ...styles.button,
                ...styles.mediaButton,
                backgroundColor: isVideoOff ? '#ff4757' : '#5f27cd'
              }}
            >
              {isVideoOff ? '📹' : '🎥'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Стили компонента
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '20px',
    padding: '20px',
    fontFamily: 'Arial, sans-serif'
  },
  videoContainer: {
    display: 'flex',
    gap: '20px',
    flexWrap: 'wrap' as const,
    justifyContent: 'center'
  },
  localVideo: {
    position: 'relative' as const,
    borderRadius: '10px',
    overflow: 'hidden',
    boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
  },
  remoteVideo: {
    position: 'relative' as const,
    borderRadius: '10px',
    overflow: 'hidden',
    boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
  },
  video: {
    width: '320px',
    height: '240px',
    backgroundColor: '#000',
    objectFit: 'cover' as const
  },
  videoLabel: {
    position: 'absolute' as const,
    bottom: '10px',
    left: '10px',
    color: 'white',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: '5px 10px',
    borderRadius: '15px',
    fontSize: '12px'
  },
  controls: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: '15px'
  },
  button: {
    padding: '12px 24px',
    border: 'none',
    borderRadius: '25px',
    fontSize: '16px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    outline: 'none'
  },
  startButton: {
    backgroundColor: '#2ed573',
    color: 'white'
  },
  stopButton: {
    backgroundColor: '#ff4757',
    color: 'white'
  },
  mediaControls: {
    display: 'flex',
    gap: '15px'
  },
  mediaButton: {
    padding: '10px',
    borderRadius: '50%',
    fontSize: '20px',
    width: '50px',
    height: '50px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  }
};

export default VideoCall;
