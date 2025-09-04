// ========== TURN SERVER DIAGNOSTICS ==========
// Детальная диагностика TURN сервера для российских мобильных сетей

class TurnDiagnostics {
  constructor() {
    this.turnServer = '94.198.218.189';
    this.turnPort = 3478;
    this.username = 'webrtc';
    this.credential = 'pRr45XBJgdff9Z2Q4EdTLwOUyqudQjtN';
    
    this.diagnostics = {
      turnReachable: false,
      stunWorking: false,
      relayCapable: false,
      latencyMs: 999,
      throughputKbps: 0,
      packetLoss: 100,
      errorDetails: []
    };
  }

  // Основная функция диагностики TURN сервера
  async performCompleteTurnDiagnostics() {
    console.log('🔍 Starting comprehensive TURN diagnostics...');
    
    const results = {
      timestamp: Date.now(),
      server: `${this.turnServer}:${this.turnPort}`,
      tests: {}
    };

    try {
      // 1. Базовая проверка достижимости
      results.tests.connectivity = await this.testTurnConnectivity();
      
      // 2. Проверка STUN функциональности
      results.tests.stun = await this.testStunFunctionality();
      
      // 3. Проверка TURN relay
      results.tests.relay = await this.testTurnRelay();
      
      // 4. Измерение latency
      results.tests.latency = await this.measureTurnLatency();
      
      // 5. Тест пропускной способности
      results.tests.throughput = await this.testTurnThroughput();
      
      // 6. Проверка различных транспортов
      results.tests.transports = await this.testTransportMethods();
      
      // Общий анализ
      results.analysis = this.analyzeTurnPerformance(results.tests);
      
      console.log('✅ TURN diagnostics completed:', results);
      return results;
      
    } catch (error) {
      console.error('❌ TURN diagnostics failed:', error);
      results.error = error.message;
      return results;
    }
  }

  // Проверка базовой достижимости TURN сервера
  async testTurnConnectivity() {
    console.log('🌐 Testing TURN connectivity...');
    
    const config = {
      iceServers: [{
        urls: `turn:${this.turnServer}:${this.turnPort}?transport=udp`,
        username: this.username,
        credential: this.credential
      }]
    };

    try {
      const pc = new RTCPeerConnection(config);
      const startTime = Date.now();
      
      return new Promise((resolve) => {
        let resolved = false;
        
        const timeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            pc.close();
            resolve({
              success: false,
              error: 'Connection timeout after 10 seconds',
              duration: Date.now() - startTime
            });
          }
        }, 10000);

        pc.oniceconnectionstatechange = () => {
          const state = pc.iceConnectionState;
          console.log(`ICE connection state: ${state}`);
          
          if (!resolved && (state === 'connected' || state === 'completed')) {
            resolved = true;
            clearTimeout(timeout);
            pc.close();
            resolve({
              success: true,
              state: state,
              duration: Date.now() - startTime
            });
          } else if (!resolved && state === 'failed') {
            resolved = true;
            clearTimeout(timeout);
            pc.close();
            resolve({
              success: false,
              error: 'ICE connection failed',
              duration: Date.now() - startTime
            });
          }
        };

        pc.createDataChannel('test');
        pc.createOffer().then(offer => pc.setLocalDescription(offer));
      });
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Проверка STUN функциональности
  async testStunFunctionality() {
    console.log('🎯 Testing STUN functionality...');
    
    const stunServers = [
      `stun:${this.turnServer}:${this.turnPort}`,
      'stun:stun.l.google.com:19302',
      'stun:stun.sipnet.ru:3478'
    ];

    const results = [];
    
    for (const stunUrl of stunServers) {
      try {
        const result = await this.testSingleStunServer(stunUrl);
        results.push({ server: stunUrl, ...result });
      } catch (error) {
        results.push({ 
          server: stunUrl, 
          success: false, 
          error: error.message 
        });
      }
    }
    
    return {
      servers: results,
      workingCount: results.filter(r => r.success).length,
      totalCount: results.length
    };
  }

  // Тест одного STUN сервера
  async testSingleStunServer(stunUrl) {
    const config = {
      iceServers: [{ urls: stunUrl }]
    };

    const pc = new RTCPeerConnection(config);
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      let candidatesReceived = 0;
      let resolved = false;
      
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          pc.close();
          resolve({
            success: candidatesReceived > 0,
            candidates: candidatesReceived,
            duration: Date.now() - startTime
          });
        }
      }, 5000);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          candidatesReceived++;
          console.log(`STUN candidate from ${stunUrl}:`, event.candidate.candidate);
        } else if (!resolved) {
          // Gathering completed
          resolved = true;
          clearTimeout(timeout);
          pc.close();
          resolve({
            success: candidatesReceived > 0,
            candidates: candidatesReceived,
            duration: Date.now() - startTime
          });
        }
      };

      pc.createDataChannel('stun-test');
      pc.createOffer().then(offer => pc.setLocalDescription(offer));
    });
  }

  // Проверка TURN relay функциональности
  async testTurnRelay() {
    console.log('🔄 Testing TURN relay functionality...');
    
    const config = {
      iceServers: [{
        urls: [
          `turn:${this.turnServer}:${this.turnPort}?transport=udp`,
          `turn:${this.turnServer}:${this.turnPort}?transport=tcp`
        ],
        username: this.username,
        credential: this.credential
      }],
      iceTransportPolicy: 'relay' // Force TURN usage
    };

    const pc = new RTCPeerConnection(config);
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      let relayCandidates = [];
      let resolved = false;
      
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          pc.close();
          resolve({
            success: relayCandidates.length > 0,
            candidates: relayCandidates,
            count: relayCandidates.length,
            duration: Date.now() - startTime,
            error: relayCandidates.length === 0 ? 'No relay candidates received' : null
          });
        }
      }, 15000); // Больше времени для TURN

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          const candidate = event.candidate.candidate;
          console.log('TURN candidate:', candidate);
          
          if (candidate.includes('relay') || candidate.includes('turn')) {
            relayCandidates.push(candidate);
            console.log(`✅ TURN relay candidate found: ${candidate}`);
          }
        } else if (!resolved) {
          // Gathering completed
          resolved = true;
          clearTimeout(timeout);
          pc.close();
          resolve({
            success: relayCandidates.length > 0,
            candidates: relayCandidates,
            count: relayCandidates.length,
            duration: Date.now() - startTime
          });
        }
      };

      pc.createDataChannel('relay-test');
      pc.createOffer().then(offer => pc.setLocalDescription(offer));
    });
  }

  // Измерение latency к TURN серверу
  async measureTurnLatency() {
    console.log('⏱️ Measuring TURN latency...');
    
    const measurements = [];
    const attempts = 5;
    
    for (let i = 0; i < attempts; i++) {
      try {
        const startTime = performance.now();
        
        // Используем WebSocket для быстрого теста latency
        const result = await this.singleLatencyMeasurement();
        const latency = performance.now() - startTime;
        
        measurements.push(latency);
        console.log(`Latency measurement ${i + 1}: ${latency.toFixed(2)}ms`);
        
        // Небольшая пауза между измерениями
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.warn(`Latency measurement ${i + 1} failed:`, error);
      }
    }
    
    if (measurements.length === 0) {
      return {
        success: false,
        error: 'All latency measurements failed'
      };
    }
    
    const avgLatency = measurements.reduce((a, b) => a + b) / measurements.length;
    const minLatency = Math.min(...measurements);
    const maxLatency = Math.max(...measurements);
    
    return {
      success: true,
      average: Math.round(avgLatency),
      min: Math.round(minLatency),
      max: Math.round(maxLatency),
      measurements: measurements.map(m => Math.round(m)),
      quality: avgLatency < 100 ? 'excellent' : 
               avgLatency < 200 ? 'good' : 
               avgLatency < 400 ? 'fair' : 'poor'
    };
  }

  // Одно измерение latency
  async singleLatencyMeasurement() {
    // Простой HTTP ping к серверу приложений как аппроксимация
    const startTime = performance.now();
    
    try {
      await fetch('/healthz', { 
        method: 'HEAD',
        cache: 'no-cache'
      });
      return performance.now() - startTime;
    } catch (error) {
      throw new Error(`Ping failed: ${error.message}`);
    }
  }

  // Тест пропускной способности TURN
  async testTurnThroughput() {
    console.log('📊 Testing TURN throughput...');
    
    // Это упрощенный тест - в реальности нужны два peer connection
    const config = {
      iceServers: [{
        urls: `turn:${this.turnServer}:${this.turnPort}?transport=udp`,
        username: this.username,
        credential: this.credential
      }],
      iceTransportPolicy: 'relay'
    };

    try {
      const pc1 = new RTCPeerConnection(config);
      const pc2 = new RTCPeerConnection(config);
      
      const dataChannel = pc1.createDataChannel('throughput-test', {
        ordered: false,
        maxPacketLifeTime: 3000
      });
      
      let bytesTransferred = 0;
      let testStartTime = 0;
      
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          pc1.close();
          pc2.close();
          
          const duration = (Date.now() - testStartTime) / 1000;
          const throughputKbps = duration > 0 ? (bytesTransferred * 8) / (duration * 1000) : 0;
          
          resolve({
            success: bytesTransferred > 0,
            bytesTransferred,
            durationSeconds: duration,
            throughputKbps: Math.round(throughputKbps),
            quality: throughputKbps > 1000 ? 'excellent' :
                    throughputKbps > 500 ? 'good' :
                    throughputKbps > 100 ? 'fair' : 'poor'
          });
        }, 10000);

        // Упрощенная установка соединения
        pc2.ondatachannel = (event) => {
          const remoteDataChannel = event.channel;
          
          remoteDataChannel.onopen = () => {
            console.log('📡 Data channel opened, starting throughput test...');
            testStartTime = Date.now();
            
            // Отправляем тестовые данные
            const testData = new ArrayBuffer(1024); // 1KB chunks
            const interval = setInterval(() => {
              if (dataChannel.readyState === 'open') {
                try {
                  dataChannel.send(testData);
                  bytesTransferred += testData.byteLength;
                } catch (error) {
                  console.warn('Send error:', error);
                  clearInterval(interval);
                }
              } else {
                clearInterval(interval);
              }
            }, 50); // Send every 50ms
          };
          
          remoteDataChannel.onmessage = (event) => {
            // Echo back for more accurate measurement
            if (remoteDataChannel.readyState === 'open') {
              try {
                remoteDataChannel.send(event.data);
              } catch (error) {
                console.warn('Echo error:', error);
              }
            }
          };
        };
        
        // Простая сигнализация
        pc1.onicecandidate = (event) => {
          if (event.candidate) {
            pc2.addIceCandidate(event.candidate);
          }
        };
        
        pc2.onicecandidate = (event) => {
          if (event.candidate) {
            pc1.addIceCandidate(event.candidate);
          }
        };
        
        pc1.createOffer().then(offer => {
          pc1.setLocalDescription(offer);
          pc2.setRemoteDescription(offer);
          return pc2.createAnswer();
        }).then(answer => {
          pc2.setLocalDescription(answer);
          pc1.setRemoteDescription(answer);
        });
      });
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Тест различных транспортных методов
  async testTransportMethods() {
    console.log('🚚 Testing transport methods...');
    
    const transports = [
      { name: 'UDP', url: `turn:${this.turnServer}:${this.turnPort}?transport=udp` },
      { name: 'TCP', url: `turn:${this.turnServer}:${this.turnPort}?transport=tcp` }
    ];
    
    const results = [];
    
    for (const transport of transports) {
      try {
        const result = await this.testSingleTransport(transport);
        results.push({ ...transport, ...result });
      } catch (error) {
        results.push({
          ...transport,
          success: false,
          error: error.message
        });
      }
    }
    
    return {
      transports: results,
      workingCount: results.filter(t => t.success).length,
      recommendedTransport: this.getRecommendedTransport(results)
    };
  }

  // Тест одного транспорта
  async testSingleTransport(transport) {
    const config = {
      iceServers: [{
        urls: transport.url,
        username: this.username,
        credential: this.credential
      }],
      iceTransportPolicy: 'relay'
    };

    const pc = new RTCPeerConnection(config);
    const startTime = Date.now();
    
    return new Promise((resolve) => {
      let success = false;
      let resolved = false;
      
      const timeout = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          pc.close();
          resolve({
            success: success,
            duration: Date.now() - startTime,
            error: success ? null : 'Transport connection timeout'
          });
        }
      }, 8000);

      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        
        if (state === 'connected' || state === 'completed') {
          success = true;
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            pc.close();
            resolve({
              success: true,
              duration: Date.now() - startTime,
              state: state
            });
          }
        } else if (state === 'failed') {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            pc.close();
            resolve({
              success: false,
              duration: Date.now() - startTime,
              error: 'Transport connection failed'
            });
          }
        }
      };

      pc.createDataChannel('transport-test');
      pc.createOffer().then(offer => pc.setLocalDescription(offer));
    });
  }

  // Получить рекомендуемый транспорт
  getRecommendedTransport(results) {
    const working = results.filter(r => r.success);
    
    if (working.length === 0) return 'none';
    
    // Предпочитаем UDP для мобильных сетей, если он работает
    const udp = working.find(r => r.name === 'UDP');
    if (udp) return 'UDP';
    
    const tcp = working.find(r => r.name === 'TCP');
    if (tcp) return 'TCP';
    
    return working[0].name;
  }

  // Анализ производительности TURN
  analyzeTurnPerformance(tests) {
    const issues = [];
    const recommendations = [];
    let overallScore = 0;
    
    // Проверка связности
    if (tests.connectivity && tests.connectivity.success) {
      overallScore += 20;
    } else {
      issues.push('TURN server не доступен');
      recommendations.push('Проверьте firewall и настройки сети на VPS');
    }
    
    // Проверка STUN
    if (tests.stun && tests.stun.workingCount > 0) {
      overallScore += 15;
    } else {
      issues.push('STUN серверы не работают');
      recommendations.push('Проверьте конфигурацию STUN портов');
    }
    
    // Проверка relay
    if (tests.relay && tests.relay.success) {
      overallScore += 25;
    } else {
      issues.push('TURN relay не функционирует');
      recommendations.push('Проверьте учетные данные и настройки relay');
    }
    
    // Проверка latency
    if (tests.latency && tests.latency.success) {
      if (tests.latency.average < 200) {
        overallScore += 20;
      } else {
        overallScore += 10;
        issues.push(`Высокая задержка: ${tests.latency.average}ms`);
        recommendations.push('Рассмотрите сервер ближе к пользователям');
      }
    }
    
    // Проверка throughput
    if (tests.throughput && tests.throughput.success) {
      if (tests.throughput.throughputKbps > 500) {
        overallScore += 10;
      } else {
        overallScore += 5;
        issues.push(`Низкая пропускная способность: ${tests.throughput.throughputKbps} kbps`);
      }
    }
    
    // Проверка транспортов
    if (tests.transports && tests.transports.workingCount > 0) {
      overallScore += 10;
    }
    
    // Специальные рекомендации для российских мобильных сетей
    if (tests.transports && tests.transports.recommendedTransport === 'TCP') {
      recommendations.push('Для российских мобильных сетей рекомендуется TCP transport');
    }
    
    if (tests.latency && tests.latency.average > 300) {
      recommendations.push('Высокая задержка может указывать на проблемы с маршрутизацией');
    }
    
    return {
      overallScore,
      grade: overallScore >= 80 ? 'A' : overallScore >= 60 ? 'B' : overallScore >= 40 ? 'C' : 'F',
      issues,
      recommendations,
      mobileOptimized: overallScore >= 60 && (!issues.includes('TURN relay не функционирует'))
    };
  }

  // Генерация отчета для отправки на сервер
  generateDiagnosticReport(results) {
    return {
      timestamp: Date.now(),
      server: `${this.turnServer}:${this.turnPort}`,
      userAgent: navigator.userAgent,
      connectionType: navigator.connection ? navigator.connection.effectiveType : 'unknown',
      results: results,
      verdict: results.analysis.grade,
      criticalIssues: results.analysis.issues,
      recommendations: results.analysis.recommendations
    };
  }
}

// Экспортируем класс
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TurnDiagnostics;
} else if (typeof window !== 'undefined') {
  window.TurnDiagnostics = TurnDiagnostics;
}