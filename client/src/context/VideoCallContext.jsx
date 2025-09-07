import React, { createContext, useContext, useReducer, useEffect, useRef } from 'react'

// Initial state
const initialState = {
  isConnected: false,
  isCallActive: false,
  localStream: null,
  remoteStream: null,
  isMuted: false,
  isVideoOff: false,
  messages: [],
  connectionStatus: 'disconnected', // disconnected, connecting, connected, failed
  participants: 0,
}

// Action types
const ActionTypes = {
  SET_CONNECTED: 'SET_CONNECTED',
  SET_CALL_ACTIVE: 'SET_CALL_ACTIVE',
  SET_LOCAL_STREAM: 'SET_LOCAL_STREAM',
  SET_REMOTE_STREAM: 'SET_REMOTE_STREAM',
  TOGGLE_MUTE: 'TOGGLE_MUTE',
  TOGGLE_VIDEO: 'TOGGLE_VIDEO',
  ADD_MESSAGE: 'ADD_MESSAGE',
  SET_CONNECTION_STATUS: 'SET_CONNECTION_STATUS',
  SET_PARTICIPANTS: 'SET_PARTICIPANTS',
  RESET_CALL: 'RESET_CALL',
}

// Reducer
function videoCallReducer(state, action) {
  switch (action.type) {
    case ActionTypes.SET_CONNECTED:
      return { ...state, isConnected: action.payload }
    case ActionTypes.SET_CALL_ACTIVE:
      return { ...state, isCallActive: action.payload }
    case ActionTypes.SET_LOCAL_STREAM:
      return { ...state, localStream: action.payload }
    case ActionTypes.SET_REMOTE_STREAM:
      return { ...state, remoteStream: action.payload }
    case ActionTypes.TOGGLE_MUTE:
      return { ...state, isMuted: !state.isMuted }
    case ActionTypes.TOGGLE_VIDEO:
      return { ...state, isVideoOff: !state.isVideoOff }
    case ActionTypes.ADD_MESSAGE:
      return { 
        ...state, 
        messages: [...state.messages, { 
          id: Date.now(), 
          ...action.payload,
          timestamp: new Date().toLocaleTimeString()
        }] 
      }
    case ActionTypes.SET_CONNECTION_STATUS:
      return { ...state, connectionStatus: action.payload }
    case ActionTypes.SET_PARTICIPANTS:
      return { ...state, participants: action.payload }
    case ActionTypes.RESET_CALL:
      return {
        ...initialState,
        isConnected: state.isConnected,
        messages: state.messages,
      }
    default:
      return state
  }
}

// Context
const VideoCallContext = createContext()

// Provider component
export function VideoCallProvider({ children }) {
  const [state, dispatch] = useReducer(videoCallReducer, initialState)
  
  // WebRTC refs
  const peerConnectionRef = useRef(null)
  const websocketRef = useRef(null)
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  
  // WebRTC configuration
  const rtcConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  }

  // WebSocket connection
  const connectWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/ws`
    
    websocketRef.current = new WebSocket(wsUrl)
    
    websocketRef.current.onopen = () => {
      dispatch({ type: ActionTypes.SET_CONNECTED, payload: true })
      dispatch({ type: ActionTypes.SET_CONNECTION_STATUS, payload: 'connected' })
    }
    
    websocketRef.current.onmessage = async (event) => {
      const message = JSON.parse(event.data)
      
      switch (message.type) {
        case 'offer':
          await handleOffer(message.offer)
          break
        case 'answer':
          await handleAnswer(message.answer)
          break
        case 'ice-candidate':
          await handleIceCandidate(message.candidate)
          break
        case 'chat':
          dispatch({ 
            type: ActionTypes.ADD_MESSAGE, 
            payload: { 
              text: message.text, 
              sender: 'remote',
              senderName: 'Собеседник'
            } 
          })
          break
        case 'ready':
          dispatch({ type: ActionTypes.SET_PARTICIPANTS, payload: 2 })
          break
        case 'peer-left':
          handlePeerLeft()
          break
      }
    }
    
    websocketRef.current.onclose = () => {
      dispatch({ type: ActionTypes.SET_CONNECTED, payload: false })
      dispatch({ type: ActionTypes.SET_CONNECTION_STATUS, payload: 'disconnected' })
    }
    
    websocketRef.current.onerror = () => {
      dispatch({ type: ActionTypes.SET_CONNECTION_STATUS, payload: 'failed' })
    }
  }

  // Get user media
  const getUserMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true
      })
      
      dispatch({ type: ActionTypes.SET_LOCAL_STREAM, payload: stream })
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream
      }
      
      return stream
    } catch (error) {
      console.error('Error accessing media devices:', error)
      throw error
    }
  }

  // Create peer connection
  const createPeerConnection = () => {
    peerConnectionRef.current = new RTCPeerConnection(rtcConfiguration)
    
    peerConnectionRef.current.ontrack = (event) => {
      dispatch({ type: ActionTypes.SET_REMOTE_STREAM, payload: event.streams[0] })
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0]
      }
    }
    
    peerConnectionRef.current.onicecandidate = (event) => {
      if (event.candidate && websocketRef.current.readyState === WebSocket.OPEN) {
        websocketRef.current.send(JSON.stringify({
          type: 'ice-candidate',
          candidate: event.candidate
        }))
      }
    }
    
    peerConnectionRef.current.onconnectionstatechange = () => {
      const connectionState = peerConnectionRef.current.connectionState
      if (connectionState === 'connected') {
        dispatch({ type: ActionTypes.SET_CALL_ACTIVE, payload: true })
      } else if (connectionState === 'disconnected' || connectionState === 'failed') {
        dispatch({ type: ActionTypes.SET_CALL_ACTIVE, payload: false })
      }
    }
  }

  // WebRTC handlers
  const handleOffer = async (offer) => {
    if (!peerConnectionRef.current) {
      createPeerConnection()
    }
    
    if (state.localStream) {
      state.localStream.getTracks().forEach(track => {
        peerConnectionRef.current.addTrack(track, state.localStream)
      })
    }
    
    await peerConnectionRef.current.setRemoteDescription(offer)
    const answer = await peerConnectionRef.current.createAnswer()
    await peerConnectionRef.current.setLocalDescription(answer)
    
    websocketRef.current.send(JSON.stringify({
      type: 'answer',
      answer: answer
    }))
  }

  const handleAnswer = async (answer) => {
    await peerConnectionRef.current.setRemoteDescription(answer)
  }

  const handleIceCandidate = async (candidate) => {
    await peerConnectionRef.current.addIceCandidate(candidate)
  }

  const handlePeerLeft = () => {
    dispatch({ type: ActionTypes.RESET_CALL })
    dispatch({ type: ActionTypes.SET_PARTICIPANTS, payload: 1 })
  }

  // Public API
  const startCall = async () => {
    try {
      const stream = await getUserMedia()
      createPeerConnection()
      
      stream.getTracks().forEach(track => {
        peerConnectionRef.current.addTrack(track, stream)
      })
      
      const offer = await peerConnectionRef.current.createOffer()
      await peerConnectionRef.current.setLocalDescription(offer)
      
      websocketRef.current.send(JSON.stringify({
        type: 'offer',
        offer: offer
      }))
      
    } catch (error) {
      console.error('Error starting call:', error)
    }
  }

  const endCall = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close()
      peerConnectionRef.current = null
    }
    
    if (state.localStream) {
      state.localStream.getTracks().forEach(track => track.stop())
    }
    
    dispatch({ type: ActionTypes.RESET_CALL })
  }

  const toggleMute = () => {
    if (state.localStream) {
      const audioTrack = state.localStream.getAudioTracks()[0]
      if (audioTrack) {
        audioTrack.enabled = state.isMuted
        dispatch({ type: ActionTypes.TOGGLE_MUTE })
      }
    }
  }

  const toggleVideo = () => {
    if (state.localStream) {
      const videoTrack = state.localStream.getVideoTracks()[0]
      if (videoTrack) {
        videoTrack.enabled = state.isVideoOff
        dispatch({ type: ActionTypes.TOGGLE_VIDEO })
      }
    }
  }

  const sendMessage = (text) => {
    const message = {
      type: 'chat',
      text: text
    }
    
    websocketRef.current.send(JSON.stringify(message))
    
    dispatch({ 
      type: ActionTypes.ADD_MESSAGE, 
      payload: { 
        text: text, 
        sender: 'local',
        senderName: 'Вы'
      } 
    })
  }

  // Initialize connection on mount
  useEffect(() => {
    connectWebSocket()
    
    return () => {
      if (websocketRef.current) {
        websocketRef.current.close()
      }
      endCall()
    }
  }, [])

  const value = {
    ...state,
    startCall,
    endCall,
    toggleMute,
    toggleVideo,
    sendMessage,
    localVideoRef,
    remoteVideoRef,
  }

  return (
    <VideoCallContext.Provider value={value}>
      {children}
    </VideoCallContext.Provider>
  )
}

// Hook to use the context
export function useVideoCall() {
  const context = useContext(VideoCallContext)
  if (!context) {
    throw new Error('useVideoCall must be used within a VideoCallProvider')
  }
  return context
}